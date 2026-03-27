#!/usr/bin/env python3
"""경남 시군구별 주요시설 수집 → public/data/facilities/{code}-facilities.json"""

import json
import urllib.request
import ssl
import time
import math
import os
import sys
from collections import Counter, defaultdict

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

API_KEY = "JG87ETU4-JG87-JG87-JG87-JG87ETU4XZ"
BASE = "https://safemap.go.kr/openapi2"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "facilities")

# 경남 시군구 코드 → 이름, 중심좌표, 좌표범위 (WGS84)
CITIES = {
    "48121": {"name": "창원시의창구",     "center": (35.2994, 128.6546), "margin": 0.12},
    "48123": {"name": "창원시성산구",     "center": (35.2018, 128.6751), "margin": 0.12},
    "48125": {"name": "창원시마산합포구", "center": (35.1370, 128.5084), "margin": 0.12},
    "48127": {"name": "창원시마산회원구", "center": (35.2354, 128.5586), "margin": 0.10},
    "48129": {"name": "창원시진해구",     "center": (35.1243, 128.7185), "margin": 0.12},
    "48170": {"name": "진주시",           "center": (35.1800, 128.0800), "margin": 0.15},
    "48220": {"name": "통영시",           "center": (34.7925, 128.3828), "margin": 0.15},
    "48240": {"name": "사천시",           "center": (35.0335, 128.0460), "margin": 0.15},
    "48250": {"name": "김해시",           "center": (35.2642, 128.8448), "margin": 0.15},
    "48270": {"name": "밀양시",           "center": (35.4890, 128.7744), "margin": 0.20},
    "48310": {"name": "거제시",           "center": (34.8731, 128.6132), "margin": 0.15},
    "48330": {"name": "양산시",           "center": (35.3957, 129.0527), "margin": 0.15},
    "48720": {"name": "의령군",           "center": (35.3903, 128.2745), "margin": 0.15},
    "48730": {"name": "함안군",           "center": (35.2914, 128.4374), "margin": 0.12},
    "48740": {"name": "창녕군",           "center": (35.4998, 128.4969), "margin": 0.18},
    "48820": {"name": "고성군",           "center": (35.0169, 128.2773), "margin": 0.15},
    "48840": {"name": "남해군",           "center": (34.8053, 127.9534), "margin": 0.15},
    "48850": {"name": "하동군",           "center": (35.1006, 127.8007), "margin": 0.18},
    "48860": {"name": "산청군",           "center": (35.3846, 127.9092), "margin": 0.18},
    "48870": {"name": "함양군",           "center": (35.5622, 127.7277), "margin": 0.18},
    "48880": {"name": "거창군",           "center": (35.7169, 127.9054), "margin": 0.18},
    "48890": {"name": "합천군",           "center": (35.5648, 128.1596), "margin": 0.18},
}

# 경남 전체 좌표 범위 (좌표 기반 API에서 경남 필터용)
GYEONGNAM_BOUNDS = {
    "lat_min": 34.55, "lat_max": 35.95,
    "lng_min": 127.50, "lng_max": 129.30,
}


def epsg3857_to_wgs84(x, y):
    lng = (x / 20037508.34) * 180
    lat = (y / 20037508.34) * 180
    lat = 180 / math.pi * (2 * math.atan(math.exp(lat * math.pi / 180)) - math.pi / 2)
    return lat, lng


def is_in_gyeongnam(lat, lng):
    b = GYEONGNAM_BOUNDS
    return b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]


def find_city_by_coord(lat, lng):
    """좌표로 가장 가까운 시군구 찾기"""
    best_code = None
    best_dist = float("inf")
    for code, city in CITIES.items():
        clat, clng = city["center"]
        margin = city["margin"]
        if abs(lat - clat) <= margin and abs(lng - clng) <= margin:
            dist = (lat - clat) ** 2 + (lng - clng) ** 2
            if dist < best_dist:
                best_dist = dist
                best_code = code
    return best_code


# sgg_cd 기반 API (경남 전체: 48xxx)
SGG_APIS = [
    ("IF_0031", "관공서"),
    ("IF_0007", "어린이놀이시설"),
    ("IF_0034", "대학교"),
    ("IF_0053", "약자보호시설"),
]

