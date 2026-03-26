#!/usr/bin/env python3
"""경남 전체 선거 데이터 수집 — 경남 일괄 조회 후 시군구별 분배"""

import json
import os
import time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")
BASE_VOTE = "https://apis.data.go.kr/9760000/VoteXmntckInfoInqireService2"

# 경남 시군구 wiwName 목록
CITY_NAMES = [
    "창원시의창구", "창원시성산구", "창원시마산합포구", "창원시마산회원구", "창원시진해구",
    "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시",
    "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군",
]

CITY_CODE_MAP = {
    "창원시의창구": "48121", "창원시성산구": "48123", "창원시마산합포구": "48125",
    "창원시마산회원구": "48127", "창원시진해구": "48129",
    "진주시": "48170", "통영시": "48220", "사천시": "48240", "김해시": "48250",
    "밀양시": "48270", "거제시": "48310", "양산시": "48330",
    "의령군": "48720", "함안군": "48730", "창녕군": "48740", "고성군": "48820",
    "남해군": "48840", "하동군": "48850", "산청군": "48860", "함양군": "48870",
    "거창군": "48880", "합천군": "48890",
}

# 창원시 구 → 시장 조회용 매핑
CHANGWON_GUS = {"창원시의창구", "창원시성산구", "창원시마산합포구", "창원시마산회원구", "창원시진해구"}

call_count = 0


def api_call(url):
    global call_count
    call_count += 1
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"    API 오류: {e}")
        return None
    finally:
        time.sleep(0.3)


def fetch_all_pages(endpoint, params):
    """페이지네이션 처리하여 전체 결과 반환"""
    all_items = []
    page = 1
    while True:
        params["pageNo"] = str(page)
        url = f"{BASE_VOTE}/{endpoint}?{urllib.parse.urlencode(params)}"
        data = api_call(url)
        if not data:
            break
        body = data.get("response", {}).get("body", {})
        items = body.get("items", {}).get("item", [])
        if isinstance(items, dict):
            items = [items]
        if not items:
            break
        all_items.extend(items)
        total = int(body.get("totalCount", 0))
        if len(all_items) >= total:
            break
        page += 1
    return all_items


def parse_result(item):
    """개표 아이템에서 후보/정당 추출"""
    candidates = []
    for n in range(1, 51):
        ns = str(n).zfill(2)
        name = (item.get(f"hbj{ns}") or "").strip()
        party = (item.get(f"jd{ns}") or "").strip()
        votes = int(item.get(f"dugsu{ns}") or "0")
        if name and votes > 0:
            candidates.append({"name": name, "party": party, "votes": votes})
    return {
        "district": item.get("sggName", ""),
        "voters": int(item.get("sunsu") or "0"),
        "turnout": int(item.get("tusu") or "0"),
        "valid": int(item.get("yutusu") or "0"),
        "invalid": int(item.get("mutusu") or "0"),
        "candidates": candidates,
    }


def collect_by_city(items, use_sgg_as_district=False):
    """API 결과를 wiwName으로 시군구별 분배, 합계 행만 추출"""
    city_results = {name: [] for name in CITY_NAMES}

    for item in items:
        wiw = item.get("wiwName", "")
        sgg = item.get("sggName", "")

        if wiw == "합계":
            # sggName에서 도시 판별
            # 대선: sggName="대한민국" → 사용 불가, 다음 행의 wiwName 사용
            # 총선: sggName="창원시의창구" 등
            # 지선 기초: sggName="창원시가선거구" 등
            continue  # 합계 행은 건너뛰고 시군구별 행 사용

        # wiwName이 시군구명인 경우
        if wiw in city_results:
            result = parse_result(item)
            if use_sgg_as_district:
                result["district"] = sgg
            else:
                result["district"] = wiw
            city_results[wiw].append(result)

    return city_results


def collect_with_total(items):
    """합계 행에서 시군구별 분배 (대선/시도지사/교육감/비례 등)"""
    city_results = {name: [] for name in CITY_NAMES}

    for item in items:
        wiw = (item.get("wiwName") or "").strip()
        if wiw in city_results:
            result = parse_result(item)
            result["district"] = wiw
            city_results[wiw].append(result)

    return city_results


def collect_local_by_sgg(items):
    """기초의원/도의원 — 선거구명에서 도시 판별, wiwName=합계인 행 사용"""
    city_results = {name: [] for name in CITY_NAMES}

    seen = set()
    for item in items:
        wiw = (item.get("wiwName") or "").strip()
        sgg = (item.get("sggName") or "").strip()

        if wiw != "합계":
            continue
        if sgg in seen:
            continue
        seen.add(sgg)

        result = parse_result(item)
        result["district"] = sgg

        # 선거구명에서 도시 판별 (예: "진주시가선거구" → "진주시")
        matched = False
        for city_name in sorted(CITY_NAMES, key=len, reverse=True):
            if sgg.startswith(city_name):
                city_results[city_name].append(result)
                matched = True
                break
        if not matched:
            # 창원시 구 단위: "창원시가선거구" → 창원시 5개 구에 분배
            if sgg.startswith("창원시"):
                # 선거구 결과를 각 구에 복사하지 않고 의창구에만 저장 (대표)
                # 실제로는 구 단위가 아닌 시 단위 선거구임
                for gu in CHANGWON_GUS:
                    city_results[gu].append(result)
                    break  # 의창구에만

    return city_results


