#!/usr/bin/env python3
"""교통카드 화요일 이용량 수집 → 기존 jinju-transit-usage.json에 병합"""

import json
import urllib.request
import ssl
import time
import os
from collections import defaultdict

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
JSON_PATH = os.path.join(DATA_DIR, "jinju-transit-usage.json")

# 화요일 2일치 (2024년 6월)
DATES = [
    "20240604",  # 화
    "20240611",  # 화
]


def fetch_page(date, page):
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd=48&sgg_cd=48170")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            data = json.loads(resp.read())
        body = data.get("Response", {}).get("body", {})
        items = body.get("items", {}).get("item", [])
        if isinstance(items, dict):
            items = [items]
        total = int(body.get("totalCount", 0))
        return items, total
    except Exception as e:
        print(f"  Error page {page}: {e}")
        return [], 0


def main():
    # 기존 데이터 로드
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"기존 데이터: {len(existing)}개 정류장")

    # sttn_id → index 맵
    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 화요일 데이터 수집
    tue_data = {}  # sttn_id → {hour → {ride, goff}}

    for date in DATES:
        print(f"\n[{date} 화요일] 수집 시작...")

        items, total = fetch_page(date, 1)
        if not items:
            print(f"  데이터 없음")
            continue

        total_pages = (total + 99) // 100
        print(f"  총 {total}건, {total_pages}페이지")

        all_items = list(items)
        max_pages = min(total_pages, 320)

        for page in range(2, max_pages + 1):
            if page % 50 == 0:
                print(f"  page {page}/{max_pages}...")
            items, _ = fetch_page(date, page)
            all_items.extend(items)
            time.sleep(0.05)

        print(f"  {len(all_items)}건 수집")

        for item in all_items:
            sid = item.get("sttn_id", "~")
            if sid == "~":
                continue

            hour = item.get("tzon", "")
            if not hour:
                continue

            if sid not in tue_data:
                tue_data[sid] = defaultdict(lambda: {"ride": 0, "goff": 0})

            tue_data[sid][hour]["ride"] += item.get("ride_nope", 0)
            tue_data[sid][hour]["goff"] += item.get("goff_nope", 0)

    print(f"\n화요일 데이터: {len(tue_data)}개 정류장")

    # 기존 데이터에 화요일 병합
    merged = 0
    new_stations = 0
    for sid, hours in tue_data.items():
        tue_hourly = {h: {"ride": v["ride"], "goff": v["goff"]}
                      for h, v in sorted(hours.items())}

        if sid in idx_map:
            station = existing[idx_map[sid]]
            station["byDow"]["화요일"] = tue_hourly

            # hourly 합산 + totalRide/totalGoff 갱신
            for h, v in tue_hourly.items():
                if h in station["hourly"]:
                    station["hourly"][h]["ride"] += v["ride"]
                    station["hourly"][h]["goff"] += v["goff"]
                else:
                    station["hourly"][h] = {"ride": v["ride"], "goff": v["goff"]}
                station["totalRide"] += v["ride"]
                station["totalGoff"] += v["goff"]
            merged += 1
        else:
            # 월요일에 없던 새 정류장
            tue_total_ride = sum(v["ride"] for v in tue_hourly.values())
            tue_total_goff = sum(v["goff"] for v in tue_hourly.values())
            existing.append({
                "sttn_id": sid,
                "name": "",
                "dong": "",
                "totalRide": tue_total_ride,
                "totalGoff": tue_total_goff,
                "hourly": dict(tue_hourly),
                "byDow": {"화요일": tue_hourly},
            })
            new_stations += 1

    # 이용량 순 재정렬
    existing.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    print(f"\n병합 완료: {merged}개 기존 정류장 업데이트, {new_stations}개 신규 추가")
    print(f"저장: {JSON_PATH}")

    # 확인
    dows = set()
    for s in existing:
        dows.update(s.get("byDow", {}).keys())
    print(f"요일 목록: {sorted(dows)}")


if __name__ == "__main__":
    main()
