#!/usr/bin/env python3
"""총선 비례대표 개표결과 수집 → 기존 elections JSON에 추가"""

import json
import urllib.request
import urllib.parse
import time
import os

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/9760000"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "elections")

# 비례대표국회의원선거: sgTypecode = 7
TARGETS = [
    {"sgId": "20240410", "label": "2024 총선 (제22대)"},
    {"sgId": "20200415", "label": "2020 총선 (제21대)"},
]


def api_call(endpoint, params, max_rows=300):
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


def parse_parties(row):
    """비례대표: 정당별 득표수 추출"""
    parties = []
    for i in range(1, 51):
        # 비례대표는 정당명이 jd{i}, 득표수가 dugsu{i}
        party = row.get(f"jd{i:02d}", "")
        votes = row.get(f"dugsu{i:02d}", 0)
        if party:
            parties.append({"party": party, "votes": int(votes) if votes else 0})
    return parties


def fetch_proportional(sg_id):
    """진주시 비례대표 개표결과 (시군구 단위)"""
    params = {
        "sgId": sg_id,
        "sgTypecode": "7",  # 비례대표국회의원
        "sdName": "경상남도",
    }
    items = api_call("VoteXmntckInfoInqireService2/getXmntckSttusInfoInqire", params)

    for item in items:
        wiw = item.get("wiwName", "")
        if "진주" in wiw:
            parties = parse_parties(item)
            return {
                "voters": int(item.get("sunsu", 0)),
                "turnout": int(item.get("tusu", 0)),
                "valid": int(item.get("yutusu", 0)),
                "invalid": int(item.get("mutusu", 0)),
                "parties": [p for p in parties if p["votes"] > 0],
            }
    return None


def main():
    # 기존 데이터 로드
    json_path = os.path.join(DATA_DIR, "48170-elections.json")
    with open(json_path, "r", encoding="utf-8") as f:
        elections = json.load(f)

    for target in TARGETS:
        sg_id = target["sgId"]
        label = target["label"]

        print(f"\n=== {label} 비례대표 ===")
        result = fetch_proportional(sg_id)
        time.sleep(0.5)

        if not result:
            print("  데이터 없음")
            continue

        print(f"  선거인수={result['voters']:,}, 투표수={result['turnout']:,}, 유효={result['valid']:,}")
        top = sorted(result["parties"], key=lambda p: p["votes"], reverse=True)[:5]
        for p in top:
            pct = (p["votes"] / result["valid"] * 100) if result["valid"] else 0
            print(f"    {p['party']}: {p['votes']:,}표 ({pct:.1f}%)")

        # 기존 데이터에 추가
        for elec in elections:
            if elec.get("sgId") == sg_id and "총선" in elec.get("label", ""):
                elec["proportional"] = result
                print(f"  → '{elec['label']}'에 추가 완료")
                break

    # 저장
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(elections, f, ensure_ascii=False, indent=2)
    print(f"\n저장: {json_path}")


if __name__ == "__main__":
    main()
