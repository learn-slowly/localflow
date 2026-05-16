# 경남 22개 시·군구 선거구 매핑 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진주에만 표시되는 행정동 선거구 코로프레스를 경남 22개 시·군구 전체로 확장하고, 줌 레벨에 따라 시·군구 단위와 동 단위를 자동 전환한다.

**Architecture:** Python 빌드 스크립트 2개로 (a) 경남 행정동 GeoJSON과 (b) 시·군별 4탭(기초·도의원·국회·시장) 선거구→동 매핑 JSON을 만든다. 카카오맵의 `zoom_changed`로 모드를 전환하는 GyeongnamMap을 일반화하고, 진주 전용 손 매핑(`jinju-districts.json`)을 통합 매핑(`gyeongnam-districts.json`)으로 마이그레이션한다.

**Tech Stack:** Next.js 16(webpack), React, TypeScript, Tailwind v4, 카카오맵 SDK, Python 3 (빌드 스크립트)

**Spec:** `docs/superpowers/specs/2026-05-16-gyeongnam-district-mapping-design.md`

**테스트 정책:** 이 프로젝트엔 단위 테스트 인프라(vitest/jest)가 없다. 빌드 스크립트는 console 통계 출력으로 자체 검증, React 컴포넌트는 `npx tsc --noEmit` + dev 서버 수동 점검으로 검증한다.

---

## 파일 구조

**Create**
- `scripts/build-gyeongnam-dong-boundary.py` — `nationwide-boundary.json`에서 경남 305개 동만 추출
- `scripts/build-gyeongnam-districts.py` — 22개 시·군 × 4탭 선거구→동 매핑 추출
- `public/data/gyeongnam-dong-boundary.json` — 빌드 산출물 (3-5MB 예상)
- `public/data/gyeongnam-districts.json` — 빌드 산출물 (~50-100KB 예상)
- `src/lib/district-mapping.ts` — GyeongnamDistricts 타입 + `dongDistrictMap` 헬퍼

**Modify**
- `src/components/Map/GyeongnamMap.tsx` — 줌 모드 + dong 모드 일반화, 진주 전용 로직 제거
- `src/components/Map/MapContainer.tsx` — `jinju-districts.json` import → `gyeongnam-districts.json` fetch
- `src/components/Map/DistrictDashboard.tsx` — 동일
- `src/app/[city]/district/[id]/page.tsx` — 동일

**Delete**
- `src/data/jinju-districts.json` — gyeongnam-districts.json의 `jinju` 항목으로 대체

---

## Task 1: 행정동 GeoJSON 추출 스크립트

**Files:**
- Create: `scripts/build-gyeongnam-dong-boundary.py`

- [ ] **Step 1: 스크립트 작성**

다음 내용으로 `scripts/build-gyeongnam-dong-boundary.py` 파일을 만든다:

```python
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
    # 마지막 토큰이 동/읍/면명. 시·군구가 토큰 둘로 쪼개진 경우(창원시 의창구)도 처리됨.
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
            # 미매핑 sgg는 스킵하고 로그
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
```

- [ ] **Step 2: 스크립트 실행 + 결과 검증**

Run: `python3 scripts/build-gyeongnam-dong-boundary.py`

Expected: 통계가 출력되고 22개 시·군구 전부 매핑됨. `진주시 30`, `김해시 19`, `의창구 7` 등 (총 305개). 파일 크기 3-5MB.

만약 "경고: 매핑되지 않은 sgg" 로그가 뜨면 `SGG_TO_KEY` 매핑이 누락된 경우이므로 `properties.sgg` 값을 확인하고 매핑 추가.

- [ ] **Step 3: 커밋**

```bash
git add scripts/build-gyeongnam-dong-boundary.py public/data/gyeongnam-dong-boundary.json
git commit -m "경남 행정동 GeoJSON 추출 스크립트 + 산출물 추가"
```

---

## Task 2: 선거구→동 매핑 추출 스크립트

**Files:**
- Create: `scripts/build-gyeongnam-districts.py`