# 좌표 기반 API (sgg_cd 없음)
COORD_APIS = [
    ("IF_0005", "우수다중시설"),
    ("IF_0035", "초중고"),
    ("IF_0037", "유아시설"),
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


def collect_sgg_api(api_id, category, target_codes):
    """sgg_cd로 필터링하는 API — 경남 시군구 전체 수집"""
    print(f"\n[{category}] ({api_id})")
    by_city = defaultdict(list)
    page = 1
    while True:
        items, total = fetch_page(api_id, page)
        if not items:
            break
        if page == 1:
            print(f"  총 {total}건")

        for item in items:
            sgg = item.get("sgg_cd", "")
            if sgg not in target_codes:
                continue
            x = item.get("x")
            y = item.get("y")
            if not x or not y:
                continue
            lat, lng = epsg3857_to_wgs84(float(x), float(y))
            by_city[sgg].append({
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

    total_count = sum(len(v) for v in by_city.values())
    print(f"  경남 {total_count}건 ({len(by_city)}개 시군구)")
    return by_city


def collect_coord_api(api_id, category, target_codes):
    """좌표 기반 API — 경남 범위 내 수집 후 시군구 분류"""
    print(f"\n[{category}] ({api_id})")
    by_city = defaultdict(list)
    page = 1
    while True:
        items, total = fetch_page(api_id, page)
        if not items:
            break
        if page == 1:
            print(f"  총 {total}건")

        for item in items:
            lat = item.get("latitude")
            lng = item.get("longitude")
            if lat and lng:
                lat, lng = float(lat), float(lng)
            else:
                x = item.get("x")
                y = item.get("y")
                if not x or not y:
                    continue
                lat, lng = epsg3857_to_wgs84(float(x), float(y))

            if not is_in_gyeongnam(lat, lng):
                continue

            city_code = find_city_by_coord(lat, lng)
            if not city_code or city_code not in target_codes:
                continue

            name = item.get("fcltynm", "") or item.get("name", "") or item.get("fclty_nm", "")
            addr = item.get("lnmadr", "") or item.get("adres", "") or item.get("rn_adres", "") or ""
            by_city[city_code].append({
                "name": name,
                "category": category,
                "type": item.get("type", category),
                "address": addr,
                "tel": "",
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            })

        total_pages = (total + 999) // 1000
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.1)

    total_count = sum(len(v) for v in by_city.values())
    print(f"  경남 {total_count}건 ({len(by_city)}개 시군구)")
    return by_city


def collect_medical_api(api_id, category, target_codes):
    """lat/lon 기반 병의원 API — 경남 범위 내 수집 후 시군구 분류"""
    print(f"\n[{category}] ({api_id})")
    by_city = defaultdict(list)
    page = 1
    while True:
        items, total = fetch_page(api_id, page)
        if not items:
            break
        if page == 1:
            print(f"  총 {total}건")

        for item in items:
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

            if not is_in_gyeongnam(lat, lng):
                continue

            city_code = find_city_by_coord(lat, lng)
            if not city_code or city_code not in target_codes:
                continue

            addr = item.get("dutyaddr", "") or item.get("rn_adres", "") or ""
            by_city[city_code].append({
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

    total_count = sum(len(v) for v in by_city.values())
    print(f"  경남 {total_count}건 ({len(by_city)}개 시군구)")
    return by_city


def main():
    # 인자로 특정 도시코드 지정 가능 (없으면 전체)
    if len(sys.argv) > 1:
        target_codes = set(sys.argv[1:])
        invalid = target_codes - set(CITIES.keys())
        if invalid:
            print(f"알 수 없는 도시코드: {invalid}")
            sys.exit(1)
    else:
        target_codes = set(CITIES.keys())

    print(f"대상: {len(target_codes)}개 시군구")
    for code in sorted(target_codes):
        print(f"  {code} {CITIES[code]['name']}")

    # 시군구별 수집 결과
    all_by_city = defaultdict(list)

    for api_id, category in SGG_APIS:
        by_city = collect_sgg_api(api_id, category, target_codes)
        for code, items in by_city.items():
            all_by_city[code].extend(items)

    for api_id, category in COORD_APIS:
        by_city = collect_coord_api(api_id, category, target_codes)
        for code, items in by_city.items():
            all_by_city[code].extend(items)

    for api_id, category in MEDICAL_APIS:
        by_city = collect_medical_api(api_id, category, target_codes)
        for code, items in by_city.items():
            all_by_city[code].extend(items)

    # 시군구별 파일 저장
    os.makedirs(OUT_DIR, exist_ok=True)
    grand_total = 0
    for code in sorted(all_by_city.keys()):
        facilities = all_by_city[code]
        if not facilities:
            continue
        out_path = os.path.join(OUT_DIR, f"{code}-facilities.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(facilities, f, ensure_ascii=False, indent=2)

        cats = Counter(fac["category"] for fac in facilities)
        print(f"\n{code} {CITIES[code]['name']}: {len(facilities)}건")
        for cat, cnt in cats.most_common():
            print(f"  {cat}: {cnt}")
        grand_total += len(facilities)

    # 데이터 없는 도시
    missing = target_codes - set(all_by_city.keys())
    if missing:
        print(f"\n데이터 없는 도시: {sorted(missing)}")

    print(f"\n총 {grand_total}건, {len(all_by_city)}개 시군구 저장 완료")


if __name__ == "__main__":
    main()
