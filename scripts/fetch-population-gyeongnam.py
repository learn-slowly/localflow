#!/usr/bin/env python3
"""경남 전체 시군구 인구 데이터 수집 → 경계 GeoJSON에 병합"""

import json
import os
import time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")
BASE_URL = "https://apis.data.go.kr/1741000/stdgPpltnHhStus/selectStdgPpltnHhStus"

# 경남 시군구별 법정동코드 상위 5자리 → 10자리 (뒤에 00000 붙임)
# 인구 API는 stdgCd에 시군구 10자리를 넣으면 해당 시군구 법정동 전체 반환
GYEONGNAM_CITIES = {
    "48121": "경상남도 창원시의창구",
    "48123": "경상남도 창원시성산구",
    "48125": "경상남도 창원시마산합포구",
    "48127": "경상남도 창원시마산회원구",
    "48129": "경상남도 창원시진해구",
    "48170": "경상남도 진주시",
    "48220": "경상남도 통영시",
    "48240": "경상남도 사천시",
    "48250": "경상남도 김해시",
    "48270": "경상남도 밀양시",
    "48310": "경상남도 거제시",
    "48330": "경상남도 양산시",
    "48720": "경상남도 의령군",
    "48730": "경상남도 함안군",
    "48740": "경상남도 창녕군",
    "48820": "경상남도 고성군",
    "48840": "경상남도 남해군",
    "48850": "경상남도 하동군",
    "48860": "경상남도 산청군",
    "48870": "경상남도 함양군",
    "48880": "경상남도 거창군",
    "48890": "경상남도 합천군",
}


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
        "lv": "3",  # 읍면동 레벨
        "regSeCd": "1",  # 전체
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
        print(f"  오류: {e}")
        return []


def load_boundary():
    """전국 경계 GeoJSON 로드"""
    path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "nationwide-boundary.json")
    with open(path, "r") as f:
        return json.load(f)


def build_legal_to_admin_map(boundary, sgg_code: str) -> dict:
    """
    법정동코드(adm_cd2) → 행정동명 매핑 생성
    전국 경계의 각 feature는 행정동 단위이고, adm_cd2는 대표 법정동코드
    하지만 하나의 행정동에 여러 법정동이 있을 수 있음
    """
    mapping = {}
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] == sgg_code:
            # adm_nm에서 행정동명 추출 (예: "경상남도 진주시 문산읍" → "문산읍")
            parts = p["adm_nm"].split()
            dong_name = parts[-1] if len(parts) >= 3 else p["adm_nm"]
            adm_cd2 = p["adm_cd2"]
            mapping[adm_cd2] = dong_name
    return mapping


def merge_population_to_boundary(boundary, sgg_code: str, pop_items: list):
    """인구 데이터를 경계 GeoJSON features에 병합"""
    # 법정동코드 → 인구 데이터 매핑
    pop_by_code = {}
    for item in pop_items:
        code = item["stdgCd"]
        pop_by_code[code] = {
            "population": int(item.get("totNmprCnt", 0)),
            "households": int(item.get("hhCnt", 0)),
            "male": int(item.get("maleNmprCnt", 0)),
            "female": int(item.get("femlNmprCnt", 0)),
        }

    # 행정동별 인구 합산 (여러 법정동 → 하나의 행정동)
    admin_pop = {}
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        adm_cd2 = p["adm_cd2"]
        parts = p["adm_nm"].split()
        dong_name = parts[-1] if len(parts) >= 3 else p["adm_nm"]

        # adm_cd2의 앞 8자리가 같은 법정동 인구를 합산
        prefix = adm_cd2[:5]
        matched_pop = {"population": 0, "households": 0, "male": 0, "female": 0}
        for code, data in pop_by_code.items():
            if code.startswith(prefix) or code == adm_cd2:
                # 더 정밀한 매칭: 법정동코드와 행정동코드 비교
                pass
            if code == adm_cd2:
                matched_pop = data
                break

        admin_pop[dong_name] = matched_pop

    # 법정동 인구를 행정동 이름 기준으로 재집계
    # 인구 API는 법정동 단위인데, 경계 데이터는 행정동 단위
    # 가장 정확한 방법: 인구 API 항목의 stdgNm(법정동명)을 사용하여
    # 동일 행정동에 속하는 법정동 인구를 합산
    dong_pop = {}
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        if dong_name not in dong_pop:
            dong_pop[dong_name] = {"population": 0, "households": 0, "male": 0, "female": 0}

    # 인구 항목을 행정동에 매핑 (법정동명이 행정동명과 일치하지 않을 수 있음)
    # 경계 데이터의 adm_cd2와 인구 데이터의 stdgCd가 같은 prefix를 공유하면 매핑
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] != sgg_code:
            continue
        parts = p["adm_nm"].split()
        dong_name = parts[-1]
        adm_cd2_prefix = p["adm_cd2"][:7]  # 읍면동 레벨 (7자리)

        total = {"population": 0, "households": 0, "male": 0, "female": 0}
        for item in pop_items:
            if item["stdgCd"][:7] == adm_cd2_prefix:
                total["population"] += int(item.get("totNmprCnt", 0))
                total["households"] += int(item.get("hhCnt", 0))
                total["male"] += int(item.get("maleNmprCnt", 0))
                total["female"] += int(item.get("femlNmprCnt", 0))

        dong_pop[dong_name] = total

    return dong_pop


def main():
    if not API_KEY:
        print("DATA_GO_KR_API_KEY 환경변수를 설정해주세요")
        return

    boundary = load_boundary()
    output_dir = os.path.join(os.path.dirname(__file__), "..", "src", "data", "population")
    os.makedirs(output_dir, exist_ok=True)

    for sgg_code, city_name in GYEONGNAM_CITIES.items():
        short_name = city_name.split()[-1]  # "진주시", "창원시의창구" 등
        print(f"\n[{sgg_code}] {short_name} 인구 수집 중...")

        pop_items = fetch_population(sgg_code)
        print(f"  법정동 {len(pop_items)}개 조회됨")

        if not pop_items:
            print(f"  데이터 없음, 건너뜀")
            continue

        dong_pop = merge_population_to_boundary(boundary, sgg_code, pop_items)
        print(f"  행정동 {len(dong_pop)}개로 합산")

        # 행정동별 인구를 경계 GeoJSON에 병합하여 저장
        city_features = []
        for f in boundary["features"]:
            p = f["properties"]
            if p["sgg"] != sgg_code:
                continue
            parts = p["adm_nm"].split()
            dong_name = parts[-1]
            pop_data = dong_pop.get(dong_name, {})

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
                },
                "geometry": f["geometry"],
            }
            city_features.append(new_feature)

        geojson = {"type": "FeatureCollection", "features": city_features}
        filename = f"{sgg_code}-population.json"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False)

        total_pop = sum(d.get("population", 0) for d in dong_pop.values())
        print(f"  저장: {filename} (총 인구: {total_pop:,})")

        time.sleep(0.5)  # API 부하 방지

    print("\n완료!")


if __name__ == "__main__":
    main()