- [ ] **Step 1: 스크립트 작성**

다음 내용으로 `scripts/build-gyeongnam-districts.py` 파일을 만든다:

```python
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

        # 기초의원
        item = pick_latest(local_items, lambda x: x.get("subType") == "기초의원" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["local"] = {"election": label, "districts": districts}

        # 도의원
        item = pick_latest(local_items, lambda x: x.get("subType") == "도의원" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["provincial"] = {"election": label, "districts": districts}

        # 시장
        item = pick_latest(local_items, lambda x: x.get("subType") == "시장" and x.get("dongResults"))
        if item:
            label, districts = extract_districts_from_item(item)
            types["mayor"] = {"election": label, "districts": districts}

    if elections_path.exists():
        with elections_path.open(encoding="utf-8") as f:
            ge_items = json.load(f)

        # 국회의원 = 총선 라벨, subType은 비어 있을 수 있음
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
```

- [ ] **Step 2: 스크립트 실행 + 결과 검증**

Run: `python3 scripts/build-gyeongnam-districts.py`

Expected: 22행 출력. 진주 `local=8 prov=3 asm=1 mayor=1` 정도. 김해는 `local=4 prov=4 asm=2 mayor=1`. 군 단위(의령·합천 등)는 mayor만 1, 나머지는 0~1.

검증: 진주의 자동 추출이 기존 `src/data/jinju-districts.json`의 `local` 매핑과 일치하는지 확인.

```bash
python3 -c "
import json
auto = json.load(open('public/data/gyeongnam-districts.json'))['jinju']['types']['local']
hand = json.load(open('src/data/jinju-districts.json'))['types']['local']
auto_map = {d['name']: set(d['dongs']) for d in auto['districts']}
hand_map = {d['name']: set(d['dongs']) for d in hand['districts']}
assert set(auto_map.keys()) == set(hand_map.keys()), '선거구 이름 불일치'
for name in auto_map:
    diff = auto_map[name] ^ hand_map[name]
    assert not diff, f'{name} 동 차이: {diff}'
print('진주 local 자동 추출 vs 손 매핑 = 일치')
"
```

Expected: `진주 local 자동 추출 vs 손 매핑 = 일치`

- [ ] **Step 3: 커밋**

```bash
git add scripts/build-gyeongnam-districts.py public/data/gyeongnam-districts.json
git commit -m "경남 시·군별 선거구→동 매핑 추출 스크립트 + 산출물 추가"
```

---

## Task 3: 매핑 헬퍼 + 타입 정의

**Files:**
- Create: `src/lib/district-mapping.ts`

- [ ] **Step 1: 파일 작성**

다음 내용으로 `src/lib/district-mapping.ts`를 만든다:

```ts
// 경남 22개 시·군 선거구→행정동 매핑 헬퍼.
// 데이터 출처: public/data/gyeongnam-districts.json (빌드 스크립트로 생성)

export type ElectionType = "local" | "provincial" | "assembly" | "mayor";

export interface DistrictEntry {
  name: string;
  dongs: string[];
}

export interface ElectionTypeConfig {
  election: string;
  districts: DistrictEntry[];
}

export interface CityDistricts {
  name: string;
  code: string;
  types: Partial<Record<ElectionType, ElectionTypeConfig>>;
}

export type GyeongnamDistricts = Record<string, CityDistricts>;

// 진주 GyeongnamMap.tsx의 DISTRICT_COLORS와 동일 팔레트.
// 시·군 내 selectedElectionType 기준 idx 순환.
export const DISTRICT_COLORS = [
  "#2563EB", "#DC2626", "#16A34A", "#CA8A04",
  "#9333EA", "#EA580C", "#0891B2", "#BE185D",
];

/**
 * 시·군 단위로 (동 → {선거구명, 색}) 맵을 한 번에 생성.
 * 진주 GyeongnamMap의 jinjuDongDistrictMap 일반화.
 */
export function buildDongDistrictMap(
  data: GyeongnamDistricts,
  cityKey: string,
  electionType: ElectionType,
): Record<string, { districtName: string; color: string }> {
  const result: Record<string, { districtName: string; color: string }> = {};
  const config = data[cityKey]?.types[electionType];
  if (!config) return result;
  config.districts.forEach((d, idx) => {
    const color = DISTRICT_COLORS[idx % DISTRICT_COLORS.length];
    for (const dong of d.dongs) {
      result[dong] = { districtName: d.name, color };
    }
  });
  return result;
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/district-mapping.ts
git commit -m "경남 선거구 매핑 헬퍼 + 타입 추가"
```

