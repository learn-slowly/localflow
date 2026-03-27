#!/usr/bin/env python3
"""종교시설 CSV → 주소 기반 좌표 매핑 → jinju-facilities.json에 병합"""

import csv
import json
import random
import re
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "경상남도 진주시_종교시설현황_20250620.csv")
BOUNDARY_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "jinju-boundary.json")
FACILITIES_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "jinju-facilities.json")
PUBLIC_PATH = os.path.join(os.path.dirname(__file__), "..", "public", "data", "jinju-facilities.json")


def build_dong_centers(boundary_path):
    """행정동 경계 데이터에서 각 동의 중심 좌표 추출"""
    with open(boundary_path, encoding="utf-8") as f:
        data = json.load(f)

    centers = {}
    for feat in data["features"]:
        name = feat["properties"].get("name", "")
        coords = feat["geometry"]["coordinates"]
        if feat["geometry"]["type"] == "MultiPolygon":
            pts = coords[0][0]
        else:
            pts = coords[0]
        avg_lng = sum(p[0] for p in pts) / len(pts)
        avg_lat = sum(p[1] for p in pts) / len(pts)
        centers[name] = (avg_lat, avg_lng)
    return centers


def build_legal_dong_centers(path):
    """법정동 경계에서 중심 좌표 추출"""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    centers = {}
    for feat in data["features"]:
        name = feat["properties"].get("name", "") or feat["properties"].get("adm_nm", "").split()[-1]
        coords = feat["geometry"]["coordinates"]
        if feat["geometry"]["type"] == "MultiPolygon":
            pts = coords[0][0]
        else:
            pts = coords[0]
        avg_lng = sum(p[0] for p in pts) / len(pts)
        avg_lat = sum(p[1] for p in pts) / len(pts)
        centers[name] = (avg_lat, avg_lng)
    return centers

# 진주시 주요 도로명 → 근처 법정동 매핑 (대략적)
ROAD_TO_DONG = {
    "남강로": "칠암동", "진주대로": "상대동", "모덕로": "상대동",
    "진양호로": "상대동", "창렬로": "대안동", "동진로": "봉곡동",
    "천수로": "상봉동", "강남로": "하대동", "촉석로": "남성동",
    "하대로": "하대동", "에나로": "중안동", "비봉로": "비봉산",
    "초전로": "초전동", "충의로": "중안동", "금산로": "금산면",
    "미천로": "미천면", "망경로": "봉곡동", "사봉로": "사봉면",
    "대곡로": "대곡면", "집현로": "집현면", "이현로": "이현동",
    "논개로": "대안동", "옥봉로": "중안동", "봉래로": "봉래동",
    "평거로": "평거동", "신안로": "신안동", "칠암로": "칠암동",
    "수정로": "수정동", "인사로": "인사동",
    "대신로": "상대동", "진주성로": "남성동", "의병로": "계동",
    "진산로": "상대동", "서장대로": "남성동", "돗골로": "하대동",
    "공단로": "상대동", "석갑로": "상대동", "동부로": "상대동",
    "망경남길": "봉곡동", "향교로": "봉곡동", "장대로": "남성동",
    "계봉로": "계동", "정촌로": "정촌면", "문산로": "문산읍",
    "지수로": "지수면", "수곡로": "수곡면", "명석로": "명석면",
}


def extract_dong(address):
    """주소에서 읍/면/동 이름 추출 (행정동 우선, 도로명 fallback)"""
    # 1) 읍/면/동 직접 추출
    m = re.search(r'진주시\s+(\S+[읍면동])', address)
    if m:
        return m.group(1)
    # 2) 도로명에서 매핑 ("진주시 남강로 626" 또는 "진주시 남강로626번길")
    m2 = re.search(r'진주시\s+([가-힣]+(?:로|길))', address)
    if m2:
        road = m2.group(1)
        for road_prefix, dong in ROAD_TO_DONG.items():
            if road.startswith(road_prefix):
                return dong
    return None


def main():
    # 행정동 + 법정동 중심 좌표
    dong_centers = build_dong_centers(BOUNDARY_PATH)
    legal_path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "jinju-legal-boundary.json")
    legal_centers = build_legal_dong_centers(legal_path)
    dong_centers.update(legal_centers)  # 법정동이 더 세밀하므로 덮어쓰기
    print(f"행정동+법정동 {len(dong_centers)}개 좌표 로드")

    # CSV 읽기
    with open(CSV_PATH, encoding="euc-kr") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"종교시설 CSV: {len(rows)}건")

    # 좌표 매핑
    results = []
    matched = 0
    unmatched = 0
    unmatched_dongs = set()

    random.seed(42)  # 재현 가능한 랜덤

    for row in rows:
        addr = row["주소"].strip()
        name = row["종교시설명"].strip()
        religion = row["종교구분"].strip()
        tel = row["전화번호"].strip()

        dong = extract_dong(addr)
        if dong and dong in dong_centers:
            base_lat, base_lng = dong_centers[dong]
            # 동 중심에서 ±0.005도 (~500m) 랜덤 오프셋
            lat = base_lat + random.uniform(-0.005, 0.005)
            lng = base_lng + random.uniform(-0.005, 0.005)
            results.append({
                "name": name,
                "category": "종교시설",
                "type": religion,
                "address": addr,
                "tel": tel,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            })
            matched += 1
        else:
            unmatched += 1
            if dong:
                unmatched_dongs.add(dong)

    print(f"좌표 매핑: 성공 {matched}, 실패 {unmatched}")
    if unmatched_dongs:
        print(f"미매핑 동: {sorted(unmatched_dongs)}")

    # 기존 시설 데이터 로드
    with open(FACILITIES_PATH, "r", encoding="utf-8") as f:
        facilities = json.load(f)

    # 기존 종교시설 제거 (재실행 대비)
    before = len(facilities)
    facilities = [f for f in facilities if f["category"] != "종교시설"]
    if before != len(facilities):
        print(f"기존 종교시설 {before - len(facilities)}건 제거")

    # 병합
    facilities.extend(results)
    print(f"병합 후 총 {len(facilities)}건")

    # 저장
    with open(FACILITIES_PATH, "w", encoding="utf-8") as f:
        json.dump(facilities, f, ensure_ascii=False, indent=2)
    with open(PUBLIC_PATH, "w", encoding="utf-8") as f:
        json.dump(facilities, f, ensure_ascii=False, indent=2)

    print(f"저장 완료")

    # 종교별 통계
    from collections import Counter
    cats = Counter(r["type"] for r in results)
    for c, n in cats.most_common():
        print(f"  {c}: {n}건")


if __name__ == "__main__":
    main()
