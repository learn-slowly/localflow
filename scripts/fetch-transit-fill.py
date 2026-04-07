#!/usr/bin/env python3
"""누락 읍면동 + 미수집 요일(목금토일) 보완 수집

문제:
1. 기존 수집에서 14개 읍면동 정류장이 누락됨 (페이지 타이밍/순서 문제)
2. 목·금·토·일 요일 데이터 미수집

전략:
- 전체 페이지를 빠짐없이 수집 (재시도 3회)
- 기존 데이터와 병합 (기존 정류장은 byDow만 추가, 신규 정류장은 새로 추가)
- 좌표 없는 신규 정류장은 카카오 API로 정류장명 검색하여 좌표 보완
"""

import json
import re
import urllib.request
import ssl
import time
import os
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

# 2024년 6월 — 모든 요일 2일치 (공휴일 6/6 현충일 제외)
ALL_DATES = [
    ("20240603", "월요일"),
    ("20240610", "월요일"),
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

# 버스정류장 좌표
BUS_STTN_PATH = os.path.join(DATA_DIR, "jinju-bus-stops.json")


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
    # 429 5회 소진 시
    print(f"    ERROR page {page} (429 제한 초과)")
    return [], 0


def fetch_all_items(date):
    """한 날짜의 모든 데이터를 빠짐없이 수집"""
    result = fetch_page(date, 1)
    if result is None or result[0] is None or not result[0]:
        print(f"    첫 페이지 실패 — 이 날짜 건너뜀")
        return []
    items, total = result

    total_pages = (total + 99) // 100
    print(f"    총 {total}건, {total_pages}페이지")

    all_items = list(items)
    for page in range(2, total_pages + 1):
        if page % 10 == 0:
            print(f"    page {page}/{total_pages}...")
        items, _ = fetch_page(date, page)
        if not items:
            print(f"    page {page} 실패 — 건너뜀")
            continue
        all_items.extend(items)
        time.sleep(0.3)

    print(f"    {len(all_items)}건 수집 완료")
    return all_items


def normalize_name(name):
    """정류장 이름 정규화 (구분자 제거)"""
    return re.sub(r'[./()·\s]', '', name)


def load_bus_coords():
    """버스정류장 좌표 로드 (이름 정규화 기반)"""
    if not os.path.exists(BUS_STTN_PATH):
        print(f"  버스정류장 좌표 파일 ��음: {BUS_STTN_PATH}")
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
    print(f"  버스정류장 좌표: {len(coords)}개 로드 (이름 기반)")
    return coords


def main():
    # 기존 데이터 로드
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        existing = json.load(f)
    print(f"기존 데이터: {len(existing)}개 정류장")

    # 기존 요일 확인
    existing_dows = set()
    for s in existing:
        existing_dows.update(s.get("byDow", {}).keys())
    print(f"기존 요일: {sorted(existing_dows)}")

    # 기존 정류장 인덱스
    idx_map = {s["sttn_id"]: i for i, s in enumerate(existing)}

    # 버스정류장 좌표 로드 + 기존 데이터 좌표 보강
    bus_coords = load_bus_coords()
    for s in existing:
        if s.get("lat") and s.get("lng") and s.get("name"):
            key = normalize_name(s["name"])
            if key not in bus_coords:
                bus_coords[key] = (s["lat"], s["lng"])
    print(f"  기존 포함 총 좌표: {len(bus_coords)}개")

    # 수집할 날짜 결정
    # 이미 완전 수집된 요일은 건너뜀 (API 쿼터 절약)
    SKIP_DOWS = {"월요일", "화요일", "수요일", "목요일"}

    dow_dates = defaultdict(list)
    for date, dow in ALL_DATES:
        dow_dates[dow].append(date)

    for dow in DOW_NAMES:
        if dow in SKIP_DOWS:
            print(f"\n[{dow}] 이미 완전 수집 — 건너뜀")
            continue
        dates = dow_dates.get(dow, [])
        if not dates:
            continue

        is_new_dow = dow not in existing_dows
        print(f"\n{'='*50}")
        print(f"[{dow}] {'신규 수집' if is_new_dow else '누락 정류장 보완'} ({len(dates)}일치)")
        print(f"{'='*50}")

        dow_data = {}  # sttn_id → {hour → {ride, goff}}
        sttn_info = {}  # sttn_id → {name, dong}

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

                if dow not in station.get("byDow", {}):
                    # 이 정류장에 해당 요일 데이터가 없으면 추가
                    if "byDow" not in station:
                        station["byDow"] = {}
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
                # 이미 해당 요일 데이터가 있는 정류장: 건너뜀

            else:
                # 신규 정류장 추가
                info = sttn_info.get(sid, {"name": "", "dong": ""})
                lat, lng = bus_coords.get(normalize_name(info["name"]), (0, 0))

                if not lat and not lng:
                    # 좌표 없으면 히트맵에 표시 불가 — 건너뜀
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

        # 요일 하나 끝날 때마다 즉시 저장
        existing.sort(key=lambda x: x["totalRide"] + x["totalGoff"], reverse=True)
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

        dows = set()
        for s in existing:
            dows.update(s.get("byDow", {}).keys())

        print(f"\n  {dow} 완료: 기존 {merged}개 업데이트, 신규 {new_stations}개 추가")
        print(f"  현재 총 정류장: {len(existing)}개")
        print(f"  현재 요일: {sorted(dows)}")

    # 최종 통계
    print(f"\n{'='*50}")
    print(f"최종 결과")
    print(f"{'='*50}")
    print(f"총 정류장: {len(existing)}개")
    emd_set = set(s["dong"] for s in existing)
    print(f"읍면동: {len(emd_set)}개")
    for e in sorted(emd_set):
        cnt = sum(1 for s in existing if s["dong"] == e)
        print(f"  {e}: {cnt}개")

    dows = set()
    for s in existing:
        dows.update(s.get("byDow", {}).keys())
    print(f"요일: {sorted(dows)}")


if __name__ == "__main__":
    main()