def main():
    if not API_KEY:
        print("DATA_GO_KR_API_KEY 환경변수를 설정해주세요")
        return

    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data", "elections")
    os.makedirs(output_dir, exist_ok=True)

    # 도시별 데이터 저장소
    city_elections = {name: [] for name in CITY_NAMES}
    city_local = {name: [] for name in CITY_NAMES}

    base_params = {"serviceKey": API_KEY, "resultType": "json", "numOfRows": "500", "sdName": "경상남도"}

    # ===== 대선 =====
    for sgId, label in [("20250603", "2025 대선 (제21대)"), ("20220309", "2022 대선 (제20대)"), ("20170509", "2017 대선 (제19대)")]:
        print(f"\n{label} 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "1"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_elections[city_name].append({
                    "sgId": sgId, "label": label, "date": date,
                    "results": results[city_name],
                })

    # ===== 총선 =====
    for sgId, label in [("20240410", "2024 총선 (제22대)"), ("20200415", "2020 총선 (제21대)")]:
        print(f"\n{label} 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "2"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        # 총선은 sggName이 선거구명, wiwName이 시군구명
        results = collect_by_city(items, use_sgg_as_district=True)
        date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_elections[city_name].append({
                    "sgId": sgId, "label": label, "date": date,
                    "results": results[city_name],
                })

    # ===== 지선 =====
    for sgId, year_label in [("20220601", "2022 지선 (제8회)"), ("20180613", "2018 지선 (제7회)")]:
        date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"

        # 시장 (sgTypecode=4)
        print(f"\n{year_label} 시장 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "4"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "4", "subType": "시장",
                    "label": f"{year_label} 시장", "date": date,
                    "results": results[city_name],
                })

        # 시도지사 (sgTypecode=3)
        print(f"  시도지사...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "3"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "3", "subType": "시도지사",
                    "label": f"{year_label} 시도지사", "date": date,
                    "results": results[city_name],
                })

        # 기초의원 (sgTypecode=6)
        print(f"  기초의원...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "6"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_local_by_sgg(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "6", "subType": "기초의원",
                    "label": f"{year_label} 기초의원", "date": date,
                    "results": results[city_name],
                })

        # 도의원 (sgTypecode=5)
        print(f"  도의원...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "5"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_local_by_sgg(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "5", "subType": "도의원",
                    "label": f"{year_label} 도의원", "date": date,
                    "results": results[city_name],
                })

        # 교육감 (sgTypecode=11)
        print(f"  교육감...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "11"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "11", "subType": "교육감",
                    "label": f"{year_label} 교육감", "date": date,
                    "results": results[city_name],
                })

        # 기초비례 (sgTypecode=9)
        print(f"  기초비례...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "9"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "9", "subType": "기초비례",
                    "label": f"{year_label} 기초비례", "date": date,
                    "results": results[city_name],
                })

        # 광역비례 (sgTypecode=8)
        print(f"  광역비례...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "8"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = collect_with_total(items)
        for city_name in CITY_NAMES:
            if results[city_name]:
                city_local[city_name].append({
                    "sgId": sgId, "sgTypecode": "8", "subType": "광역비례",
                    "label": f"{year_label} 광역비례", "date": date,
                    "results": results[city_name],
                })

    # ===== 저장 =====
    print(f"\n{'='*50}")
    print("저장 중...")
    for city_name in CITY_NAMES:
        code = CITY_CODE_MAP[city_name]
        el = city_elections[city_name]
        lo = city_local[city_name]

        with open(os.path.join(output_dir, f"{code}-elections.json"), "w", encoding="utf-8") as f:
            json.dump(el, f, ensure_ascii=False, indent=2)
        with open(os.path.join(output_dir, f"{code}-local-elections.json"), "w", encoding="utf-8") as f:
            json.dump(lo, f, ensure_ascii=False, indent=2)

        el_count = sum(len(e["results"]) for e in el)
        lo_count = sum(len(e["results"]) for e in lo)
        print(f"  [{code}] {city_name}: 일반 {len(el)}건({el_count} 선거구), 지선 {len(lo)}건({lo_count} 선거구)")

    print(f"\n총 API 호출: {call_count}건")
    print("완료!")


if __name__ == "__main__":
    main()
