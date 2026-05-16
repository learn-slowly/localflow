# 경남 22개 시·군구 선거구 매핑 확장 설계

작성일: 2026-05-16
상태: 초안 (사용자 리뷰 대기)

## 1. 목표

루트 페이지 경남 지도(`GyeongnamMap`)에서 현재 진주에만 표시되는 선거구별 행정동 코로프레스를 **경남 22개 시·군구 전체**로 확장한다. 4개 선거 유형 탭(기초의원·도의원·국회의원·시장) 모두에 대해 동작.

## 2. 현재 상태

- `GyeongnamMap`은 22개 시·군구 폴리곤(인구 코로프레스)을 그리고, 그 위에 진주 행정동 30개를 선거구별 색으로 오버레이.
- 진주 선거구→행정동 매핑은 `src/data/jinju-districts.json`에 손으로 작성됨.
- 다른 시·군구의 매핑·행정동 폴리곤은 표시 안 함.

## 3. 데이터 가용성 (조사 결과)

| 항목 | 위치 | 상태 |
|------|------|------|
| 22개 시·군구 CityConfig (`code`·`sdCd`·`sggCd`) | `src/config/cities/gyeongnam.ts` | 완비 |
| 시·군 단위 선거 데이터 (기초·도의원·시장) | `public/data/elections/<code>-local-elections.json` | 22개 시·군구 모두 캐시됨 |
| 시·군 단위 선거 데이터 (총선=국회의원) | `public/data/elections/<code>-elections.json` | 22개 시·군구 모두 캐시됨 |
| 전국 행정동 GeoJSON | `public/data/nationwide-boundary.json` (33MB) | 경남 305개 동 포함 |
| 시·군구 단위 GeoJSON | `public/data/gyeongnam-boundary.json` (3.7MB) | 22개 feature |

### 자동 매핑 가능성 검증

- 김해 `local-elections.json` `기초의원` 항목 `dongResults[].district`에 `김해시가선거구`·`김해시나선거구`·`김해시다선거구`·`김해시라선거구` 정확히 표기.
- 도의원 항목엔 `김해시제1선거구` 등.
- `elections.json` 2024 총선 항목엔 `김해시갑/김해시을`.
- **진주 손 매핑 vs 자동 추출 비교 결과 = 100% 일치.** 단, 자동 추출에 `"잘못 투입·구분된 투표지"` 같은 비정상 dong 행이 섞임 → 필터링 필요.

## 4. 설계

### 4.1 데이터 빌드 — 빌드타임 스크립트 2개

#### 스크립트 1: `scripts/build-gyeongnam-districts.ts`

**입력**: `public/data/elections/<code>-local-elections.json` + `<code>-elections.json` × 22개 시·군구
**출력**: `public/data/gyeongnam-districts.json`

**처리**:
1. 각 시·군구 코드에 대해 `local-elections.json` 로드
2. 최신 회차(`sgId=20220601`) 우선, 없으면 직전 회차로 fallback
3. `기초의원`·`도의원`·`시장` subType별로 `dongResults`를 `district`로 group by → `{ districts: [{ name, dongs[] }] }`
4. `elections.json`에서 라벨이 `총선`인 가장 최신 항목 → `assembly` 동일 처리
5. `잘못 투입` 패턴 dong 필터
6. CityConfig의 `key` 필드(`jinju`·`gimhae` 등)로 인덱싱

**출력 형식**:
```json
{
  "jinju": {
    "name": "진주시",
    "code": "48170",
    "types": {
      "local":      { "election": "2022 지선 (제8회) 기초의원", "districts": [{"name":"진주시가선거구","dongs":["문산읍",...]}, ...] },
      "provincial": { "election": "2022 지선 (제8회) 도의원",   "districts": [...] },
      "assembly":   { "election": "2024 총선 (제22대)",        "districts": [...] },
      "mayor":      { "election": "2022 지선 (제8회) 시장",     "districts": [{"name":"진주시장","dongs":[모든 동]}] }
    }
  },
  "gimhae":  { ... },
  ...
}
```

#### 스크립트 2: `scripts/build-gyeongnam-dong-boundary.ts`

**입력**: `public/data/nationwide-boundary.json`
**출력**: `public/data/gyeongnam-dong-boundary.json` (예상 3~5MB)

**처리**:
1. features 중 `properties.sido === "48"`만 필터 → 305개
2. `properties.sgg` 5자리 코드와 `properties.adm_nm` 동명을 표준화하여 보존
3. 시·군구 키(예: `changwon-uichang`) 매핑: `gyeongnam-cities.json`의 sgg→key 맵 활용 또는 CityConfig 참조

### 4.2 GyeongnamMap 일반화

#### 줌 모드 전환

- 카카오맵 `zoom_changed` 이벤트 리스너 등록 → state `mode: "sgg" | "dong"`
- 임계값: 카카오 level **≤ 8** → `dong` 모드 / **> 8** → `sgg` 모드
- 모드 전환 시 폴리곤 dispose + 재생성 (효과: 시각적으로 한 모드만 보임)

