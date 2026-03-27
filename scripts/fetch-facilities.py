#!/usr/bin/env python3
"""진주시 주요시설 수집 → jinju-facilities.json 생성"""

import json
import urllib.request
import ssl
import time
import math
import os

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = "JG87ETU4-JG87-JG87-JG87-JG87ETU4XZ"
BASE = "https://safemap.go.kr/openapi2"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# 진주시 좌표 범위 (WGS84)
JINJU_BOUNDS = {
    "lat_min": 35.05, "lat_max": 35.35,
    "lng_min": 127.85, "lng_max": 128.25,
}

# EPSG:3857 → WGS84 변환
def epsg3857_to_wgs84(x, y):
    lng = (x / 20037508.34) * 180
    lat = (y / 20037508.34) * 180
    lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180)) - math.pi / 2)
    return lat, lng

def is_in_jinju_wgs84(lat, lng):
    b = JINJU_BOUNDS
    return b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]

# sgg_cd 기반 API (관공서, 학교, 어린이놀이시설, 우수다중시설, 유아시설, 약자보호시설)
SGG_APIS = [
    ("IF_0031", "관공서"),
    ("IF_0005", "우수다중시설"),
    ("IF_0007", "어린이놀이시설"),
    ("IF_0034", "대학교"),
    ("IF_0035", "초중고"),
    ("IF_0037", "유아시설"),
    ("IF_0053", "약자보호시설"),
]

# 병의원 계열 API (lat/lon 기반)
MEDICAL_APIS = [
    ("IF_0022", "종합병원"),
    ("IF_0024", "보건소"),
    ("IF_0025", "산재지정병원"),
    ("IF_0026", "병의원"),
    ("IF_0027", "요양병원"),
    ("IF_0028", "한방병의원"),
    ("IF_0029", "치과병의원"),
    ("IF_0048", "약국"),
]


def fetch_page(api_id, page, num=1000):
    url = f"{BASE}/{api_id}?serviceKey={API_KEY}&numOfRows={num}&pageNo={page}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as resp:
                data = json.loads(resp.read())
            body = data.get("body", {})
            items = body.get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]
            total = int(body.get("totalCount", 0))
            return items, total
        except Exception as e:
            if attempt < 2:
                time.sleep(1)
                continue
            print(f"    Error: {e}")
            return [], 0


def collect_sgg_api(api_id, category):
    """sgg_cd=48170 으로 필터링하는 API"""
    print(f"\n[{category}] ({api_id})")
    results = []
    page = 1
    while True:
        items, total = fetch_page(api_id, page)
        if not items:
            break
        if page == 1:
            print(f"  총 {total}건")

        for item in items:
            if item.get("sgg_cd") != "48170":
                continue
            x = item.get("x")
            y = item.get("y")
            if not x or not y:
                continue
            lat, lng = epsg3857_to_wgs84(float(x), float(y))
            results.append({
                "name": item.get("fclty_nm", ""),
                "category": category,
                "type": item.get("fclty_ty", category),
                "address": item.get("rn_adres", "") or item.get("adres", ""),
                "tel": item.get("telno", ""),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            })

        total_pages = (total + 999) // 1000
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.1)

    print(f"  진주 {len(results)}건")
    return results


def collect_medical_api(api_id, category):
    """lat/lon 기반 병의원 API — 주소에 '진주' 포함 or 좌표 범위"""
    print(f"\n[{category}] ({api_id})")
    results = []
    page = 1
    while True:
        items, total = fetch_page(api_id, page)
        if not items:
            break
        if page == 1:
            print(f"  총 {total}건")

        for item in items:
            # lat/lon이 있으면 좌표 기준, 없으면 x/y 변환
            lat = item.get("lat")
            lng = item.get("lon")
            if lat and lng:
                lat, lng = float(lat), float(lng)
            else:
                x = item.get("x")
                y = item.get("y")
                if not x or not y:
                    continue
                lat, lng = epsg3857_to_wgs84(float(x), float(y))

            if not is_in_jinju_wgs84(lat, lng):
                continue

            addr = item.get("dutyaddr", "") or item.get("rn_adres", "") or ""
            results.append({
                "name": item.get("dutyname", "") or item.get("fclty_nm", ""),
                "category": category,
                "type": item.get("dutydivname", "") or category,
                "address": addr,
                "tel": item.get("dutytel1", "") or item.get("telno", ""),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            })

        total_pages = (total + 999) // 1000
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.1)

    print(f"  진주 {len(results)}건")
    return results


def main():
    all_facilities = []

    for api_id, category in SGG_APIS:
        facilities = collect_sgg_api(api_id, category)
        all_facilities.extend(facilities)

    for api_id, category in MEDICAL_APIS:
        facilities = collect_medical_api(api_id, category)
        all_facilities.extend(facilities)

    # 카테고리별 통계
    from collections import Counter
    cats = Counter(f["category"] for f in all_facilities)
    print(f"\n총 {len(all_facilities)}건")
    for cat, cnt in cats.most_common():
        print(f"  {cat}: {cnt}건")

    out_path = os.path.join(OUT_DIR, "jinju-facilities.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_facilities, f, ensure_ascii=False, indent=2)
    print(f"\n저장: {out_path}")


if __name__ == "__main__":
    main()
