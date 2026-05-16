#!/usr/bin/env python3
"""경남 행정동 GeoJSON 추출.

public/data/nationwide-boundary.json (33MB, 전국 3,555개 행정동)에서
시도코드 48(경상남도)만 필터링해 public/data/gyeongnam-dong-boundary.json을 생성한다.

각 feature.properties를 표준화: { sgg, sggnm, admName, cityKey }
- sgg: 행정표준코드 5자리 (예: "48170")
- sggnm: 시·군구명 (예: "진주시")
- admName: 행정동명 (예: "문산읍")
- cityKey: src/config/cities/index.ts의 키 (예: "jinju")
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IN_PATH = ROOT / "public/data/nationwide-boundary.json"
OUT_PATH = ROOT / "public/data/gyeongnam-dong-boundary.json"

# 행정표준코드 5자리 → cities/index.ts의 키 매핑
SGG_TO_KEY = {
    "48121": "changwon-uichang",
    "48123": "changwon-seongsan",
    "48125": "changwon-masanhappo",
    "48127": "changwon-masanhoewon",
    "48129": "changwon-jinhae",
    "48170": "jinju",
    "48220": "tongyeong",
    "48240": "sacheon",
    "48250": "gimhae",
    "48270": "miryang",
    "48310": "geoje",
    "48330": "yangsan",
    "48720": "uiryeong",
    "48730": "haman",
    "48740": "changnyeong",
    "48820": "goseong",
    "48840": "namhae",
    "48850": "hadong",
    "48860": "sancheong",
    "48870": "hamyang",
    "48880": "geochang",
    "48890": "hapcheon",
}


def extract_dong_name(adm_nm: str, sggnm: str) -> str:
    """'경상남도 진주시 문산읍' → '문산읍'."""
    parts = adm_nm.split(" ")
    return parts[-1]


def main() -> None:
    with IN_PATH.open(encoding="utf-8") as f:
        nationwide = json.load(f)

    features = []
    sgg_count: dict[str, int] = {}
    for feat in nationwide["features"]:
        props = feat["properties"]
        if props.get("sido") != "48":
            continue
        sgg = props.get("sgg", "")
        city_key = SGG_TO_KEY.get(sgg)
        if not city_key:
            print(f"경고: 매핑되지 않은 sgg={sgg} adm_nm={props.get('adm_nm')}")
            continue
        adm_nm = props.get("adm_nm", "")
        sggnm = props.get("sggnm", "")
        dong_name = extract_dong_name(adm_nm, sggnm)
        sgg_count[sgg] = sgg_count.get(sgg, 0) + 1

        features.append({
            "type": "Feature",
            "geometry": feat["geometry"],
            "properties": {
                "sgg": sgg,
                "sggnm": sggnm,
                "admName": dong_name,
                "cityKey": city_key,
            },
        })

    out = {"type": "FeatureCollection", "features": features}
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"\n생성 완료: {OUT_PATH.relative_to(ROOT)} ({size_kb:.0f}KB)")
    print(f"총 feature: {len(features)}개")
    print(f"시·군구 수: {len(sgg_count)}개")
    print(f"시·군구별 동 수:")
    for sgg in sorted(sgg_count.keys()):
        print(f"  {sgg} {SGG_TO_KEY[sgg]:25s}: {sgg_count[sgg]}개")


if __name__ == "__main__":
    main()
