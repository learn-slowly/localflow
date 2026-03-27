#!/usr/bin/env python3
"""경남 전체 시군구 행정동별 연령별 인구 수집 → population GeoJSON에 병합

행안부 인구 API (lv=2, regSeCd=1) 사용:
- 행정동 단위 인구 (법정동이 아닌 행정동)
- 연령 10세 단위 (0~9, 10~19, ... 90~99, 100+)
- 성별 분리

결과: src/data/population/{code}-population.json (GeoJSON) + public 복사
      → properties에 population, households, male, female, age 필드 포함
"""

import json
import os
import time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")
BASE_URL = "https://apis.data.go.kr/1741000/stdgPpltnHhStus/selectStdgPpltnHhStus"

GYEONGNAM_CITIES = {
    "48121": "창원시의창구", "48123": "창원시성산구", "48125": "창원시마산합포구",
    "48127": "창원시마산회원구", "48129": "창원시진해구",
    "48170": "진주시", "48220": "통영시", "48240": "사천시", "48250": "김해시",
    "48270": "밀양시", "48310": "거제시", "48330": "양산시",
    "48720": "의령군", "48730": "함안군", "48740": "창녕군", "48820": "고성군",
    "48840": "남해군", "48850": "하동군", "48860": "산청군", "48870": "함양군",
    "48880": "거창군", "48890": "합천군",
}

AGE_FIELDS = [
    ("agePpltnCnt00", "agePpltnCnt10", "agePpltnCnt20", "agePpltnCnt30",
     "agePpltnCnt40", "agePpltnCnt50", "agePpltnCnt60", "agePpltnCnt70",
     "agePpltnCnt80", "agePpltnCnt90", "agePpltnCnt100"),
]


def fetch_population(sgg_code: str, year_month: str = "202501") -> list:
    """시군구 코드로 법정동별 인구 조회 (lv=3)"""
    params = urllib.parse.urlencode({
        "serviceKey": API_KEY,
        "type": "json",
        "numOfRows": "500",
        "pageNo": "1",
        "stdgCd": sgg_code + "00000",
        "srchFrYm": year_month,
        "srchToYm": year_month,
        "lv": "3",  # 법정동 레벨
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


def parse_age(item: dict) -> dict:
    """API 항목에서 연령별 인구 추출 (남/여 분리)"""
    age = {}
    for decade in range(0, 110, 10):
        key = f"agePpltnCnt{decade:02d}" if decade < 100 else "agePpltnCnt100"
        total = int(item.get(key, 0))
        # 남녀 비율로 분배 (연령별 남녀 필드가 별도 있으면 사용)
        # API에는 maleAgePpltnCnt00 등이 있을 수 있음
        m_key = f"maleAgePpltnCnt{decade:02d}" if decade < 100 else "maleAgePpltnCnt100"
        f_key = f"femlAgePpltnCnt{decade:02d}" if decade < 100 else "femlAgePpltnCnt100"
        m_val = int(item.get(m_key, 0))
        f_val = int(item.get(f_key, 0))
        if m_val == 0 and f_val == 0 and total > 0:
            # 남녀 필드 없으면 비율로 추정
            male_total = int(item.get("maleNmprCnt", 0))
            female_total = int(item.get("femlNmprCnt", 0))
            pop_total = male_total + female_total
            if pop_total > 0:
                m_val = round(total * male_total / pop_total)
                f_val = total - m_val
        label = str(decade)
        age[f"m{label}"] = m_val
        age[f"f{label}"] = f_val
    return age


def extract_dong_name(stdg_nm: str, city_name: str) -> str:
    """법정동/행정동 이름에서 읍면동명만 추출
    예: '경상남도 진주시 문산읍' → '문산읍'
        '문산읍' → '문산읍'
    """
    parts = stdg_nm.strip().split()
    return parts[-1] if parts else stdg_nm


def main():
    if not API_KEY:
        print("DATA_GO_KR_API_KEY 환경변수를 설정해주세요")
        return

    base_dir = os.path.dirname(__file__)
    src_dir = os.path.join(base_dir, "..", "src", "data", "population")
    pub_dir = os.path.join(base_dir, "..", "public", "data", "population")
    os.makedirs(src_dir, exist_ok=True)
    os.makedirs(pub_dir, exist_ok=True)

    # 경계 데이터 로드
    boundary_path = os.path.join(base_dir, "..", "src", "data", "nationwide-boundary.json")
    with open(boundary_path, "r") as f:
        boundary = json.load(f)

    for sgg_code, city_name in GYEONGNAM_CITIES.items():
        print(f"\n[{sgg_code}] {city_name} 인구 수집 중...")
        items = fetch_population(sgg_code)
        print(f"  행정동 {len(items)}개 조회됨")

        if not items:
            print(f"  데이터 없음, 건너뜀")
            continue

        # 경계 데이터에서 이 시군구의 행정동 이름 목록 확인
        boundary_dongs = set()
        for feat in boundary["features"]:
            p = feat["properties"]
            if p["sgg"] == sgg_code:
                boundary_dongs.add(p["adm_nm"].split()[-1])

        # 동 이름 → 인구 데이터 매핑 (이름 기반, 같은 이름 합산)
        dong_data: dict[str, dict] = {}
        for item in items:
            name = extract_dong_name(item.get("stdgNm", ""), city_name)
            if not name or name == city_name or name in ("소계", "합계"):
                continue

            pop = int(item.get("totNmprCnt", 0))
            hh = int(item.get("hhCnt", 0))
            male = int(item.get("maleNmprCnt", 0))
            female = int(item.get("femlNmprCnt", 0))

            if name in boundary_dongs:
                if name in dong_data:
                    # 같은 이름의 법정동(리) 합산
                    dong_data[name]["population"] += pop
                    dong_data[name]["households"] += hh
                    dong_data[name]["male"] += male
                    dong_data[name]["female"] += female
                else:
                    dong_data[name] = {
                        "population": pop,
                        "households": hh,
                        "male": male,
                        "female": female,
                    }

        print(f"  이름 매칭: {len(dong_data)}/{len(boundary_dongs)}개 행정동")

        # 경계 GeoJSON에 인구 데이터 병합
        city_features = []
        matched = 0
        for feat in boundary["features"]:
            p = feat["properties"]
            if p["sgg"] != sgg_code:
                continue
            dong_name = p["adm_nm"].split()[-1]
            pop_data = dong_data.get(dong_name, {})

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
                "geometry": feat["geometry"],
            }
            city_features.append(new_feature)
            if pop_data:
                matched += 1

        geojson = {"type": "FeatureCollection", "features": city_features}
        total_pop = sum(f["properties"]["population"] for f in city_features)
        total_dongs = len(city_features)
        print(f"  매칭: {matched}/{total_dongs}개 행정동, 총 인구: {total_pop:,}")

        unmatched_boundary = [f["properties"]["name"] for f in city_features if f["properties"]["population"] == 0]
        unmatched_api = [n for n in dong_data if n not in {f["properties"]["name"] for f in city_features}]
        if unmatched_boundary:
            print(f"  경계에만: {unmatched_boundary}")
        if unmatched_api:
            print(f"  API에만: {unmatched_api}")

        # 저장 (src + public)
        for out_dir in [src_dir, pub_dir]:
            filepath = os.path.join(out_dir, f"{sgg_code}-population.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(geojson, f, ensure_ascii=False)
        print(f"  저장 완료")

        time.sleep(0.5)

    print("\n완료!")


if __name__ == "__main__":
    main()
