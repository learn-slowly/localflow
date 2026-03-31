#!/usr/bin/env python3
"""파주시 선거 데이터 수집 — 경기도에서 파주시 추출"""

import json
import os
import time
import urllib.request
import urllib.parse

API_KEY = os.environ.get("DATA_GO_KR_API_KEY", "")
BASE_VOTE = "https://apis.data.go.kr/9760000/VoteXmntckInfoInqireService2"

SGG_CODE = "41480"
CITY_NAME = "파주시"
SD_NAME = "경기도"

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


def extract_paju(items, mode="wiw"):
    """파주시 결과만 추출"""
    results = []
    seen = set()

    for item in items:
        wiw = (item.get("wiwName") or "").strip()
        sgg = (item.get("sggName") or "").strip()

        if mode == "wiw":
            # 대선/시도지사/교육감: wiwName이 시군구명
            if wiw == CITY_NAME:
                result = parse_result(item)
                result["district"] = CITY_NAME
                results.append(result)
        elif mode == "wiw_sgg":
            # 총선: wiwName이 시군구명, sggName이 선거구명
            if wiw == CITY_NAME:
                result = parse_result(item)
                result["district"] = sgg
                results.append(result)
        elif mode == "local":
            # 기초의원/도의원: wiwName=합계인 행, sggName에서 도시 판별
            if wiw != "합계":
                continue
            if sgg in seen:
                continue
            seen.add(sgg)
            if sgg.startswith(CITY_NAME):
                result = parse_result(item)
                result["district"] = sgg
                results.append(result)

    return results


def load_boundary_dongs():
    """경계 데이터에서 파주시 행정동 목록"""
    path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "nationwide-boundary.json")
    with open(path, "r") as f:
        boundary = json.load(f)
    dongs = []
    for f in boundary["features"]:
        p = f["properties"]
        if p["sgg"] == SGG_CODE:
            parts = p["adm_nm"].split()
            dongs.append(parts[-1])
    return dongs


def fetch_dong_results(sgId, sgTypecode, dongs):
    """읍면동별 개표 결과 수집"""
    dong_results = []
    base_params = {
        "serviceKey": API_KEY, "resultType": "json", "numOfRows": "500",
        "sdName": SD_NAME, "wiwName": CITY_NAME,
    }

    params = {**base_params, "sgId": sgId, "sgTypecode": sgTypecode}
    items = fetch_all_pages("getXmntckSttusInfoInqire", params)

    # wiwName이 행정동인 행 추출
    for item in items:
        wiw = (item.get("wiwName") or "").strip()
        if wiw in dongs:
            result = parse_result(item)
            result["dong"] = wiw
            # 득표율 계산
            total_valid = result["valid"]
            rates = {}
            votes = {}
            for c in result["candidates"]:
                rate = round(c["votes"] / total_valid * 100, 1) if total_valid > 0 else 0
                rates[c["name"]] = rate
                votes[c["name"]] = c["votes"]
            dong_results.append({
                "dong": wiw,
                "district": result["district"],
                "voters": result["voters"],
                "turnout": result["turnout"],
                "rates": rates,
                "votes": votes,
            })

    return dong_results


