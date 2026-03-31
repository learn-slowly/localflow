#!/usr/bin/env python3
"""파주시 인구 데이터 수집 → 경계 GeoJSON에 병합"""

import json
import os
import time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")
BASE_URL = "https://apis.data.go.kr/1741000/stdgPpltnHhStus/selectStdgPpltnHhStus"
AGE_URL = "https://apis.data.go.kr/1741000/stdgPpltnAgeStus/selectStdgPpltnAgeStus"

SGG_CODE = "41480"
CITY_NAME = "경기도 파주시"


def fetch_population(sgg_code: str, year_month: str = "202501") -> list:
    """시군구 코드로 법정동별 인구 조회"""
    params = urllib.parse.urlencode({
        "serviceKey": API_KEY,
        "type": "json",
        "numOfRows": "500",
        "pageNo": "1",
        "stdgCd": sgg_code + "00000",
        "srchFrYm": year_month,
        "srchToYm": year_month,
        "lv": "3",
        "regSeCd": "1",
    })
    url = f"{BASE_URL}?{params}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read())
        items = data.get("Response", {}).get("items", {}).get("item", [])
        if isinstance(items, dict):
            items = [items]
        return items
    except Exception as e:
        print(f"  인구 오류: {e}")
        return []


def fetch_age_population(sgg_code: str, year_month: str = "202501") -> list:
    """시군구 코드로 법정동별 연령별 인구 조회"""
    params = urllib.parse.urlencode({
        "serviceKey": API_KEY,
        "type": "json",
        "numOfRows": "500",
        "pageNo": "1",
        "stdgCd": sgg_code + "00000",
        "srchFrYm": year_month,
        "srchToYm": year_month,
        "lv": "3",
        "regSeCd": "1",
    })
    url = f"{AGE_URL}?{params}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.loads(res.read())
        items = data.get("Response", {}).get("items", {}).get("item", [])
        if isinstance(items, dict):
            items = [items]
        return items
    except Exception as e:
        print(f"  연령별 오류: {e}")
        return []


def load_boundary():
    """전국 경계 GeoJSON 로드"""
    path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "nationwide-boundary.json")
    with open(path, "r") as f:
        return json.load(f)


def merge_population_to_boundary(boundary, sgg_code: str, pop_items: list):
    """인구 데이터를 행정동별로 합산"""
    dong_pop = {}
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        if dong_name not in dong_pop:
            dong_pop[dong_name] = {"population": 0, "households": 0, "male": 0, "female": 0}

    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        adm_cd2_prefix = p["adm_cd2"][:7]

        total = {"population": 0, "households": 0, "male": 0, "female": 0}
        for item in pop_items:
            if item["stdgCd"][:7] == adm_cd2_prefix:
                total["population"] += int(item.get("totNmprCnt", 0))
                total["households"] += int(item.get("hhCnt", 0))
                total["male"] += int(item.get("maleNmprCnt", 0))
                total["female"] += int(item.get("femlNmprCnt", 0))

        dong_pop[dong_name] = total

    return dong_pop


def merge_age_to_boundary(boundary, sgg_code: str, age_items: list):
    """연령별 인구 데이터를 행정동별로 합산"""
    dong_age = {}

    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        adm_cd2_prefix = p["adm_cd2"][:7]

        age = {}
        for item in age_items:
            if item["stdgCd"][:7] != adm_cd2_prefix:
                continue
            for decade in range(0, 110, 10):
                key = f"{decade:03d}"
                mk = f"m{decade}"
                fk = f"f{decade}"
                age[mk] = age.get(mk, 0) + int(item.get(f"male{key}AgePpltnCnt", 0))
                age[fk] = age.get(fk, 0) + int(item.get(f"feml{key}AgePpltnCnt", 0))

        dong_age[dong_name] = age

    return dong_age


def main():
    if not API_KEY:
        print("DATA_GO_KR_API_KEY 환경변수를 설정해주세요")
        return

    boundary = load_boundary()
    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data", "population")
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n[{SGG_CODE}] 파주시 인구 수집 중...")
    pop_items = fetch_population(SGG_CODE)
    print(f"  법정동 {len(pop_items)}개 조회됨")

    if not pop_items:
        print("  인구 데이터 없음!")
        return

    dong_pop = merge_population_to_boundary(boundary, SGG_CODE, pop_items)
    print(f"  행정동 {len(dong_pop)}개로 합산")

    time.sleep(0.5)

    print(f"  연령별 인구 수집 중...")
    age_items = fetch_age_population(SGG_CODE)
    print(f"  연령별 {len(age_items)}개 조회됨")
    dong_age = merge_age_to_boundary(boundary, SGG_CODE, age_items)

    # GeoJSON 생성
    city_features = []
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != SGG_CODE:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        pop_data = dong_pop.get(dong_name, {})
        age_data = dong_age.get(dong_name, {})

        new_feature = {
            "type": "Feature",
            "properties": {
                "name": dong_name,
                "fullName": p["adm_nm"],
                "code": p["adm_cd2"],
                "population": pop_data.get("population", 0),
                "households": pop_data.get("households", 0),
                "male": pop_data.get("male", 0),
                "female": pop_data.get("female", 0),
                "age": age_data,
            },
            "geometry": f["geometry"],
        }
        city_features.append(new_feature)

    geojson = {"type": "FeatureCollection", "features": city_features}
    filepath = os.path.join(output_dir, f"{SGG_CODE}-population.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    total_pop = sum(d.get("population", 0) for d in dong_pop.values())
    print(f"  저장: {SGG_CODE}-population.json (총 인구: {total_pop:,})")
    print("완료!")


if __name__ == "__main__":
    main()
