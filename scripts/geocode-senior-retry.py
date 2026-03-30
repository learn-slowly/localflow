#!/usr/bin/env python3
"""좌표 미확보 경로당 재시도 (주소 단순화 + 키워드 검색)"""

import json
import re
import urllib.request
import urllib.parse
import time
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
INPUT = os.path.join(DATA_DIR, "jinju-senior-centers.json")
FACILITIES = os.path.join(DATA_DIR, "jinju-facilities.json")
PUBLIC_FACILITIES = os.path.join(os.path.dirname(__file__), "..", "public", "data", "facilities", "48170-facilities.json")


def nominatim(query):
    url = "https://nominatim.openstreetmap.org/search"
    params = urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "kr",
    })
    req = urllib.request.Request(
        f"{url}?{params}",
        headers={"User-Agent": "LocalFlow/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None, None


def simplify_address(addr):
    """주소에서 괄호, 층수, 중복 제거"""
    s = re.sub(r'\(.*?\)', '', addr).strip()
    s = re.sub(r'\d+층', '', s).strip()
    s = re.sub(r',\s*$', '', s).strip()
    # "진주시 진주시" 중복 제거
    s = re.sub(r'진주시\s+진주시', '진주시', s)
    # 경상남도 접두어 추가
    if '경상남도' not in s:
        s = f'경상남도 {s}'
    return s


def main():
    with open(INPUT, encoding="utf-8") as f:
        centers = json.load(f)

    before = sum(1 for c in centers if c.get("lat"))
    no_coord = [c for c in centers if not c.get("lat")]
    print(f"기존 좌표: {before}개, 미확보: {len(no_coord)}개")

    success = 0
    for i, c in enumerate(centers):
        if c.get("lat"):
            continue

        addr = c.get("address", "")
        name = c.get("name", "")
        lat, lng = None, None

        # 1차: 주소 단순화 후 검색
        if addr:
            simple = simplify_address(addr)
            lat, lng = nominatim(simple)
            time.sleep(1.1)

        # 2차: 도로명만 추출 (번길까지)
        if not lat and addr:
            road = re.search(r'진주시\s+(\S+\s+\S+로\S*\s+\d[\d-]*)', addr)
            if road:
                lat, lng = nominatim(f"경상남도 진주시 {road.group(1)}")
                time.sleep(1.1)

        # 3차: "진주시 OO경로당" 키워드 검색
        if not lat and name:
            keyword = f"경상남도 진주시 {name}경로당" if "경로당" not in name else f"경상남도 진주시 {name}"
            lat, lng = nominatim(keyword)
            time.sleep(1.1)

        if lat and lng:
            c["lat"] = lat
            c["lng"] = lng
            success += 1

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(centers)} ({success}개 추가 성공)")

    after = sum(1 for c in centers if c.get("lat"))
    print(f"\n좌표 확보: {before} → {after}개 (+{success})")

    # 저장
    with open(INPUT, "w", encoding="utf-8") as f:
        json.dump(centers, f, ensure_ascii=False, indent=2)

    # 시설 데이터 갱신
    for fpath in [FACILITIES, PUBLIC_FACILITIES]:
        if not os.path.exists(fpath):
            continue
        with open(fpath, encoding="utf-8") as f:
            facilities = json.load(f)
        # 기존 경로당 제거
        facilities = [f for f in facilities if f.get("category") != "경로당"]
        # 좌표 있는 경로당 추가
        for c in centers:
            if not c.get("lat"):
                continue
            facilities.append({
                "name": c["name"] + ("경로당" if "경로당" not in c["name"] else ""),
                "category": "경로당",
                "type": "경로당",
                "address": c.get("address", ""),
                "tel": "",
                "lat": c["lat"],
                "lng": c["lng"],
            })
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(facilities, f, ensure_ascii=False, indent=2)

    senior_count = sum(1 for c in centers if c.get("lat"))
    print(f"시설 데이터에 경로당 {senior_count}개 반영")


if __name__ == "__main__":
    main()
