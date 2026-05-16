#!/usr/bin/env python3
"""경남 22개 시군구 경계 GeoJSON 빌드.

nationwide-boundary.json (전국 행정동 GeoJSON)에서 경남(sido=48)을
추출하고, sgg 코드별로 동 폴리곤을 MultiPolygon으로 합쳐 시군구 단위
22개 Feature를 만든다. dissolve는 외부 라이브러리 없이 좌표 리스트
연결만 수행한다.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/data/nationwide-boundary.json"
OUT = ROOT / "public/data/gyeongnam-boundary.json"

CITY_KEY = {
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


def main():
    with SRC.open(encoding="utf-8") as f:
        data = json.load(f)

    # sgg → {sggnm, polygons[]}
    grouped: dict[str, dict] = {}
    for feat in data["features"]:
        props = feat["properties"]
        sgg = props.get("sgg")
        if sgg not in CITY_KEY:
            continue
        bucket = grouped.setdefault(sgg, {
            "sgg": sgg,
            "sggnm": props.get("sggnm"),
            "polygons": [],
        })
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            bucket["polygons"].append(geom["coordinates"])
        elif geom["type"] == "MultiPolygon":
            bucket["polygons"].extend(geom["coordinates"])

    features = []
    for sgg, b in sorted(grouped.items()):
        features.append({
            "type": "Feature",
            "properties": {
                "code": sgg,
                "key": CITY_KEY[sgg],
                "name": b["sggnm"],
            },
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": b["polygons"],
            },
        })
        print(f"{CITY_KEY[sgg]:25s} sgg={sgg}  polygons={len(b['polygons'])}")

    out = {"type": "FeatureCollection", "features": features}
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"\n→ {OUT}  ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