---

## Task 4: GyeongnamMap에 동 모드 effect 추가

이 task는 **기존 진주 오버레이를 건드리지 않고 추가**한다. 줌 모드 전환 + 진주 오버레이 제거는 다음 task에서.

**Files:**
- Modify: `src/components/Map/GyeongnamMap.tsx`

- [ ] **Step 1: 기존 파일 읽기**

`src/components/Map/GyeongnamMap.tsx` 전체를 읽어 현재 상태를 파악한다 (현재 247줄).

- [ ] **Step 2: import + state 추가**

`src/components/Map/GyeongnamMap.tsx` 상단의 import 블록을 다음과 같이 변경한다:

```ts
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useKakaoMap, toKakaoLevel } from "@/hooks/useKakaoMap";
import { GYEONGNAM_VIEW } from "@/config/cities";
import gyeongnamCities from "@/data/gyeongnam-cities.json";
import {
  buildDongDistrictMap,
  DISTRICT_COLORS,
  type ElectionType,
  type GyeongnamDistricts,
} from "@/lib/district-mapping";
```

- `jinjuDistricts from "@/data/jinju-districts.json"` import 라인을 **삭제**한다.
- 파일 상단의 `const DISTRICT_COLORS = [...]` 배열 정의를 **삭제** (district-mapping.ts에서 가져옴).
- 파일 상단의 `function jinjuDongDistrictMap(electionType)` 함수 정의를 **삭제** (다음 step에서 일반 헬퍼로 대체).

- [ ] **Step 3: gyeongnamDistricts state 추가**

`GyeongnamMap` 컴포넌트 함수 본문에서 기존 `jinjuBoundary` state 선언 바로 아래에 다음을 추가한다:

```ts
const [gyeongnamDistricts, setGyeongnamDistricts] =
  useState<GyeongnamDistricts | null>(null);

// 전국 매핑 데이터 fetch (한 번)
useEffect(() => {
  let cancelled = false;
  fetch("/data/gyeongnam-districts.json")
    .then((r) => r.json())
    .then((data: GyeongnamDistricts) => {
      if (!cancelled) setGyeongnamDistricts(data);
    })
    .catch((e) => console.error("경남 선거구 매핑 로드 실패:", e));
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 4: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 진주 오버레이 effect 안에서 `jinjuDongDistrictMap` 참조가 깨졌다는 에러 1건 정도 — 다음 step에서 정리.

- [ ] **Step 5: 기존 진주 오버레이 effect를 일반 dong 모드 effect로 교체**

기존 `// 진주 선거구 레이어: 행정동 폴리곤을 선거구별 색깔로 색칠` effect 블록 전체(`useEffect(() => { ... }, [isLoaded, map, electionType, router, jinjuBoundary]);`)를 다음으로 교체한다:

