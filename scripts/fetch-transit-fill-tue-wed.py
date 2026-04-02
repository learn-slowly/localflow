#!/usr/bin/env python3
"""화요일·수요일 누락 정류장 보완 수집

문제: 화요일 309/1140, 수요일 290/1140 — 나머지 정류장에 해당 요일 데이터 없음
전략: 해당 요일 전체 데이터를 다시 수집하여, byDow에 해당 요일이 없는 정류장에만 병합
"""

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

# 화요일·수요일 각 2일치
TARGET_DATES = [
    ("20240604", "화요일"),
    ("20240611", "화요일"),
    ("20240605", "수요일"),
    ("20240612", "수요일"),
]


def fetch_page(date, page):
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd=48&sgg_cd=48170")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
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
                wait = 10 * (attempt + 1)
                print(f"    429 rate limit page {page}, {wait}초 대기...")
                time.sleep(wait)
                continue
            if attempt < 4:
                time.sleep(3 * (attempt + 1))
                continue
            print(f"    ERROR page {page} (5회 실패): {e}")
            return [], 0
    print(f"    ERROR page {page} (429 제한 초과)")
    return [], 0


def fetch_all_items(date):
    """한 날짜의 모든 데이터를 빠짐없이 수집"""
    result = fetch_page(date, 1)
    if not result or not result[0]:
        print(f"    첫 페이지 실패 — 이 날짜 건너뜀")
        return []
    items, total = result

    total_pages = (total + 99) // 100
    print(f"    총 {total}건, {total_pages}페이지")

    all_items = list(items)
    for page in range(2, total_pages + 1):
        if page % 50 == 0:
            print(f"    page {page}/{total_pages}...")
        items, _ = fetch_page(date, page)
        if not items:
            print(f"    page {page} 실패 — 건너뜀")
            continue
        all_items.extend(items)
        time.sleep(0.3)

    print(f"    {len(all_items)}건 수집 완료")
    return all_items


def main():
    # 기존 데이터 로드
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"기존 데이터: {len(existing)}개 정류장")

    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 현재 화/수 보유 현황
    for dow in ["화요일", "수요일"]:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        print(f"  {dow}: {count}/{len(existing)}개 보유")

    # 요일별 그룹핑
    dow_dates = defaultdict(list)
    for date, dow in TARGET_DATES:
        dow_dates[dow].append(date)

    for dow, dates in dow_dates.items():
        print(f"\n{'='*50}")
        print(f"[{dow}] 누락 정류장 보완 ({len(dates)}일치)")
        print(f"{'='*50}")

        # 이 요일이 없는 정류장 목록
        missing_ids = set()
        for s in existing:
            if dow not in s.get("byDow", {}):
                missing_ids.add(s["sttn_id"])
        print(f"  누락 정류장: {len(missing_ids)}개")

        if not missing_ids:
            print(f"  모두 보유 — 건너뜀")
            continue

        # 데이터 수집
        dow_data = {}  # sttn_id → {hour → {ride, goff}}

        for date in dates:
            print(f"\n  [{date} {dow}]")
            all_items = fetch_all_items(date)

            for item in all_items:
                sid = item.get("sttn_id", "~")
                if sid == "~" or sid not in missing_ids:
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

        # 병합: byDow 추가 + hourly/total 합산
        filled = 0
        for sid, hours in dow_data.items():
            if sid not in idx_map:
                continue

            station = existing[idx_map[sid]]
            hourly = {h: {"ride": v["ride"], "goff": v["goff"]}
                      for h, v in sorted(hours.items())}

            station["byDow"][dow] = hourly
            for h, v in hourly.items():
                if h in station["hourly"]:
                    station["hourly"][h]["ride"] += v["ride"]
                    station["hourly"][h]["goff"] += v["goff"]
                else:
                    station["hourly"][h] = {"ride": v["ride"], "goff": v["goff"]}
                station["totalRide"] += v["ride"]
                station["totalGoff"] += v["goff"]
            filled += 1

        # 즉시 저장
        existing.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)
        # idx_map 갱신 (정렬 후 인덱스 변경됨)
        idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        still_missing = sum(1 for s in existing if dow not in s.get("byDow", {}))
        print(f"\n  {dow} 완료: {filled}개 보완, 여전히 누락: {still_missing}개")

    # 최종 통계
    print(f"\n{'='*50}")
    print(f"최종 결과")
    print(f"{'='*50}")
    print(f"총 정류장: {len(existing)}개")
    for dow in ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]:
        count = sum(1 for s in existing if dow in s.get("byDow", {}))
        print(f"  {dow}: {count}/{len(existing)}개")


if __name__ == "__main__":
    main()
