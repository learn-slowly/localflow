#!/usr/bin/env python3
"""선관위 API에서 선거 데이터 수집 스크립트"""

import json
import urllib.request
import urllib.parse
import time
import os

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/9760000"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# 수집 대상 선거
# mode: "sgg" = sggName 파라미터 사용 (총선/지선), "wiw" = sdName만 사용 후 wiwName 필터 (대선)
ELECTIONS = [
    {"sgId": "20250603", "type": "1", "label": "2025 대선 (제21대)", "date": "2025.06.03",
     "mode": "wiw", "filter": "진주시"},
    {"sgId": "20240410", "type": "2", "label": "2024 총선 (제22대)", "date": "2024.04.10",
     "mode": "sgg", "sggNames": ["진주시갑", "진주시을"]},
    {"sgId": "20220309", "type": "1", "label": "2022 대선 (제20대)", "date": "2022.03.09",
     "mode": "wiw", "filter": "진주시"},
    {"sgId": "20200415", "type": "2", "label": "2020 총선 (제21대)", "date": "2020.04.15",
     "mode": "sgg", "sggNames": ["진주시갑", "진주시을"]},
    {"sgId": "20180613", "type": "4", "label": "2018 지선 시장 (제7회)", "date": "2018.06.13",
     "mode": "sgg", "sggNames": ["진주시"]},
    {"sgId": "20170509", "type": "1", "label": "2017 대선 (제19대)", "date": "2017.05.09",
     "mode": "wiw", "filter": "진주시"},
]


def api_call(endpoint, params, max_rows=300):
    """선관위 API 호출"""
    params["serviceKey"] = API_KEY
    params["resultType"] = "json"
    params["numOfRows"] = str(max_rows)
    params["pageNo"] = "1"
    qs = urllib.parse.urlencode(params)
    url = f"{BASE}/{endpoint}?{qs}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
        body = data.get("response", {}).get("body", {})
        if not body:
            code = data.get("response", {}).get("header", {}).get("resultCode", "?")
            msg = data.get("response", {}).get("header", {}).get("resultMsg", "?")
            print(f"  API warning: {code} - {msg}")
            return []
        items = body.get("items", {})
        if not items:
            return []
        item_list = items.get("item", [])
        if isinstance(item_list, dict):
            return [item_list]
        return item_list
    except Exception as e:
        print(f"  API error: {e}")
        return []


def parse_candidates(row):
    """API 응답에서 후보자 목록 추출"""
    candidates = []
    for i in range(1, 51):
        name = row.get(f"hbj{i:02d}", "")
        party = row.get(f"jd{i:02d}", "")
        votes = row.get(f"dugsu{i:02d}", 0)
        if name:
            candidates.append({
                "name": name,
                "party": party,
                "votes": int(votes) if votes else 0,
            })
    return candidates


def fetch_count_sgg(sg_id, sg_typecode, sgg_name):
    """개표결과 - sggName 방식 (총선/지선)"""
    params = {"sgId": sg_id, "sgTypecode": sg_typecode,
              "sdName": "경상남도", "sggName": sgg_name}
    items = api_call("VoteXmntckInfoInqireService2/getXmntckSttusInfoInqire", params)
    if not items:
        return None
    row = items[0]
    return {
        "district": sgg_name,
        "voters": int(row.get("sunsu", 0)),
        "turnout": int(row.get("tusu", 0)),
        "valid": int(row.get("yutusu", 0)),
        "invalid": int(row.get("mutusu", 0)),
        "candidates": parse_candidates(row),
    }


def fetch_count_wiw(sg_id, sg_typecode, wiw_filter):
    """개표결과 - wiwName 필터 방식 (대선)"""
    params = {"sgId": sg_id, "sgTypecode": sg_typecode, "sdName": "경상남도"}
    items = api_call("VoteXmntckInfoInqireService2/getXmntckSttusInfoInqire", params)
    for item in items:
        if item.get("wiwName") == wiw_filter:
            return {
                "district": wiw_filter,
                "voters": int(item.get("sunsu", 0)),
                "turnout": int(item.get("tusu", 0)),
                "valid": int(item.get("yutusu", 0)),
                "invalid": int(item.get("mutusu", 0)),
                "candidates": parse_candidates(item),
            }
    return None


def fetch_voter_count_by_dong(sg_id, sg_typecode):
    """읍면동별 선거인수 조회"""
    params = {"sgId": sg_id, "sgTypecode": sg_typecode, "sdName": "경상남도"}
    items = api_call("ElcntInfoInqireService/getEmdElcntInfoInqire", params)
    result = []
    for item in items:
        wiw = item.get("wiwName", "")
        emd = item.get("emdName", "")
        if "진주" in wiw and emd != "합계":
            result.append({
                "dong": emd,
                "voters": int(item.get("cfmtnElcnt", 0)),
                "population": int(item.get("ppltCnt", 0)),
                "maleVoters": int(item.get("cfmtnManElcnt", 0)),
                "femaleVoters": int(item.get("cfmtnFmlElcnt", 0)),
            })
    return result


def main():
    all_elections = []

    for elec in ELECTIONS:
        sg_id = elec["sgId"]
        sg_type = elec["type"]
        label = elec["label"]
        mode = elec["mode"]

        print(f"\n{'='*60}")
        print(f"[{label}] sgId={sg_id}, type={sg_type}")
        print(f"{'='*60}")

        election_data = {
            "sgId": sg_id,
            "sgTypecode": sg_type,
            "label": label,
            "date": elec["date"],
            "results": [],
            "votersByDong": [],
        }

        # 개표결과 조회
        if mode == "sgg":
            for sgg in elec["sggNames"]:
                print(f"  개표결과: {sgg}...")
                result = fetch_count_sgg(sg_id, sg_type, sgg)
                if result:
                    election_data["results"].append(result)
                    top = sorted(result["candidates"], key=lambda c: c["votes"], reverse=True)[:3]
                    cands = ", ".join([f"{c['name']}({c['party']})={c['votes']:,}" for c in top])
                    print(f"    선거인수={result['voters']:,}, 투표수={result['turnout']:,}")
                    print(f"    상위: {cands}")
                else:
                    print(f"    데이터 없음")
                time.sleep(0.3)
        else:  # wiw
            print(f"  개표결과: {elec['filter']}...")
            result = fetch_count_wiw(sg_id, sg_type, elec["filter"])
            if result:
                election_data["results"].append(result)
                top = sorted(result["candidates"], key=lambda c: c["votes"], reverse=True)[:3]
                cands = ", ".join([f"{c['name']}({c['party']})={c['votes']:,}" for c in top])
                print(f"    선거인수={result['voters']:,}, 투표수={result['turnout']:,}")
                print(f"    상위: {cands}")
            else:
                print(f"    데이터 없음")
            time.sleep(0.3)

        # 읍면동별 선거인수
        print(f"  읍면동별 선거인수 조회...")
        dong_data = fetch_voter_count_by_dong(sg_id, sg_type)
        election_data["votersByDong"] = dong_data
        print(f"    {len(dong_data)}개 읍면동")
        time.sleep(0.3)

        all_elections.append(election_data)

    # 결과 저장
    out_path = os.path.join(OUT_DIR, "jinju-elections-api.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_elections, f, ensure_ascii=False, indent=2)
    print(f"\n저장 완료: {out_path}")
    print(f"총 {len(all_elections)}개 선거 데이터")


if __name__ == "__main__":
    main()