```tsx
// 동 모드 레이어: 22개 시·군 행정동 폴리곤을 선거구별 색으로 색칠.
// 현재는 항상 동 폴리곤도 함께 그림(다음 task에서 줌 임계값으로 전환).
const [dongGeo, setDongGeo] = useState<{
  features: Array<{
    geometry:
      | { type: "Polygon"; coordinates: number[][][] }
      | { type: "MultiPolygon"; coordinates: number[][][][] };
    properties: { sgg: string; admName: string; cityKey: string };
  }>;
} | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/data/gyeongnam-dong-boundary.json")
    .then((r) => r.json())
    .then((data) => {
      if (!cancelled) setDongGeo(data);
    })
    .catch((e) => console.error("경남 행정동 GeoJSON 로드 실패:", e));
  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  if (!isLoaded || !map || !dongGeo || !gyeongnamDistricts) return;
  const polygons: kakao.maps.Polygon[] = [];

  for (const feat of dongGeo.features) {
    const { cityKey, admName } = feat.properties;
    const mapping = buildDongDistrictMap(
      gyeongnamDistricts,
      cityKey,
      electionType as ElectionType,
    );
    const entry = mapping[admName];
    if (!entry) continue;

    const geom = feat.geometry;
    const rings: number[][][][] =
      geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

    for (const polygon of rings) {
      const path = polygon[0].map(
        ([lng, lat]: number[]) => new window.kakao.maps.LatLng(lat, lng),
      );
      const p = new window.kakao.maps.Polygon({
        path,
        strokeWeight: 2,
        strokeColor: entry.color,
        strokeOpacity: 1.0,
        fillColor: entry.color,
        fillOpacity: 0.35,
        zIndex: 5,
      });
      p.setMap(map);

      window.kakao.maps.event.addListener(p, "click", () => {
        router.push(`/${cityKey}`);
      });
      window.kakao.maps.event.addListener(p, "mouseover", () => {
        p.setOptions({ fillOpacity: 0.55 });
      });
      window.kakao.maps.event.addListener(p, "mouseout", () => {
        p.setOptions({ fillOpacity: 0.35 });
      });

      polygons.push(p);
    }
  }

  return () => {
    polygons.forEach((p) => p.setMap(null));
  };
}, [isLoaded, map, dongGeo, gyeongnamDistricts, electionType, router]);
```

또한 기존 `const [jinjuBoundary, setJinjuBoundary] = useState<...>(null)` state와 `fetch("/data/jinju-boundary.json")` effect 블록 전체를 **삭제**한다. `BoundaryFeature`, `BoundaryFeatureCollection` 타입도 더 이상 쓰이지 않으면 삭제.

- [ ] **Step 6: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 7: dev 서버에서 수동 확인**

Run: `npm run dev` (webpack 모드)

브라우저에서 `http://localhost:3000/` 열고 확인:
- 경남 전체 지도가 정상 표시 (시·군구 인구 코로프레스).
- 동시에 22개 시·군의 행정동 선거구 색이 시·군구 위에 오버레이됨 (이 task의 의도된 임시 상태).
- 상단 4탭(기초·도의원·국회·시장) 전환 시 동 색깔이 변화.

dev 서버 종료: Ctrl+C.

- [ ] **Step 8: 커밋**

```bash
git add src/components/Map/GyeongnamMap.tsx src/lib/district-mapping.ts
git commit -m "GyeongnamMap에 22개 시·군 동 모드 effect 추가 (줌 전환은 다음 단계)"
```

---

## Task 5: 줌 임계값 기반 모드 전환 + 인구 코로프레스 분리

**Files:**
- Modify: `src/components/Map/GyeongnamMap.tsx`

- [ ] **Step 1: dongMode state + zoom_changed 리스너 추가**

`GyeongnamMap` 함수 본문, `gyeongnamDistricts` state 선언 아래에 다음을 추가:

```ts
// 카카오 level <= 8 (= 우리 zoom >= 12)일 때 동 모드.
const DONG_MODE_THRESHOLD_LEVEL = 8;
const [dongMode, setDongMode] = useState(false);

useEffect(() => {
  if (!isLoaded || !map) return;
  const update = () => {
    setDongMode(map.getLevel() <= DONG_MODE_THRESHOLD_LEVEL);
  };
  update();
  window.kakao.maps.event.addListener(map, "zoom_changed", update);
  return () => {
    window.kakao.maps.event.removeListener(map, "zoom_changed", update);
  };
}, [isLoaded, map]);
```

- [ ] **Step 2: 시·군구 인구 코로프레스 effect를 dongMode === false일 때만 그리도록 변경**

