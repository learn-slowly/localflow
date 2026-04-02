#!/usr/bin/env python3
"""전체 도시 대중교통 승하차 데이터 수집

사용법:
  python3 -u scripts/fetch-transit-all-cities.py [--city jinju|paju] [--dow 목요일,금요일]

기본: 모든 도시의 미수집 요일 수집
일일 한도: ~2,000-3,000페이지 (1페이지=100건)
진주시 1일치: ~320페이지, 파주시 미확인
→ 하루에 약 3-4일치 수집 가능

429 발생 시 자동 대기 후 재시도 (최대 7회, 최대 5분 대기)
"""

import json
import re
import urllib.request
import ssl
import sys
import time
import os
import argparse
from collections import defaultdict

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = os.environ.get(
    "DATA_GO_KR_API_KEY",
    "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
)
BASE = "https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

DOW_NAMES = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

# 도시별 설정: (파일명, ctpv_cd, sgg_cd, 수집 날짜)
CITIES = {
    "jinju": {
        "name": "진주시",
        "file": "jinju-transit-usage.json",
        "bus_stops_file": "jinju-bus-stops.json",
        "ctpv_cd": "48",
        "sgg_cd": "48170",
        "dates": [
            ("20240603", "월요일"), ("20240610", "월요일"),
            ("20240604", "화요일"), ("20240611", "화요일"),
            ("20240605", "수요일"), ("20240612", "수요일"),
            ("20240613", "목요일"), ("20240620", "목요일"),
            ("20240607", "금요일"), ("20240614", "금요일"),
            ("20240608", "토요일"), ("20240615", "토요일"),
            ("20240609", "일요일"), ("20240616", "일요일"),
        ],
    },
    "paju": {
        "name": "파주시",
        "file": "paju-transit-usage.json",
        "bus_stops_file": None,  # 아직 없음
        "ctpv_cd": "41",
        "sgg_cd": "41480",
        "dates": [
            ("20240603", "월요일"), ("20240610", "월요일"),
            ("20240604", "화요일"), ("20240611", "화요일"),
            ("20240605", "수요일"), ("20240612", "수요일"),
            ("20240613", "목요일"), ("20240620", "목요일"),
            ("20240607", "금요일"), ("20240614", "금요일"),
            ("20240608", "토요일"), ("20240615", "토요일"),
            ("20240609", "일요일"), ("20240616", "일요일"),
        ],
    },
}

total_pages_fetched = 0
rate_limited = False


def fetch_page(date, page, ctpv_cd, sgg_cd):
    global total_pages_fetched, rate_limited
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd={ctpv_cd}&sgg_cd={sgg_cd}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(7):
        try:
            with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as resp:
                data = json.loads(resp.read())
            body = data.get("Response", {}).get("body", {})
            items = body.get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]
            total = int(body.get("totalCount", 0))
            total_pages_fetched += 1
            return items, total
        except Exception as e:
            if "429" in str(e):
                wait = min(60 * (attempt + 1), 300)
                print(f"    429 rate limit page {page}, {wait}초 대기... (총 {total_pages_fetched}페이지 수집)")
                if attempt >= 3:
                    rate_limited = True
                    return [], 0
                time.sleep(wait)
                continue
            if attempt < 6:
                time.sleep(5 * (attempt + 1))
                continue
            print(f"    ERROR page {page} (7회 실패): {e}")
            return [], 0
    return [], 0


def fetch_all_items(date, ctpv_cd, sgg_cd):
    global rate_limited
    result = fetch_page(date, 1, ctpv_cd, sgg_cd)
    if not result or not result[0]:
        return []
    items, total = result

    total_pages = (total + 99) // 100
    print(f"    총 {total}건, {total_pages}페이지")

    all_items = list(items)
    for page in range(2, total_pages + 1):
        if rate_limited:
            print(f"    429 한도 소진 — 수집 중단 (page {page}/{total_pages})")
            break
        if page % 20 == 0:
            print(f"    page {page}/{total_pages}... (총 {total_pages_fetched}페이지)")
        items, _ = fetch_page(date, page, ctpv_cd, sgg_cd)
        if not items:
            if rate_limited:
                break
            continue
        all_items.extend(items)
        time.sleep(0.5)

    print(f"    {len(all_items)}건 수집 완료")
    return all_items


def normalize_name(name):
    return re.sub(r'[./()·\s]', '', name)


def load_bus_coords(path):
    if not path or not os.path.exists(path):
        return {}
    with open(path) as f:
        data = json.load(f)
    coords = {}
    for st in data:
        name = st.get("name", "")
        lat = st.get("lat")
        lng = st.get("lng")
        if name and lat and lng:
            key = normalize_name(name)
            if key not in coords:
                coords[key] = (float(lat), float(lng))
    return coords


