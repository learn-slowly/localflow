#!/usr/bin/env python3
"""경남 22개 시·군구의 4탭(기초·도의원·국회·시장) 선거구→동 매핑 추출.

public/data/elections/<code>-local-elections.json (기초의원·도의원·시장)과
public/data/elections/<code>-elections.json (총선=국회의원)에서
dongResults[].district로 group by하여 선거구별 동 목록을 생성한다.

비정상 dong("잘못 투입·구분된 투표지" 등)은 필터링.

출력: public/data/gyeongnam-districts.json
형식:
{
  "<cityKey>": {
    "name": "<시군구명>",
    "code": "<행정표준코드>",
    "types": {
      "local":      { "election": "...", "districts": [{"name": "...", "dongs": [...]}] },
      "provincial": {...},
      "assembly":   {...},
      "mayor":      {...}
    }
  },
  ...
}
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ELECTIONS_DIR = ROOT / "public/data/elections"
OUT_PATH = ROOT / "public/data/gyeongnam-districts.json"

# (행정표준코드, cityKey, 시·군구명) — Task 1의 SGG_TO_KEY와 동일 순서
CITIES = [
    ("48121", "changwon-uichang",      "창원시의창구"),
    ("48123", "changwon-seongsan",     "창원시성산구"),
    ("48125", "changwon-masanhappo",   "창원시마산합포구"),
    ("48127", "changwon-masanhoewon",  "창원시마산회원구"),
    ("48129", "changwon-jinhae",       "창원시진해구"),
    ("48170", "jinju",                 "진주시"),
    ("48220", "tongyeong",             "통영시"),
    ("48240", "sacheon",               "사천시"),
    ("48250", "gimhae",                "김해시"),
    ("48270", "miryang",               "밀양시"),
    ("48310", "geoje",                 "거제시"),
    ("48330", "yangsan",               "양산시"),
    ("48720", "uiryeong",              "의령군"),
    ("48730", "haman",                 "함안군"),
    ("48740", "changnyeong",           "창녕군"),
    ("48820", "goseong",               "고성군"),
    ("48840", "namhae",                "남해군"),
    ("48850", "hadong",                "하동군"),
    ("48860", "sancheong",             "산청군"),
    ("48870", "hamyang",               "함양군"),
    ("48880", "geochang",              "거창군"),
    ("48890", "hapcheon",              "합천군"),
]

# 비정상 dong 토큰 (선관위 데이터의 노이즈)
INVALID_DONG_PATTERNS = ["잘못 투입", "구분된 투표지", "관외사전투표", "거소투표", "재외투표"]


def is_valid_dong(name: str) -> bool:
    if not name:
        return False
    return not any(pat in name for pat in INVALID_DONG_PATTERNS)


def extract_districts_from_item(item: dict) -> tuple[str, list[dict]]:
    """단일 elections 항목에서 (label, [{name, dongs[]}, ...])를 추출.

    dongResults를 district로 group by하고, 동 순서는 등장 순서 유지.
    """
    by_district: dict[str, list[str]] = {}
    seen = set()
    for row in item.get("dongResults", []):
        dong = row.get("dong", "")
        district = row.get("district", "")
        if not district or not is_valid_dong(dong):
            continue
        key = (district, dong)
        if key in seen:
            continue
        seen.add(key)
        by_district.setdefault(district, []).append(dong)

    districts = [{"name": k, "dongs": v} for k, v in by_district.items()]
    return item.get("label", ""), districts


def pick_latest(items: list[dict], type_filter) -> dict | None:
    """type_filter(item)가 True인 항목 중 가장 최신(sgId 큰) 것을 반환."""
    candidates = [x for x in items if type_filter(x)]
    if not candidates:
        return None
    candidates.sort(key=lambda x: x.get("sgId", ""), reverse=True)
    return candidates[0]


def build_city(code: str, city_key: str, name: str) -> dict:
    local_path = ELECTIONS_DIR / f"{code}-local-elections.json"
    elections_path = ELECTIONS_DIR / f"{code}-elections.json"

    types: dict[str, dict] = {}

    if local_path.exists():
        with local_path.open(encoding="utf-8") as f:
            local_items = json.load(f)

        item = pick_latest(local_items, lambda x: x.get("subType") == "기초의원" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["local"] = {"election": label, "districts": districts}

        item = pick_latest(local_items, lambda x: x.get("subType") == "도의원" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["provincial"] = {"election": label, "districts": districts}

        item = pick_latest(local_items, lambda x: x.get("subType") == "시장" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["mayor"] = {"election": label, "districts": districts}

    if elections_path.exists():
        with elections_path.open(encoding="utf-8") as f:
            ge_items = json.load(f)

        item = pick_latest(ge_items, lambda x: "총선" in x.get("label", "") and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["assembly"] = {"election": label, "districts": districts}

    return {"name": name, "code": code, "types": types}


def main() -> None:
    out: dict[str, dict] = {}
    print("시·군구별 추출 결과:")
    print(f"{'cityKey':25s} {'local':>7s} {'prov':>7s} {'asm':>7s} {'mayor':>7s}")
    for code, city_key, name in CITIES:
        out[city_key] = build_city(code, city_key, name)
        types = out[city_key]["types"]
        n_local = len(types.get("local", {}).get("districts", []))
        n_prov = len(types.get("provincial", {}).get("districts", []))
        n_asm = len(types.get("assembly", {}).get("districts", []))
        n_mayor = len(types.get("mayor", {}).get("districts", []))
        print(f"{city_key:25s} {n_local:>7d} {n_prov:>7d} {n_asm:>7d} {n_mayor:>7d}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\n생성 완료: {OUT_PATH.relative_to(ROOT)} ({size_kb:.0f}KB)")


if __name__ == "__main__":
    main()