기존 시·군구 폴리곤 effect (`fetch("/data/gyeongnam-boundary.json").then((geo) => { ... })`)를 감싸는 useEffect 본문 맨 위에 다음 가드를 추가:

```tsx
if (dongMode) return; // 동 모드에선 시·군구 폴리곤 숨김
```

그리고 deps 배열에 `dongMode` 추가:

```ts
}, [isLoaded, map, router, dongMode]);
```

- [ ] **Step 3: 동 모드 effect를 dongMode === true일 때만 그리도록 변경**

Task 4에서 추가한 dong 모드 effect 본문 맨 위에 다음 가드를 추가:

```tsx
if (!dongMode) return; // 시·군구 모드에선 동 폴리곤 숨김
```

deps 배열에 `dongMode` 추가:

```ts
}, [isLoaded, map, dongGeo, gyeongnamDistricts, electionType, router, dongMode]);
```

- [ ] **Step 4: 인구 범례를 시·군구 모드에서만 표시**

JSX의 인구 범례 div(`<div className="absolute bottom-4 right-4 z-10 ...">`)를 `{!dongMode && (...)}` 조건부 렌더링으로 감싼다. 동 모드용 안내 텍스트를 추가:

```tsx
{!dongMode && (
  <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs">
    <div className="font-semibold text-gray-700 mb-1.5">인구</div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700">
      {/* 기존 6단계 범례 유지 */}
    </div>
  </div>
)}
{dongMode && (
  <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs text-gray-700">
    선거구별 색깔로 표시
  </div>
)}
```

- [ ] **Step 5: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 6: dev 서버에서 수동 확인**

Run: `npm run dev`

`http://localhost:3000/`:
- 초기 진입(GYEONGNAM_VIEW.zoom = 9, level = 11) → 시·군구 모드. 22개 시·군 인구 코로프레스 표시, 인구 범례 표시.
- 마우스 스크롤로 줌인 → 카카오 level이 8 이하로 떨어지는 순간 동 모드로 전환. 시·군구 폴리곤 사라지고 행정동 폴리곤 + 선거구 색이 표시. 범례 텍스트도 "선거구별 색깔로 표시"로 변경.
- 줌아웃하면 시·군구 모드로 복귀.
- 4탭 전환 시 동 모드 색깔 변화.

수동 확인: 22개 시·군 모두 줌인 시 색깔이 보이는지 / mayor 탭에선 시·군 전체가 단일 색인지 / dongResults에 없는 시·군이 있는지 (있다면 빈 시·군은 무색).

dev 서버 종료.

- [ ] **Step 7: 커밋**

```bash
git add src/components/Map/GyeongnamMap.tsx
git commit -m "GyeongnamMap 줌 임계값(level 8)으로 시·군구/동 모드 자동 전환"
```

---

## Task 6: MapContainer 의존성 마이그레이션

**Files:**
- Modify: `src/components/Map/MapContainer.tsx`

기존 사용 컨텍스트 (line 24, 40-80):

```ts
// line 24:
import jinjuDistricts from "@/data/jinju-districts.json";

// line 40-80, 함수 buildDongMappingFromElections:
function buildDongMappingFromElections(
  electionsData: any[],
  localElectionsData: any[],
  type: string,
  isJinju: boolean,           // ← 제거 대상
) {
  // ...
  const staticDistricts = isJinju
    ? ((jinjuDistricts as any)?.types?.[type]?.districts || [])
    : [];
  // staticDistricts 사용처: 색 순서 결정 + 매핑 누락 시 fallback
}
```

호출부도 같이 변경된다.

- [ ] **Step 1: import 교체**

`src/components/Map/MapContainer.tsx` line 24의 `import jinjuDistricts from "@/data/jinju-districts.json";`을 **삭제**하고, 같은 위치에 다음을 추가:

```ts
import type { GyeongnamDistricts } from "@/lib/district-mapping";
```

- [ ] **Step 2: 함수 시그니처 변경**

