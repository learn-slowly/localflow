#!/usr/bin/env python3
"""미수집/불완전 요일 대중교통 데이터 수집 계속

현황:
- 월요일: 1140/1140 ✅ (건너뜀)
- 화요일: 309/1140 ⚠️ (보완 필요)
- 수요일: 290/1140 ⚠️ (보완 필요)
- 목~일: 0/1140 ❌ (신규 수집)

전략:
- 429 발생 시 60초부터 시작하여 최대 5분까지 대기
- 요일 하나 끝날 때마다 즉시 저장
- 이미 완전한 요일(월요일)은 건너뜀
"""

import json
import re
import urllib.request
import ssl
import time
import os
from collections import defaultdict

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34")
BASE = "https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
JSON_PATH = os.path.join(DATA_DIR, "jinju-transit-usage.json")
BUS_STTN_PATH = os.path.join(DATA_DIR, "jinju-bus-stops.json")

# 미수집/불완전 요일만 수집 (월요일 제외)
TARGET_DATES = [
    ("20240604", "화요일"),
    ("20240611", "화요일"),
    ("20240605", "수요일"),
    ("20240612", "수요일"),
    ("20240613", "목요일"),
    ("20240620", "목요일"),
    ("20240607", "금요일"),
    ("20240614", "금요일"),
    ("20240608", "토요일"),
    ("20240615", "토요일"),
    ("20240609", "일요일"),
    ("20240616", "일요일"),
]

DOW_NAMES = ["화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]


def fetch_page(date, page):
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd=48&sgg_cd=48170")
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
            return items, total
        except Exception as e:
            if "429" in str(e):
                wait = min(60 * (attempt + 1), 300)
                print(f"    429 rate limit page {page}, {wait}초 대기...")
                time.sleep(wait)
                continue
            if attempt < 6:
                time.sleep(5 * (attempt + 1))
                continue
            print(f"    ERROR page {page} (7회 실패): {e}")
            return [], 0
    print(f"    ERROR page {page} (429 제한 초과)")
    return [], 0


def fetch_all_items(date):
    """한 날짜의 전체 데이터 수집"""
    result = fetch_page(date, 1)
    if not result or not result[0]:
        print(f"    첫 페이지 실패 — 이 날짜 건너뜀")
        return []
    items, total = result

    total_pages = (total + 99) // 100
    print(f"    총 {total}건, {total_pages}페이지")

    all_items = list(items)
    for page in range(2, total_pages + 1):
        if page % 20 == 0:
            print(f"    page {page}/{total_pages}...")
        items, _ = fetch_page(date, page)
        if not items:
            print(f"    page {page} 실패 — 건너뜀")
            continue
        all_items.extend(items)
        time.sleep(0.5)  # 0.3 → 0.5초로 증가

    print(f"    {len(all_items)}건 수집 완료")
    return all_items


def normalize_name(name):
    return re.sub(r'[./()·\s]', '', name)


def load_bus_coords():
    if not os.path.exists(BUS_STTN_PATH):
        return {}
    with open(BUS_STTN_PATH) as f:
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


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"기존 데이터: {len(existing)}개 정류장")

    # 현재 요일별 보유 현황
    for dow in ["월요일"] + DOW_NAMES:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        pct = count * 100 // len(existing) if existing else 0
        status = "✅" if pct == 100 else ("⚠️" if pct > 0 else "❌")
        print(f"  {dow}: {count}/{len(existing)} ({pct}%) {status}")

    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 좌표 로드
    bus_coords = load_bus_coords()
    for s in existing:
        if s.get("lat") and s.get("lng") and s.get("name"):
            key = normalize_name(s["name"])
            if key not in bus_coords:
                bus_coords[key] = (s["lat"], s["lng"])
    print(f"좌표 DB: {len(bus_coords)}개")

    # 요일별 그룹핑
    dow_dates = defaultdict(list)
    for date, dow in TARGET_DATES:
        dow_dates[dow].append(date)

    for dow in DOW_NAMES:
        dates = dow_dates.get(dow, [])
        if not dates:
            continue

        # 이 요일이 없는 정류장 수
        missing_count = sum(1 for s in existing if dow not in s.get("byDow", {}))
        if missing_count == 0:
            print(f"\n[{dow}] 모두 보유 — 건너뜀")
            continue

        is_new_dow = missing_count == len(existing)
        print(f"\n{'='*50}")
        print(f"[{dow}] {'신규 수집' if is_new_dow else f'보완 ({missing_count}개 누락)'} ({len(dates)}일치)")
        print(f"{'='*50}")

        dow_data = {}
        sttn_info = {}

        for date in dates:
            print(f"\n  [{date} {dow}]")
            all_items = fetch_all_items(date)

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
            print(f"\n  {dow} 데이터 없음 — 건너뜀")
            continue

        # 병합
        merged = 0
        new_stations = 0

        for sid, hours in dow_data.items():
            hourly = {h: {"ride": v["ride"], "goff": v["goff"]}
                      for h, v in sorted(hours.items())}

            if sid in idx_map:
                station = existing[idx_map[sid]]

                # 이미 이 요일이 있으면 건너뜀
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
                if not lat and not lng:
                    continue

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

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        print(f"\n  {dow} 완료: 기존 {merged}개 업데이트, 신규 {new_stations}개 추가")
        print(f"  현재 총 정류장: {len(existing)}개")

    # 최종 통계
    print(f"\n{'='*50}")
    print(f"최종 결과")
    print(f"{'='*50}")
    print(f"총 정류장: {len(existing)}개")
    for dow in ["월요일"] + DOW_NAMES:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        pct = count * 100 // len(existing) if existing else 0
        status = "✅" if pct == 100 else ("⚠️" if pct > 0 else "❌")
        print(f"  {dow}: {count}/{len(existing)} ({pct}%) {status}")


if __name__ == "__main__":
    main()
