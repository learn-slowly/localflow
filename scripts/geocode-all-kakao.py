"""
카카오 REST API로 투표소·시설·전통시장 좌표를 일괄 재변환.
concurrent.futures로 병렬 처리 (동시 5개).

사용법: PYTHONUNBUFFERED=1 python3 scripts/geocode-all-kakao.py
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

KAKAO_REST_API_KEY = "bf155cb12b2e73867b57a532ed355711"
DATA_DIR = Path(__file__).parent.parent / "src" / "data"
PUBLIC_DIR = Path(__file__).parent.parent / "public" / "data"

# 카카오 API 속도 제한용 락
api_lock = threading.Lock()
call_times: list[float] = []
MAX_CALLS_PER_SEC = 5


def rate_limited_request(url: str, params: dict) -> dict | None:
    """속도 제한 적용한 카카오 API 호출."""
    encoded = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{encoded}",
        headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
    )

    with api_lock:
        now = time.time()
        # 최근 1초 내 호출 수 체크
        while len(call_times) >= MAX_CALLS_PER_SEC:
            oldest = call_times[0]
            if now - oldest < 1.0:
                time.sleep(1.0 - (now - oldest) + 0.05)
                now = time.time()
            call_times.pop(0)
        call_times.append(now)

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 ** attempt * 2)
                continue
            return None
        except Exception:
            return None
    return None


def kakao_geocode(address: str) -> tuple[float, float] | None:
    """카카오 주소 검색."""
    data = rate_limited_request(
        "https://dapi.kakao.com/v2/local/search/address.json",
        {"query": address},
    )
    if data:
        docs = data.get("documents", [])
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"])
    return None


def kakao_keyword(query: str) -> tuple[float, float] | None:
    """카카오 키워드 검색 (주소 실패 시 폴백)."""
    data = rate_limited_request(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        {"query": query},
    )
    if data:
        docs = data.get("documents", [])
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"])
    return None


def normalize_address(addr: str) -> str:
    s = addr.strip()
    s = re.sub(r"\([^)]*\)", "", s)
    if not s.startswith("경상남도"):
        s = "경상남도 " + s
    return s.strip()


# ── 투표소 지오코딩 ──

def geocode_polling_station(item: dict) -> dict:
    addr = item.get("addr", "")
    if not addr:
        return item

    result = kakao_geocode(normalize_address(addr))
    if not result:
        # 장소명으로 키워드 검색
        place = item.get("place", "")
        if place:
            result = kakao_keyword(f"진주시 {place}")

    if result:
        item["lat"] = result[0]
        item["lng"] = result[1]
        item.pop("approx", None)
        item["geocoded_by"] = "kakao"

    return item


def process_polling_stations():
    filepath = DATA_DIR / "jinju-polling-stations.json"
    with open(filepath) as f:
        stations = json.load(f)

    print(f"\n[투표소] {len(stations)}건 지오코딩 시작...")
    approx = sum(1 for s in stations if s.get("approx"))
    print(f"  approx=true: {approx}건")

    updated = 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(geocode_polling_station, s): i for i, s in enumerate(stations)}
        for future in as_completed(futures):
            result = future.result()
            if result.get("geocoded_by") == "kakao":
                updated += 1
            idx = futures[future]
            stations[idx] = result

    print(f"  완료: {updated}/{len(stations)}건 갱신")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    print(f"  저장: {filepath.name}")
    return updated


# ── 시설 지오코딩 (경로당 제외) ──

def geocode_facility(item: dict) -> dict:
    addr = item.get("address", "")
    if not addr:
        return item

    result = kakao_geocode(normalize_address(addr))
    if not result:
        name = item.get("name", "")
        if name:
            result = kakao_keyword(f"진주시 {name}")

    if result:
        item["lat"] = result[0]
        item["lng"] = result[1]
        item["geocoded_by"] = "kakao"

    return item


def process_facilities():
    filepath = PUBLIC_DIR / "facilities" / "48170-facilities.json"
    with open(filepath) as f:
        facilities = json.load(f)

    # 경로당은 이미 처리됨 → 나머지만
    targets = [i for i, f in enumerate(facilities) if f.get("category") != "경로당" and f.get("address")]
    print(f"\n[시설] {len(targets)}건 지오코딩 시작 (경로당 제외)...")

    updated = 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(geocode_facility, facilities[i]): i for i in targets}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            idx = futures[future]
            facilities[idx] = result
            if result.get("geocoded_by") == "kakao":
                updated += 1
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(targets)} 처리...")

    print(f"  완료: {updated}/{len(targets)}건 갱신")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(facilities, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  저장: {filepath.name}")

    # jinju-facilities.json도 동기화
    src_fac = DATA_DIR / "jinju-facilities.json"
    if src_fac.exists():
        with open(src_fac) as f:
            src_facilities = json.load(f)

        coord_map = {}
        for item in facilities:
            if item.get("geocoded_by") == "kakao":
                coord_map[item["name"]] = item

        src_updated = 0
        for item in src_facilities:
            match = coord_map.get(item["name"])
            if match:
                item["lat"] = match["lat"]
                item["lng"] = match["lng"]
                item["geocoded_by"] = "kakao"
                src_updated += 1

        with open(src_fac, "w", encoding="utf-8") as f:
            json.dump(src_facilities, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  동기화: {src_fac.name} ({src_updated}건)")

    return updated


# ── 전통시장 지오코딩 ──

def process_markets():
    filepath = PUBLIC_DIR / "facilities" / "48170-markets.json"
    if not filepath.exists():
        print("\n[전통시장] 파일 없음, 건너뜀")
        return 0

    with open(filepath) as f:
        markets = json.load(f)

    print(f"\n[전통시장] {len(markets)}건 지오코딩 시작...")

    updated = 0
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(geocode_facility, m): i for i, m in enumerate(markets)}
        for future in as_completed(futures):
            result = future.result()
            idx = futures[future]
            markets[idx] = result
            if result.get("geocoded_by") == "kakao":
                updated += 1

    print(f"  완료: {updated}/{len(markets)}건 갱신")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(markets, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  저장: {filepath.name}")
    return updated


if __name__ == "__main__":
    print("=" * 50)
    print("카카오 API 일괄 지오코딩 (병렬 5스레드)")
    print("=" * 50)

    t0 = time.time()
    ps = process_polling_stations()
    fac = process_facilities()
    mk = process_markets()

    elapsed = time.time() - t0
    print(f"\n{'=' * 50}")
    print(f"전체 완료: 투표소 {ps} + 시설 {fac} + 전통시장 {mk} = {ps + fac + mk}건")
    print(f"소요 시간: {elapsed:.0f}초")
