#!/usr/bin/env python3
"""경로당 주소 → 좌표 변환 (카카오 REST API) → 시설 데이터에 추가"""

import json
import urllib.request
import urllib.parse
import time
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
INPUT = os.path.join(DATA_DIR, "jinju-senior-centers.json")
FACILITIES = os.path.join(DATA_DIR, "jinju-facilities.json")


def geocode(address):
    """Nominatim (OpenStreetMap) 주소 검색으로 좌표 변환"""
    url = "https://nominatim.openstreetmap.org/search"
    params = urllib.parse.urlencode({
        "q": address, "format": "json", "limit": 1, "countrycodes": "kr",
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


def keyword_search(query):
    """Nominatim 키워드 검색 (주소 검색 실패 시 fallback)"""
    return geocode(query)


def main():
    with open(INPUT, encoding="utf-8") as f:
        centers = json.load(f)

    geocoded = 0
    failed = []

    for i, c in enumerate(centers):
        addr = c.get("address", "")
        name = c.get("name", "")

        if not addr and not name:
            continue

        # 주소가 있으면 주소 검색
        lat, lng = None, None
        if addr:
            # "진주시" 앞에 "경상남도" 추가
            full_addr = addr if "경상남도" in addr else f"경상남도 {addr}"
            lat, lng = geocode(full_addr)

        # 주소 검색 실패 시 키워드 검색
        if not lat:
            keyword = f"진주시 {name}경로당" if "경로당" not in name else f"진주시 {name}"
            lat, lng = keyword_search(keyword)

        if lat and lng:
            c["lat"] = lat
            c["lng"] = lng
            geocoded += 1
        else:
            failed.append(name)

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(centers)} 처리 ({geocoded}개 성공)")
        time.sleep(1.1)  # Nominatim 속도 제한: 1초당 1건

    print(f"\n좌표 변환: {geocoded}/{len(centers)} 성공")
    if failed:
        print(f"실패 {len(failed)}개: {failed[:10]}...")

    # 좌표 있는 경로당만 시설 데이터에 추가
    with open(FACILITIES, encoding="utf-8") as f:
        facilities = json.load(f)

    # 기존 경로당 제거 (재실행 대비)
    if isinstance(facilities, list):
        facilities = [f for f in facilities if f.get("category") != "경로당"]
    elif isinstance(facilities, dict):
        facilities = {k: v for k, v in facilities.items() if k != "경로당"}

    new_facilities = []
    for c in centers:
        if not c.get("lat") or not c.get("lng"):
            continue
        new_facilities.append({
            "name": c["name"] + ("경로당" if "경로당" not in c["name"] else ""),
            "category": "경로당",
            "type": "경로당",
            "address": c.get("address", ""),
            "tel": "",
            "lat": c["lat"],
            "lng": c["lng"],
            "members": c.get("members", 0),
        })

    if isinstance(facilities, list):
        facilities.extend(new_facilities)
    elif isinstance(facilities, dict):
        facilities["경로당"] = new_facilities

    with open(FACILITIES, "w", encoding="utf-8") as f:
        json.dump(facilities, f, ensure_ascii=False, indent=2)

    # 경로당 JSON도 좌표 포함하여 업데이트
    with open(INPUT, "w", encoding="utf-8") as f:
        json.dump(centers, f, ensure_ascii=False, indent=2)

    print(f"\n시설 데이터에 경로당 {len(new_facilities)}개 추가")
    print(f"저장: {FACILITIES}")


if __name__ == "__main__":
    main()