#### `sgg` 모드 (현행 유지)

- 22개 시·군구 폴리곤 + 인구 코로프레스
- 클릭 시 `/[city]`로 이동
- 진주 행정동 오버레이는 **제거** (모드 분리 후 의미 없음)

#### `dong` 모드 (신규)

- 305개 행정동 폴리곤
- 색깔 결정: 선택된 `electionType` 탭에 따라 `gyeongnam-districts.json[cityKey].types[electionType]` 매핑 조회 → 시·군 내 선거구 idx로 `DISTRICT_COLORS[idx % 8]` 적용
- 시·군 간 색 충돌은 시·군 경계로 자연 구분
- 동 클릭 시 `/[city]` 이동 (현행 진주 동 클릭과 동일)
- 동 hover 시 fill opacity 강조 (현행 진주 동작 동일)

#### 데이터 로딩

- `gyeongnam-districts.json`은 마운트 시 1회 fetch (작음, ~50KB 예상)
- `gyeongnam-dong-boundary.json`은 `dong` 모드 진입 시 lazy fetch + 캐시 (~3-5MB)
- 시·군구 boundary는 현행대로 즉시 fetch

### 4.3 색상 매핑 규칙

```ts
function dongDistrictColor(
  districtsByType: GyeongnamDistricts,
  cityKey: string,
  electionType: ElectionType,
  dongName: string,
): { name: string; color: string } | null {
  const config = districtsByType[cityKey]?.types[electionType];
  if (!config) return null;
  const idx = config.districts.findIndex(d => d.dongs.includes(dongName));
  if (idx < 0) return null;
  return { name: config.districts[idx].name, color: DISTRICT_COLORS[idx % DISTRICT_COLORS.length] };
}
```

`mayor` 탭은 districts 길이가 1이라 시·군 전체가 단일 색 (DISTRICT_COLORS[0]).

### 4.4 마이그레이션

| 대상 | 변경 |
|------|------|
| `src/data/jinju-districts.json` | 폐기 (gyeongnam-districts.json의 `jinju` 항목으로 대체) |
| `GyeongnamMap.tsx`의 `jinjuDongDistrictMap` | 일반 `dongDistrictMap` 헬퍼로 교체 |
| 진주 행정동 오버레이 effect | dong 모드 effect로 일반화 |
| `MapContainer.tsx`의 `jinju-districts.json` import | `gyeongnam-districts.json`을 useEffect+fetch로 로드 후 `data.jinju` 사용 (dev 메모리 정책에 따른 fetch 전환) |
| `DistrictDashboard.tsx`의 `jinju-districts.json` import | 동일 |
| `district/[id]/page.tsx`의 `jinju-districts.json` import | 동일 |

### 4.5 부수 정책

- **색상 팔레트**: 현행 `DISTRICT_COLORS` 8색 그대로. 시·군 내 idx 순환.
- **시장 탭**: 시·군당 단일 선거구 → 시·군 전체 단색. 사실상 시·군 단위 단색 효과.
- **인구 코로프레스**: `sgg` 모드에서만 표시 (현행 동작 유지).
- **범례**: 현재 인구 6단계 범례 → `dong` 모드에선 선거구별 색이라 범례가 시·군마다 다름. 일단 인구 범례 숨김 + "선거구 색칠" 안내 텍스트로 대체.

## 5. 트레이드오프 / 위험

1. **카카오맵 305개 폴리곤 동시 렌더 성능 미검증** — 진주 30개는 매끄러움. 10배 규모를 한 번 측정해본 후 필요 시 viewport culling(`map.getBounds()` 기반) 추가.
2. **손 매핑 차단** — 데이터(`dongResults`)에 없는 동·선거구는 표시 못 함. 22개 시·군 모두 확인됐으니 실용상 무관할 듯.
3. **`gyeongnam-dong-boundary.json` 3~5MB lazy fetch** — 첫 줌인 시 네트워크 지연 가능. 캐싱·압축으로 완화.
4. **국회의원 선거구의 시·군 경계 초과** — 김해갑·김해을은 김해 내부 매핑이지만, 향후 인접 시·군을 묶는 국회의원 선거구(예: 사천·남해·하동)는 단일 시·군 elections 파일에 없음. 1차에서는 각 시·군 elections.json 내부에 들어 있는 매핑만 사용. 시·군 경계를 넘는 매핑은 후속.

## 6. 마일스톤

1. 빌드 스크립트 2개 작성 + 산출물 생성
2. `GyeongnamMap` 일반화 (줌 모드 + dong 모드 effect)
3. `jinju-districts.json` 의존성 마이그레이션 (3개 컴포넌트)
4. `jinju-districts.json` 삭제
5. 성능 검증 + 필요 시 viewport culling

## 7. 비목표 (Out of Scope)

- 시·군 경계를 넘는 국회의원 선거구 (사천·남해·하동 같은 묶음 선거구)
- 다른 회차(2018년 등) 선거구 표시
- 모바일 전용 최적화
- 도시 외 다른 도(경북·전남 등)로의 확장