`buildDongMappingFromElections`의 4번째 매개변수 `isJinju: boolean`을 다음으로 교체:

```ts
function buildDongMappingFromElections(
  electionsData: any[],
  localElectionsData: any[],
  type: string,
  staticDistricts: { name: string; dongs?: string[] }[],
) {
```

그리고 함수 본문 안의

```ts
const staticDistricts = isJinju
  ? ((jinjuDistricts as any)?.types?.[type]?.districts || [])
  : [];
```

블록을 **삭제** (매개변수로 들어옴).

- [ ] **Step 3: 컴포넌트 본문에 gyeongnamDistricts state + fetch 추가**

`MapContainer` 함수 본문에서 기존 state 선언들(예: `boundaryData`, `selectedCityKey` 등) 근처에 다음을 추가:

```ts
const [gyeongnamDistricts, setGyeongnamDistricts] =
  useState<GyeongnamDistricts | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/data/gyeongnam-districts.json")
    .then((r) => r.json())
    .then((data: GyeongnamDistricts) => {
      if (!cancelled) setGyeongnamDistricts(data);
    })
    .catch((e) => console.error("경남 선거구 매핑 로드 실패:", e));
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 4: 호출부 변경**

`buildDongMappingFromElections(...)` 호출처를 모두 찾는다:

Run: `grep -n "buildDongMappingFromElections" src/components/Map/MapContainer.tsx`

각 호출의 4번째 인자 `isJinju`를 다음 식으로 교체:

```ts
(gyeongnamDistricts && selectedCityKey
  ? gyeongnamDistricts[selectedCityKey]?.types?.[type as ElectionType]?.districts ?? []
  : [])
```

`ElectionType` 타입 import도 추가 (Step 1의 import 라인에 합쳐 적기):

```ts
import type { GyeongnamDistricts, ElectionType } from "@/lib/district-mapping";
```

gyeongnamDistricts가 null인 동안엔 staticDistricts가 빈 배열 → 결과 매핑은 elections 데이터만 기반(이 자체로 모든 시·군에 대해 정확). 진주만 fallback이 더 필요할 수 있는데, 자동 추출과 손 매핑이 일치한다는 게 Task 2에서 검증됐으니 무관.

- [ ] **Step 5: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 6: dev 서버에서 진주 페이지 확인**

Run: `npm run dev` → `http://localhost:3000/jinju`

다음을 확인:
- 지도가 정상 표시.
- 선거구 폴리곤이 기존과 동일하게 색칠.
- 4탭 전환 정상 동작.
- 동 hover/click 동작 정상.

dev 서버 종료.

- [ ] **Step 7: 커밋**

```bash
git add src/components/Map/MapContainer.tsx
git commit -m "MapContainer 선거구 매핑을 gyeongnam-districts.json fetch로 전환"
```

---

## Task 7: DistrictDashboard 의존성 마이그레이션

**Files:**
- Modify: `src/components/Map/DistrictDashboard.tsx`

- [ ] **Step 1: import 교체**

`src/components/Map/DistrictDashboard.tsx`에서

```ts
import jinjuDistricts from "@/data/jinju-districts.json";
```

위 라인을 **삭제**한다.

- [ ] **Step 2: gyeongnamDistricts state + fetch 추가**

기존 transitData fetch 패턴과 같은 방식으로 추가:

```ts
const [gyeongnamDistricts, setGyeongnamDistricts] =
  useState<GyeongnamDistricts | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/data/gyeongnam-districts.json")
    .then((r) => r.json())
    .then((data: GyeongnamDistricts) => {
      if (!cancelled) setGyeongnamDistricts(data);
    })
    .catch((e) => console.error("경남 선거구 매핑 로드 실패:", e));
  return () => {
    cancelled = true;
  };
}, []);

// 현재 도시의 선거구 매핑 (cityCode → cityKey 변환은 props.cityCode 또는 cities 매핑 활용).
// DistrictDashboard는 isJinju props가 이미 있으니 진주일 때만 jinju 매핑을 본다.
const cityDistricts = gyeongnamDistricts && isJinju
  ? gyeongnamDistricts.jinju ?? null
  : null;
```

