#!/usr/bin/env python3
"""교통카드 일별 이용량 수집 → 정류장별 요일·시간대 집계"""

import json
import urllib.request
import time
import os
from collections import defaultdict

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# 2024년 6월 첫째 주 (월~일) - 7일이면 요일별 패턴 가능
DATES = [
    "20240603",  # 월
    "20240604",  # 화
    "20240605",  # 수
    "20240606",  # 목 (현충일 공휴일 - 제외하고 다른 목요일)
    "20240610",  # 월 (추가)
    "20240611",  # 화
    "20240612",  # 수
    "20240613",  # 목
    "20240614",  # 금
    "20240615",  # 토
    "20240616",  # 일
]


def fetch_page(date, page):
    url = (f"{BASE}?serviceKey={API_KEY}&dataType=json"
           f"&numOfRows=100&pageNo={page}&opr_ymd={date}"
           f"&ctpv_cd=48&sgg_cd=48170")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
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
    # 정류장별 집계: sttn_id → {info, by_dow_hour}
    stations = {}

    for date in DATES:
        print(f"\n[{date}] 수집 시작...")
        items, total = fetch_page(date, 1)
        if not items:
            print(f"  데이터 없음")
            continue

        total_pages = (total + 99) // 100
        print(f"  총 {total}건, {total_pages}페이지")

        # 첫 페이지 처리
        all_items = items

        # 나머지 페이지 (속도를 위해 최대 320페이지 = 32000건)
        max_pages = min(total_pages, 320)
        for page in range(2, max_pages + 1):
            if page % 50 == 0:
                print(f"  page {page}/{max_pages}...")
            items, _ = fetch_page(date, page)
            all_items.extend(items)
            time.sleep(0.05)  # rate limit

        print(f"  {len(all_items)}건 수집")

        # 집계
        for item in all_items:
            sid = item.get("sttn_id", "~")
            if sid == "~":
                continue

            if sid not in stations:
                stations[sid] = {
                    "sttn_id": sid,
                    "sttn_nm": item.get("sttn_nm", ""),
                    "emd_nm": item.get("emd_nm", ""),
                    "by_dow_hour": {},
                    "total_ride": 0,
                    "total_goff": 0,
                }

            dow = item.get("dow_nm", "")
            hour = item.get("tzon", "")
            key = f"{dow}_{hour}"

            st = stations[sid]
            if key not in st["by_dow_hour"]:
                st["by_dow_hour"][key] = {"dow": dow, "hour": hour, "ride": 0, "goff": 0}

            st["by_dow_hour"][key]["ride"] += item.get("ride_nope", 0)
            st["by_dow_hour"][key]["goff"] += item.get("goff_nope", 0)
            st["total_ride"] += item.get("ride_nope", 0)
            st["total_goff"] += item.get("goff_nope", 0)

    # 결과 정리
    result = []
    for sid, st in stations.items():
        entry = {
            "sttn_id": st["sttn_id"],
            "name": st["sttn_nm"],
            "dong": st["emd_nm"],
            "totalRide": st["total_ride"],
            "totalGoff": st["total_goff"],
            "hourly": {},  # hour → {ride, goff}
            "byDow": {},   # dow → {hour → {ride, goff}}
        }

        # 시간대별 합계
        hourly = defaultdict(lambda: {"ride": 0, "goff": 0})
        by_dow = defaultdict(lambda: defaultdict(lambda: {"ride": 0, "goff": 0}))

        for data in st["by_dow_hour"].values():
            h = data["hour"]
            d = data["dow"]
            hourly[h]["ride"] += data["ride"]
            hourly[h]["goff"] += data["goff"]
            by_dow[d][h]["ride"] += data["ride"]
            by_dow[d][h]["goff"] += data["goff"]

        entry["hourly"] = {h: {"ride": v["ride"], "goff": v["goff"]}
                          for h, v in sorted(hourly.items())}
        entry["byDow"] = {d: {h: {"ride": hv["ride"], "goff": hv["goff"]}
                              for h, hv in sorted(hours.items())}
                          for d, hours in by_dow.items()}

        result.append(entry)

    # 이용량 순 정렬
    result.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)

    out_path = os.path.join(OUT_DIR, "jinju-transit-usage.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n저장: {out_path}")
    print(f"정류장 수: {len(result)}개")
    top5 = result[:5]
    for s in top5:
        print(f"  {s['name']} ({s['dong']}): 승차 {s['totalRide']}, 하차 {s['totalGoff']}")


if __name__ == "__main__":
    main()
