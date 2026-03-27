#!/usr/bin/env python3
"""수·목·금·토·일 교통카드 이용량 수집 → 기존 jinju-transit-usage.json에 병합"""

import json
import urllib.request
import ssl
import time
import os
import sys
from collections import defaultdict
from datetime import datetime

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
JSON_PATH = os.path.join(DATA_DIR, "jinju-transit-usage.json")

DOW_NAMES = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

# 2024년 6월 — 요일별 2일치씩 (공휴일 6/6 제외)
DATES = [
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


def fetch_page(date, page):
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd=48&sgg_cd=48170")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
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
            if attempt < 2:
                time.sleep(2)
                continue
            print(f"  Error page {page}: {e}")
            return [], 0


def main():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"기존 데이터: {len(existing)}개 정류장")

    # 이미 수집된 요일 확인
    existing_dows = set()
    for s in existing:
        existing_dows.update(s.get("byDow", {}).keys())
    print(f"기존 요일: {sorted(existing_dows)}")

    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 요일별로 그룹핑하여 순차 수집 + 즉시 저장
    dow_dates = defaultdict(list)
    for date, dow in DATES:
        if dow in existing_dows:
            print(f"  {dow} 이미 있음 — 건너뜀")
            continue
        dow_dates[dow].append(date)

    if not dow_dates:
        print("수집할 요일 없음")
        return

    for dow, dates in dow_dates.items():
        print(f"\n{'='*50}")
        print(f"[{dow}] 수집 시작 ({len(dates)}일치)")
        print(f"{'='*50}")

        dow_data = {}  # sttn_id → {hour → {ride, goff}}

        for date in dates:
            print(f"\n  [{date} {dow}]")
            items, total = fetch_page(date, 1)
            if not items:
                print(f"    데이터 없음 — API 한도 도달 가능성")
                continue

            total_pages = (total + 99) // 100
            max_pages = min(total_pages, 320)
            print(f"    총 {total}건, {max_pages}페이지")

            all_items = list(items)
            for page in range(2, max_pages + 1):
                if page % 50 == 0:
                    print(f"    page {page}/{max_pages}...")
                items, _ = fetch_page(date, page)
                all_items.extend(items)
                time.sleep(0.05)

            print(f"    {len(all_items)}건 수집")

            for item in all_items:
                sid = item.get("sttn_id", "~")
                if sid == "~":
                    continue
                hour = item.get("tzon", "")
                if not hour:
                    continue

                if sid not in dow_data:
                    dow_data[sid] = defaultdict(lambda: {"ride": 0, "goff": 0})
                dow_data[sid][hour]["ride"] += item.get("ride_nope", 0)
                dow_data[sid][hour]["goff"] += item.get("goff_nope", 0)

        if not dow_data:
            print(f"\n  {dow} 데이터 없음 — 건너뜀")
            continue

        # 병합
        merged = 0
        for sid, hours in dow_data.items():
            hourly = {h: {"ride": v["ride"], "goff": v["goff"]}
                      for h, v in sorted(hours.items())}

            if sid in idx_map:
                station = existing[idx_map[sid]]
                station["byDow"][dow] = hourly
                for h, v in hourly.items():
                    if h in station["hourly"]:
                        station["hourly"][h]["ride"] += v["ride"]
                        station["hourly"][h]["goff"] += v["goff"]
                    else:
                        station["hourly"][h] = {"ride": v["ride"], "goff": v["goff"]}
                    station["totalRide"] += v["ride"]
                    station["totalGoff"] += v["goff"]
                merged += 1
            # 좌표 없는 신규 정류장은 무시 (히트맵에 표시 불가)

        # 요일 하나 끝날 때마다 즉시 저장 (중간 중단 대비)
        existing.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        dows = set()
        for s in existing:
            dows.update(s.get("byDow", {}).keys())
        print(f"\n  {dow} 병합: {merged}개 정류장 업데이트")
        print(f"  현재 요일: {sorted(dows)}")

    print(f"\n완료!")


if __name__ == "__main__":
    main()