`GyeongnamDistricts` 타입 import도 추가:

```ts
import type { GyeongnamDistricts } from "@/lib/district-mapping";
```

- [ ] **Step 3: jinjuDistricts 참조를 cityDistricts로 치환**

기존 `(jinjuDistricts as any)` 참조를 `cityDistricts`로 변경. cityDistricts가 null이면 districtInfo·관련 useMemo가 null 반환하도록 가드.

- [ ] **Step 4: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 5: 커밋**

```bash
git add src/components/Map/DistrictDashboard.tsx
git commit -m "DistrictDashboard 선거구 매핑을 gyeongnam-districts.json fetch로 전환"
```

---

## Task 8: district/[id]/page.tsx 의존성 마이그레이션

**Files:**
- Modify: `src/app/[city]/district/[id]/page.tsx`

- [ ] **Step 1: import 교체**

`src/app/[city]/district/[id]/page.tsx`에서

```ts
import jinjuDistricts from "@/data/jinju-districts.json";
```

위 라인을 **삭제**한다.

- [ ] **Step 2: gyeongnamDistricts state + fetch 추가 + 사용처 치환**

이미 transitData를 fetch로 받는 패턴이 있으므로 같은 방식으로 추가:

```ts
import type { GyeongnamDistricts } from "@/lib/district-mapping";

// ... 컴포넌트 본문에서 ...
const [gyeongnamDistricts, setGyeongnamDistricts] =
  useState<GyeongnamDistricts | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/data/gyeongnam-districts.json")
    .then((r) => r.json())
    .then((data: GyeongnamDistricts) => {
      if (!cancelled) setGyeongnamDistricts(data);
    })
    .catch((e) => console.error("경남 선거구 매핑 로드 실패:", e));
  return () => {
    cancelled = true;
  };
}, []);

const jinjuDistrictsData = gyeongnamDistricts?.jinju ?? null;
```

기존 `(jinjuDistricts as any)?.types?.[electionType]` 참조를 `jinjuDistrictsData?.types?.[electionType]`로 변경. districtDef 생성 useMemo의 deps에 `jinjuDistrictsData` 추가.

`if (!briefing || !districtDef)` 가드가 이미 있으므로, jinjuDistrictsData가 null인 동안엔 자연스럽게 로딩 상태가 유지된다.

- [ ] **Step 3: 타입 검증**

Run: `npx tsc --noEmit`

Expected: 0 에러.

- [ ] **Step 4: dev 서버에서 진주 선거구 상세 페이지 확인**

Run: `npm run dev` → `http://localhost:3000/jinju/district/<id>` (적당한 id, 예: `진주시가선거구` URL 인코딩)

- 브리핑·인구·상권·선거 탭 정상 표시.
- 4탭 전환 시 매핑 정상 (다른 electionType의 선거구로 이동).

dev 서버 종료.

- [ ] **Step 5: 커밋**

```bash
git add src/app/[city]/district/[id]/page.tsx
git commit -m "district/[id]/page 선거구 매핑을 gyeongnam-districts.json fetch로 전환"
```

---

## Task 9: jinju-districts.json 삭제 + 빌드 검증

**Files:**
- Delete: `src/data/jinju-districts.json`

- [ ] **Step 1: 잔존 참조 확인**

Run: `grep -rn "jinju-districts\|@/data/jinju-districts" src/ scripts/ public/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.py" --include="*.md" 2>/dev/null | grep -v node_modules`

Expected: docs/ 폴더의 spec/plan 파일 외엔 결과 없음 (코드 참조 0건).

만약 코드 참조가 남아 있으면 해당 task로 돌아가 정리.

- [ ] **Step 2: 파일 삭제**

```bash
rm src/data/jinju-districts.json
```

- [ ] **Step 3: 타입 + 빌드 검증**

```bash
npx tsc --noEmit
npm run build
```

Expected: 둘 다 통과 (0 에러).

