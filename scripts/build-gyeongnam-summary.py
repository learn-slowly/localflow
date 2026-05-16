#!/usr/bin/env python3
"""경남 22개 시군구 인구 요약 빌드.

src/config/cities/index.ts의 cities 키를 따라
public/data/nationwide-population.json에서 시군구별 인구를 합산해
src/data/gyeongnam-cities.json을 생성한다.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NATIONWIDE = ROOT / "public/data/nationwide-population.json"
OUT = ROOT / "src/data/gyeongnam-cities.json"

# 경남 22개 시군구 (행정표준코드 5자리 → 도시 키, 한글명, 지도 중심)
GYEONGNAM = [
    ("48121", "changwon-uichang",      "창원시의창구",   [35.2994, 128.6546]),
    ("48123", "changwon-seongsan",     "창원시성산구",   [35.2018, 128.6751]),
    ("48125", "changwon-masanhappo",   "창원시마산합포구", [35.1370, 128.5084]),
    ("48127", "changwon-masanhoewon",  "창원시마산회원구", [35.2354, 128.5586]),
    ("48129", "changwon-jinhae",       "창원시진해구",   [35.1243, 128.7185]),
    ("48170", "jinju",                 "진주시",        [35.1798, 128.1076]),
    ("48220", "tongyeong",             "통영시",        [34.7925, 128.3828]),
    ("48240", "sacheon",               "사천시",        [35.0335, 128.0460]),
    ("48250", "gimhae",                "김해시",        [35.2642, 128.8448]),
    ("48270", "miryang",               "밀양시",        [35.4890, 128.7744]),
    ("48310", "geoje",                 "거제시",        [34.8731, 128.6132]),
    ("48330", "yangsan",               "양산시",        [35.3957, 129.0527]),
    ("48720", "uiryeong",              "의령군",        [35.3903, 128.2745]),
    ("48730", "haman",                 "함안군",        [35.2914, 128.4374]),
    ("48740", "changnyeong",           "창녕군",        [35.4998, 128.4969]),
    ("48820", "goseong",               "고성군",        [35.0169, 128.2773]),
    ("48840", "namhae",                "남해군",        [34.8053, 127.9534]),
    ("48850", "hadong",                "하동군",        [35.1006, 127.8007]),
    ("48860", "sancheong",             "산청군",        [35.3846, 127.9092]),
    ("48870", "hamyang",               "함양군",        [35.5622, 127.7277]),
    ("48880", "geochang",              "거창군",        [35.7169, 127.9054]),
    ("48890", "hapcheon",              "합천군",        [35.5648, 128.1596]),
]


def main():
    with NATIONWIDE.open(encoding="utf-8") as f:
        pop = json.load(f)

    result = {}
    for code, key, name, center in GYEONGNAM:
        total = households = male = female = 0
        for dong_code, rec in pop.items():
            if not dong_code.startswith(code):
                continue
            total      += rec.get("p", 0)
            households += rec.get("h", 0)
            male       += rec.get("m", 0)
            female     += rec.get("f", 0)
        result[key] = {
            "code": code,
            "name": name,
            "totalPopulation": total,
            "households": households,
            "male": male,
            "female": female,
            "center": center,
        }
        print(f"{key:25s} 인구 {total:>10,}  세대 {households:>8,}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"\n→ {OUT}")


if __name__ == "__main__":
    main()
