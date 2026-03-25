#!/usr/bin/env python3
"""2022/2018 지선 기초의원·도의원·시장 개표결과 수집"""

import json
import urllib.request
import urllib.parse
import time
import os

API_KEY = "3af0565a2348db0197d4b06f1b8c0bf1e3974057f9d68d2b821db87260d07d34"
BASE = "https://apis.data.go.kr/9760000"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

# 진주시 선거구 목록 (API에서 코드 안 나오므로 직접 지정)
LOCAL_DISTRICTS = [
    "진주시가선거구", "진주시나선거구", "진주시다선거구", "진주시라선거구",
    "진주시마선거구", "진주시바선거구", "진주시사선거구", "진주시아선거구",
]
PROVINCIAL_DISTRICTS = [
    "진주시제1선거구", "진주시제2선거구", "진주시제3선거구",
    "진주시제4선거구", "진주시제5선거구",
]

ELECTIONS = [
    # (sgId, label, date, types)
    ("20220601", "2022 지선 (제8회)", "2022.06.01", [
        ("4", "시장", ["진주시"]),
        ("6", "기초의원", LOCAL_DISTRICTS),
        ("5", "도의원", PROVINCIAL_DISTRICTS),
    ]),
    ("20180613", "2018 지선 (제7회)", "2018.06.13", [
        ("4", "시장", ["진주시"]),
        ("6", "기초의원", LOCAL_DISTRICTS),
        ("5", "도의원", PROVINCIAL_DISTRICTS),
    ]),
]


def api_call(endpoint, params):
    params["serviceKey"] = API_KEY
    params["resultType"] = "json"
    params["numOfRows"] = "300"
    params["pageNo"] = "1"
    qs = urllib.parse.urlencode(params)
    url = f"{BASE}/{endpoint}?{qs}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
        body = data.get("response", {}).get("body", {})
        if not body:
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


def fetch_count(sg_id, sg_typecode, sgg_name):
    params = {"sgId": sg_id, "sgTypecode": sg_typecode,
              "sdName": "경상남도", "sggName": sgg_name}
    items = api_call("VoteXmntckInfoInqireService2/getXmntckSttusInfoInqire", params)
    if not items:
        return None
    row = items[0]
    candidates = []
    for i in range(1, 51):
        name = row.get(f"hbj{i:02d}", "")
        party = row.get(f"jd{i:02d}", "")
        votes = row.get(f"dugsu{i:02d}", 0)
        if name:
            candidates.append({"name": name, "party": party, "votes": int(votes) if votes else 0})
    return {
        "district": sgg_name,
        "voters": int(row.get("sunsu", 0)),
        "turnout": int(row.get("tusu", 0)),
        "valid": int(row.get("yutusu", 0)),
        "invalid": int(row.get("mutusu", 0)),
        "candidates": candidates,
    }


def main():
    all_data = []

    for sg_id, label, date, types in ELECTIONS:
        print(f"\n{'='*50}")
        print(f"[{label}]")
        print(f"{'='*50}")

        for sg_type, sub_label, districts in types:
            entry = {
                "sgId": sg_id,
                "sgTypecode": sg_type,
                "label": f"{label} {sub_label}",
                "date": date,
                "subType": sub_label,
                "results": [],
                "votersByDong": [],
                "dongResults": [],
            }

            for sgg in districts:
                print(f"  {sub_label} {sgg}...", end=" ")
                result = fetch_count(sg_id, sg_type, sgg)
                if result:
                    entry["results"].append(result)
                    winner = max(result["candidates"], key=lambda c: c["votes"])
                    print(f"당선: {winner['name']}({winner['party']}) {winner['votes']:,}표")
                else:
                    print("데이터 없음")
                time.sleep(0.2)

            if entry["results"]:
                all_data.append(entry)

    out_path = os.path.join(OUT_DIR, "jinju-local-elections.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"\n저장: {out_path}")
    for e in all_data:
        print(f"  {e['label']}: {len(e['results'])}개 선거구")


if __name__ == "__main__":
    main()