`npm run build`가 실패하면 webpack 모드에서 import 누락·미해결 import가 있는 것. 에러 메시지의 파일·라인으로 가서 수정.

- [ ] **Step 4: dev 서버 최종 점검**

Run: `npm run dev`

다음 페이지들이 모두 정상 동작하는지 수동 확인:
- `http://localhost:3000/` — 경남 전체 지도. 줌인/줌아웃 시 모드 전환.
- `http://localhost:3000/jinju` — 진주 메인.
- `http://localhost:3000/jinju/district/<진주시가선거구 URL 인코딩>` — 선거구 상세.
- 4탭 전환·hover·클릭 동작.

dev 서버 종료.

- [ ] **Step 5: 커밋**

```bash
git add -u src/data/jinju-districts.json
git commit -m "jinju-districts.json 삭제 — gyeongnam-districts.json으로 완전 대체"
```

---

## Task 10: 동 모드 성능 측정 + 필요 시 viewport culling

이 task는 Task 5 완료 후 305개 폴리곤 렌더링이 매끄러우면 **생략 가능**. 늦은 응답·렉이 보일 때만 진행.

**Files:**
- Modify (조건부): `src/components/Map/GyeongnamMap.tsx`

- [ ] **Step 1: 성능 측정**

`npm run dev`로 페이지 열고 다음 측정:
- 시·군구 → 동 모드 전환 시 렉 여부 (체감 1초 이상이면 부담).
- 동 모드에서 팬·줌 시 fps (Chrome DevTools Performance 탭 권장).

매끄러우면 task 종료. 미흡하면 다음 step.

- [ ] **Step 2: viewport culling 추가 (필요 시)**

dong 모드 effect 안의 폴리곤 생성 루프에 viewport 필터를 추가한다. `map.getBounds()`로 현재 시야의 LatLngBounds를 가져와, feature의 대표 좌표(첫 ring의 첫 좌표)가 bounds 안일 때만 폴리곤 생성. 그리고 `idle` 이벤트로 폴리곤 재계산.

```ts
const bounds = map.getBounds();
for (const feat of dongGeo.features) {
  const [lng, lat] = (feat.geometry.type === "Polygon"
    ? feat.geometry.coordinates[0][0]
    : feat.geometry.coordinates[0][0][0]) as [number, number];
  if (!bounds.contain(new window.kakao.maps.LatLng(lat, lng))) continue;
  // ... 기존 폴리곤 생성 ...
}
```

`idle` 이벤트 리스너 추가:

```ts
const refresh = () => {
  /* effect를 재실행하도록 state bump 또는 직접 재생성 */
};
window.kakao.maps.event.addListener(map, "idle", refresh);
```

- [ ] **Step 3: 커밋 (필요 시)**

```bash
git add src/components/Map/GyeongnamMap.tsx
git commit -m "GyeongnamMap 동 모드 viewport culling 추가 (성능 개선)"
```

---

## Task 11: 푸시

- [ ] **Step 1: 전체 변경 사항 한꺼번에 푸시**

```bash
git push origin main
```

브랜치 ahead 카운트만큼 origin에 반영된다.

---

## 자기 리뷰 체크리스트

- 스펙 4.1 빌드 스크립트 2개 → Task 1, 2.
- 스펙 4.2 GyeongnamMap 줌 모드 + dong 모드 + 데이터 로딩 → Task 4, 5.
- 스펙 4.3 색상 매핑 규칙 → Task 3 (district-mapping.ts).
- 스펙 4.4 마이그레이션 5건(GyeongnamMap·MapContainer·DistrictDashboard·district[id]·jinju-districts.json) → Task 4, 6, 7, 8, 9.
- 스펙 4.5 부수 정책 (DISTRICT_COLORS·mayor 단색·범례) → Task 3, 5.
- 스펙 5 위험 1(305 폴리곤 성능) → Task 10 (조건부).
- 스펙 6 마일스톤 1~5 → Task 1~3, 4~5, 6~9, 9, 10에 대응.