def process_city(city_key, city_cfg, target_dows=None):
    global rate_limited
    json_path = os.path.join(DATA_DIR, city_cfg["file"])
    bus_path = os.path.join(DATA_DIR, city_cfg["bus_stops_file"]) if city_cfg["bus_stops_file"] else None

    # 기존 데이터 로드 또는 빈 리스트
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        print(f"\n{'='*60}")
        print(f"[{city_cfg['name']}] 기존: {len(existing)}개 정류장")
    else:
        existing = []
        print(f"\n{'='*60}")
        print(f"[{city_cfg['name']}] 신규 수집 시작")
    print(f"{'='*60}")

    # 현재 요일별 보유 현황
    for dow in DOW_NAMES:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        total = len(existing) if existing else 0
        pct = count * 100 // total if total else 0
        status = "✅" if pct == 100 else ("⚠️" if pct > 0 else "❌")
        print(f"  {dow}: {count}/{total} ({pct}%) {status}")

    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 좌표 로드
    bus_coords = load_bus_coords(bus_path)
    for s in existing:
        if s.get("lat") and s.get("lng") and s.get("name"):
            key = normalize_name(s["name"])
            if key not in bus_coords:
                bus_coords[key] = (s["lat"], s["lng"])

    # 요일별 그룹핑
    dow_dates = defaultdict(list)
    for date, dow in city_cfg["dates"]:
        dow_dates[dow].append(date)

    dows_to_process = target_dows or DOW_NAMES
    for dow in dows_to_process:
        if rate_limited:
            print(f"\n  [!] 429 한도 소진 — 나머지 요일 건너뜀")
            break

        dates = dow_dates.get(dow, [])
        if not dates:
            continue

        missing_count = sum(1 for s in existing if dow not in s.get("byDow", {})) if existing else -1
        if missing_count == 0:
            print(f"\n[{dow}] 모두 보유 — 건너뜀")
            continue

        is_new = not existing or missing_count == len(existing)
        label = "신규 수집" if is_new else f"보완 ({missing_count}개 누락)"
        print(f"\n--- [{dow}] {label} ({len(dates)}일치) ---")

        dow_data = {}
        sttn_info = {}

        for date in dates:
            if rate_limited:
                break
            print(f"\n  [{date} {dow}]")
            all_items = fetch_all_items(date, city_cfg["ctpv_cd"], city_cfg["sgg_cd"])

            for item in all_items:
                sid = item.get("sttn_id", "~")
                if sid == "~":
                    continue
                name = item.get("sttn_nm") or ""
                dong = item.get("emd_nm") or ""
                hour = item.get("tzon", "")
                if not hour:
                    continue
                if sid not in sttn_info and name:
                    sttn_info[sid] = {"name": name, "dong": dong}
                if sid not in dow_data:
                    dow_data[sid] = defaultdict(lambda: {"ride": 0, "goff": 0})
                dow_data[sid][hour]["ride"] += item.get("ride_nope", 0)
                dow_data[sid][hour]["goff"] += item.get("goff_nope", 0)

        if not dow_data:
            print(f"  {dow} 데이터 없음")
            continue

        # 병합
        merged = 0
        new_stations = 0

        for sid, hours in dow_data.items():
            hourly = {h: {"ride": v["ride"], "goff": v["goff"]}
                      for h, v in sorted(hours.items())}

            if sid in idx_map:
                station = existing[idx_map[sid]]
                if dow in station.get("byDow", {}):
                    continue
                station.setdefault("byDow", {})[dow] = hourly
                for h, v in hourly.items():
                    if h in station["hourly"]:
                        station["hourly"][h]["ride"] += v["ride"]
                        station["hourly"][h]["goff"] += v["goff"]
                    else:
                        station["hourly"][h] = {"ride": v["ride"], "goff": v["goff"]}
                    station["totalRide"] += v["ride"]
                    station["totalGoff"] += v["goff"]
                merged += 1
            else:
                info = sttn_info.get(sid, {"name": "", "dong": ""})
                lat, lng = bus_coords.get(normalize_name(info["name"]), (0, 0))

                total_ride = sum(v["ride"] for v in hourly.values())
                total_goff = sum(v["goff"] for v in hourly.values())
                new_entry = {
                    "sttn_id": sid,
                    "name": info["name"],
                    "dong": info["dong"],
                    "totalRide": total_ride,
                    "totalGoff": total_goff,
                    "hourly": hourly,
                    "byDow": {dow: hourly},
                    "lat": lat,
                    "lng": lng,
                }
                existing.append(new_entry)
                idx_map[sid] = len(existing) - 1
                new_stations += 1

        # 즉시 저장
        existing.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)
        idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        print(f"\n  {dow} 완료: 기존 {merged}개 업데이트, 신규 {new_stations}개 추가")
        print(f"  현재 총: {len(existing)}개 정류장")

    # 최종 통계
    print(f"\n[{city_cfg['name']}] 최종: {len(existing)}개 정류장")
    for dow in DOW_NAMES:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        total = len(existing) if existing else 0
        pct = count * 100 // total if total else 0
        status = "✅" if pct == 100 else ("⚠️" if pct > 0 else "❌")
        print(f"  {dow}: {count}/{total} ({pct}%) {status}")


def main():
    parser = argparse.ArgumentParser(description="대중교통 승하차 데이터 수집")
    parser.add_argument("--city", choices=list(CITIES.keys()), help="특정 도시만 수집")
    parser.add_argument("--dow", help="특정 요일만 수집 (쉼표 구분, 예: 목요일,금요일)")
    args = parser.parse_args()

    target_dows = args.dow.split(",") if args.dow else None
    cities = {args.city: CITIES[args.city]} if args.city else CITIES

    for city_key, city_cfg in cities.items():
        if rate_limited:
            print(f"\n[!] 429 한도 소진 — 나머지 도시 건너뜀")
            break
        process_city(city_key, city_cfg, target_dows)

    print(f"\n총 {total_pages_fetched}페이지 수집 완료")
    if rate_limited:
        print("[!] 429 한도 소진으로 조기 종료. 내일 다시 실행하세요.")


if __name__ == "__main__":
    main()
