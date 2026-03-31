"""
카카오 REST API로 경로당 주소를 좌표로 재변환.
Nominatim보다 한국 주소 정확도가 훨씬 높다.

사용법: python3 scripts/geocode-kakao.py
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

KAKAO_REST_API_KEY = "bf155cb12b2e73867b57a532ed355711"
DATA_DIR = Path(__file__).parent.parent / "src" / "data"
PUBLIC_FILE = Path(__file__).parent.parent / "public" / "data" / "facilities" / "48170-facilities.json"


def kakao_geocode(address: str) -> tuple[float, float] | None:
    """카카오 주소 검색 API로 좌표 반환."""
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    params = urllib.parse.urlencode({"query": address})
    req = urllib.request.Request(
        f"{url}?{params}",
        headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            docs = data.get("documents", [])
            if docs:
                return float(docs[0]["y"]), float(docs[0]["x"])
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    429 — 60초 대기...")
            time.sleep(60)
            return kakao_geocode(address)  # 재시도
        print(f"    API 오류: {e}")
    except Exception as e:
        print(f"    API 오류: {e}")
    return None


def kakao_keyword(query: str) -> tuple[float, float] | None:
    """카카오 키워드 검색 API로 좌표 반환 (주소 검색 실패 시 폴백)."""
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    params = urllib.parse.urlencode({"query": query})
    req = urllib.request.Request(
        f"{url}?{params}",
        headers={"Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            docs = data.get("documents", [])
            if docs:
                return float(docs[0]["y"]), float(docs[0]["x"])
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"    429 — 60초 대기...")
            time.sleep(60)
            return kakao_keyword(query)  # 재시도
        print(f"    키워드 오류: {e}")
    except Exception as e:
        print(f"    키워드 오류: {e}")
    return None


def normalize_address(addr: str) -> str:
    """주소 정규화."""
    import re
    s = addr.strip()
    # "진주시 진주시" 중복 제거
    s = s.replace("진주시 진주시", "진주시")
    # 괄호 내용 제거 (아파트명 등)
    s = re.sub(r"\([^)]*\)", "", s)
    # "경상남도" 접두어 확인
    if not s.startswith("경상남도"):
        s = "경상남도 " + s
    return s.strip()


def main():
    # 1) 경로당 마스터 데이터 로드
    seniors_file = DATA_DIR / "jinju-senior-centers.json"
    with open(seniors_file) as f:
        seniors = json.load(f)

    print(f"총 경로당: {len(seniors)}건")
    with_coords = sum(1 for s in seniors if s.get("lat") and s.get("lng"))
    with_addr = sum(1 for s in seniors if s.get("address"))
    print(f"좌표 있음: {with_coords}건, 주소 있음: {with_addr}건")

    # 2) 모든 주소 있는 경로당을 카카오 API로 재지오코딩
    updated = 0
    failed = []
    total_with_addr = [s for s in seniors if s.get("address")]

    for i, s in enumerate(total_with_addr):
        addr = normalize_address(s["address"])

        # 주소 검색
        result = kakao_geocode(addr)

        # 실패 시 키워드 검색
        if not result:
            keyword = f"진주시 {s['name']}"
            if "경로당" not in s["name"]:
                keyword += " 경로당"
            result = kakao_keyword(keyword)

        if result:
            old_lat, old_lng = s.get("lat", 0), s.get("lng", 0)
            s["lat"] = result[0]
            s["lng"] = result[1]
            s["geocoded_by"] = "kakao"
            updated += 1
            if (i + 1) % 50 == 0:
                print(f"  {i+1}/{len(total_with_addr)} 완료 (갱신 {updated}건)")
        else:
            failed.append(s["name"])

        time.sleep(1.0)  # 카카오 API 속도 제한 방지

    print(f"\n결과: 갱신 {updated}건, 실패 {len(failed)}건")
    if failed[:10]:
        print(f"실패 예시: {failed[:10]}")

    # 3) 주소 없는 경로당도 키워드로 시도
    no_addr = [s for s in seniors if not s.get("address")]
    print(f"\n주소 없는 경로당 {len(no_addr)}건 키워드 검색...")
    keyword_found = 0
    for s in no_addr:
        keyword = f"진주시 {s['name']}"
        if "경로당" not in s["name"]:
            keyword += " 경로당"
        result = kakao_keyword(keyword)
        if result:
            s["lat"] = result[0]
            s["lng"] = result[1]
            keyword_found += 1
        time.sleep(0.3)

    print(f"  키워드로 추가 확보: {keyword_found}건")

    # 4) 저장
    final_with_coords = sum(1 for s in seniors if s.get("lat") and s.get("lng"))
    print(f"\n최종 좌표 확보: {final_with_coords}/{len(seniors)}건")

    with open(seniors_file, "w", encoding="utf-8") as f:
        json.dump(seniors, f, ensure_ascii=False, indent=2)
    print(f"저장: {seniors_file.name}")

    # 5) facilities 파일들도 업데이트
    senior_coords = {}
    for s in seniors:
        if s.get("lat") and s.get("lng"):
            senior_coords[s["name"]] = s
            senior_coords[s["name"] + "경로당"] = s

    for fpath in [DATA_DIR / "jinju-facilities.json", PUBLIC_FILE]:
        with open(fpath) as f:
            facilities = json.load(f)

        fac_updated = 0
        for item in facilities:
            if item["category"] == "경로당":
                match = senior_coords.get(item["name"]) or senior_coords.get(item["name"].replace("경로당", ""))
                if match:
                    item["lat"] = match["lat"]
                    item["lng"] = match["lng"]
                    if match.get("members"):
                        item["members"] = match["members"]
                    if match.get("dong"):
                        item["dong"] = match["dong"]
                    fac_updated += 1

        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(facilities, f, ensure_ascii=False, separators=(",", ":"))
        print(f"갱신: {fpath.name} ({fac_updated}건)")

    print("\n완료!")


if __name__ == "__main__":
    main()