def main():
    if not API_KEY:
        print("DATA_GO_KR_API_KEY 환경변수를 설정해주세요")
        return

    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data", "elections")
    os.makedirs(output_dir, exist_ok=True)

    dongs = load_boundary_dongs()
    print(f"파주시 행정동 {len(dongs)}개: {', '.join(dongs)}")

    elections = []
    local_elections = []
    base_params = {"serviceKey": API_KEY, "resultType": "json", "numOfRows": "500", "sdName": SD_NAME}

    # ===== 대선 =====
    for sgId, label in [("20250603", "2025 대선 (제21대)"), ("20220309", "2022 대선 (제20대)"), ("20170509", "2017 대선 (제19대)")]:
        print(f"\n{label} 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "1"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"
            dong_res = fetch_dong_results(sgId, "1", dongs)
            elections.append({
                "sgId": sgId, "label": label, "date": date,
                "results": results, "dongResults": dong_res,
            })
            print(f"  파주시 결과 {len(results)}건, 동별 {len(dong_res)}건")

    # ===== 총선 =====
    for sgId, label in [("20240410", "2024 총선 (제22대)"), ("20200415", "2020 총선 (제21대)")]:
        print(f"\n{label} 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "2"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw_sgg")
        if results:
            date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"
            dong_res = fetch_dong_results(sgId, "2", dongs)
            elections.append({
                "sgId": sgId, "label": label, "date": date,
                "results": results, "dongResults": dong_res,
            })
            print(f"  파주시 결과 {len(results)}건, 동별 {len(dong_res)}건")

    # ===== 지선 =====
    for sgId, year_label in [("20220601", "2022 지선 (제8회)"), ("20180613", "2018 지선 (제7회)")]:
        date = f"{sgId[:4]}.{sgId[4:6]}.{sgId[6:8]}"

        # 시장 (sgTypecode=4)
        print(f"\n{year_label} 시장 수집 중...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "4"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "4", "subType": "시장",
                "label": f"{year_label} 시장", "date": date,
                "results": results,
            })
            print(f"  시장 {len(results)}건")

        # 시도지사 (sgTypecode=3)
        print(f"  시도지사...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "3"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "3", "subType": "시도지사",
                "label": f"{year_label} 시도지사", "date": date,
                "results": results,
            })
            print(f"  시도지사 {len(results)}건")

        # 기초의원 (sgTypecode=6)
        print(f"  기초의원...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "6"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="local")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "6", "subType": "기초의원",
                "label": f"{year_label} 기초의원", "date": date,
                "results": results,
            })
            print(f"  기초의원 {len(results)}건")

        # 도의원 (sgTypecode=5)
        print(f"  도의원...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "5"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="local")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "5", "subType": "도의원",
                "label": f"{year_label} 도의원", "date": date,
                "results": results,
            })
            print(f"  도의원 {len(results)}건")

        # 교육감 (sgTypecode=11)
        print(f"  교육감...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "11"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "11", "subType": "교육감",
                "label": f"{year_label} 교육감", "date": date,
                "results": results,
            })
            print(f"  교육감 {len(results)}건")

        # 기초비례 (sgTypecode=9)
        print(f"  기초비례...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "9"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "9", "subType": "기초비례",
                "label": f"{year_label} 기초비례", "date": date,
                "results": results,
            })
            print(f"  기초비례 {len(results)}건")

        # 광역비례 (sgTypecode=8)
        print(f"  광역비례...")
        params = {**base_params, "sgId": sgId, "sgTypecode": "8"}
        items = fetch_all_pages("getXmntckSttusInfoInqire", params)
        print(f"  {len(items)}건 조회")
        results = extract_paju(items, mode="wiw")
        if results:
            local_elections.append({
                "sgId": sgId, "sgTypecode": "8", "subType": "광역비례",
                "label": f"{year_label} 광역비례", "date": date,
                "results": results,
            })
            print(f"  광역비례 {len(results)}건")

    # ===== 저장 =====
    print(f"\n{'='*50}")
    with open(os.path.join(output_dir, f"{SGG_CODE}-elections.json"), "w", encoding="utf-8") as f:
        json.dump(elections, f, ensure_ascii=False, indent=2)
    with open(os.path.join(output_dir, f"{SGG_CODE}-local-elections.json"), "w", encoding="utf-8") as f:
        json.dump(local_elections, f, ensure_ascii=False, indent=2)

    el_count = sum(len(e["results"]) for e in elections)
    lo_count = sum(len(e["results"]) for e in local_elections)
    print(f"저장 완료:")
    print(f"  {SGG_CODE}-elections.json: {len(elections)}개 선거, {el_count}개 결과")
    print(f"  {SGG_CODE}-local-elections.json: {len(local_elections)}개 선거, {lo_count}개 결과")
    print(f"총 API 호출: {call_count}건")
    print("완료!")


if __name__ == "__main__":
    main()
