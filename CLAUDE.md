# LocalFlow

## 언어

코드 주석, 커밋 메시지, 응답 모두 **한국어**

## 프로젝트

LocalFlow: 지역 선거 유동인구 분석 플랫폼
- 도시코드 하나만 바꾸면 전국 어떤 시·군에도 적용 가능한 구조
- 첫 번째 대상 도시: **진주시** (기초의원 선거)
- Next.js 16 + TypeScript + Tailwind CSS
- 지도: 현재 Leaflet 사용 중 (카카오맵 API 승인 후 전환 예정)
- 데이터: 공공데이터포털 API + 교통카드 빅데이터 API + 재난안전데이터 API
- 배포: Vercel
- API 상세: `docs/api-reference.md` 참조

## 핵심 규칙

- `docs/plan.md`가 프로젝트 계획서. 새 기능 구현 전에 반드시 참조
- `docs/api-reference.md`가 API 명세. 엔드포인트·파라미터는 여기서 확인
- **도시 독립 원칙**: 모든 API 호출과 컴포넌트는 CityConfig를 통해 도시코드를 주입받아야 함. 특정 도시 하드코딩 절대 금지
- API 키는 반드시 Next.js API Routes 경유 (클라이언트 노출 금지). 단, 카카오맵 JavaScript 키는 `NEXT_PUBLIC_` 접두어 사용
- 공공데이터포털 API 응답은 XML/JSON 혼재 — 래퍼에서 정규화하여 통일된 타입으로 반환
- [카카오맵 전환 후] SDK는 Script 컴포넌트 또는 useEffect에서 동적 로드
- [카카오맵 전환 후] `window.kakao.maps` 네임스페이스 사용. 타입 선언 필요 (`kakao.maps.d.ts`)
- 1차에서 DB(Supabase) 미사용. API 직접 호출 + Next.js ISR 캐싱

## 도시 확장 규칙

- 새 도시 추가 = `src/config/cities/`에 설정 파일 1개 추가
- CityConfig 인터페이스: `code`(시군구 5자리), `name`, `province`, `sdCode`(시도 2자리), `center`, `zoom`, `electionId`
- URL 구조: `/[city]/` 동적 라우팅 (예: `/jinju`, `/changwon`) — 다른 도시 추가 시 적용 예정, 현재는 단일 페이지
- 선거구 매핑은 `src/config/districts/`에서 수동 관리 (API 미제공)
- 교통카드 빅데이터 API는 시도코드(2자리)/시군구코드(5자리)/읍면동코드(10자리) 체계

## API 키 구조 (5종)

```env
# 공공데이터포털 — 공통 키 (서버 전용, 9건 공유)
DATA_GO_KR_API_KEY=

# 읍면동 법정경계 — 재난안전데이터 (서버 전용)
BOUNDARY_API_KEY=

# 교통카드 빅데이터 통합정보시스템 (서버 전용, stcis.go.kr)
TRANSIT_API_KEY=

# 카카오맵 JavaScript 키 (클라이언트 허용)
NEXT_PUBLIC_KAKAO_MAP_KEY=

# 카카오 REST API 키 (서버 전용, 주소검색·좌표변환 등)
KAKAO_REST_API_KEY=
```

## API 소스 매핑 (5개 도메인)

### 인구 (`population.ts`)
- 행정안전부 법정동별 주민등록 인구·세대현황 (`DATA_GO_KR_API_KEY`)
- 선관위 읍면동별/선거구별/투표구별 선거인수 (`DATA_GO_KR_API_KEY`)

### 교통 (`transport.ts`)
- 교통카드 빅데이터 (stcis.go.kr, `TRANSIT_API_KEY`):
  - 버스정류장 정보 (`bussttn`)
  - 버스노선 정보 (`busroute`)
  - 노선별 경유정류장 (`busroutesttn`)
  - 15분단위 OD 데이터 (`quarterod`) — 유동인구 핵심
  - 도시철도 (`rlrdroute`, `rlrdroutesttn`) — 진주 해당 없음, 확장용
- **주의**: data.go.kr 교통카드 합성데이터(#10)는 경남 미지원 → stcis.go.kr 사용

### 상권 (`commerce.ts`)
- 소상공인 상가(상권)정보 (`DATA_GO_KR_API_KEY`):
  - 행정동/반경/사각형/다각형 단위 상가업소 조회
  - 업종 대/중/소분류 조회
  - 행정경계(시도/시군구/읍면동) 조회

### 선거 (`election.ts`)
- 선관위 코드정보: 선거ID, 선거구코드, 정당코드 (`DATA_GO_KR_API_KEY`)
- 선관위 투·개표정보: 투표율, 득표수 (`DATA_GO_KR_API_KEY`)
- 선관위 투표소정보: 사전투표소, 선거일투표소 (`DATA_GO_KR_API_KEY`)
- 선관위 후보자정보: 정당, 기호, 경력 (`DATA_GO_KR_API_KEY`)

### 경계 (`boundary.ts`)
- 읍면동 법정경계 (safetydata.go.kr, `BOUNDARY_API_KEY`):
  - GEOM 필드로 행정동 폴리곤 제공
  - 일일 100건 제한 → 최초 호출 후 반드시 `public/data/`에 GeoJSON 캐시

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx              # 랜딩/도시 선택
│   ├── [city]/page.tsx       # 도시별 지도 메인
│   └── api/                  # API Routes (프록시)
│       ├── population/
│       ├── transport/
│       ├── commerce/
│       ├── election/
│       └── boundary/
├── components/
│   ├── Map/                  # 카카오맵 컴포넌트
│   ├── Layers/               # 데이터 레이어
│   │   ├── PopulationLayer/
│   │   ├── TransportLayer/
│   │   ├── CommerceLayer/
│   │   ├── ElectionLayer/
│   │   └── BoundaryLayer/
│   └── UI/                   # 공통 UI (사이드바, 레이어 토글)
├── lib/api/                  # API 래퍼
│   ├── population.ts         # 행안부 인구 + 선관위 선거인수
│   ├── transport.ts          # 교통카드 빅데이터 (stcis.go.kr)
│   ├── commerce.ts           # 소상공인 상권
│   ├── election.ts           # 선관위 (코드/투개표/후보자/투표소)
│   ├── boundary.ts           # 행정경계 (safetydata.go.kr)
│   ├── types.ts              # API 응답 타입
│   └── config.ts             # 베이스 URL, 키 관리
├── config/
│   ├── cities/               # 도시별 설정
│   └── districts/            # 선거구-행정동 매핑
└── types/                    # 공통 앱 타입
```

## API 래퍼 규칙

- `src/lib/api/` 아래 도메인별 분리: population, transport, commerce, election, boundary
- 모든 함수는 CityConfig 또는 도시코드를 첫 번째 인자로 받음
- data.go.kr API: `resultCode !== "00"` 시 throw
- stcis.go.kr API: `status !== "OK"` 시 throw (`NOT_FOUND`, `ERROR` 구분)
- 행정경계 API: 일일 100건 → 최초 호출 후 `public/data/`에 GeoJSON 캐시
- 교통카드 OD API: `opratDate`(YYYYMMDD) + 출발/도착 읍면동코드(10자리) 필수

## 레이어 컴포넌트 규칙

- 각 레이어는 독립적으로 토글 가능해야 함
- 레이어 컴포넌트는 데이터 fetch + 렌더링을 자체적으로 처리
- 현재 Leaflet 기반: react-leaflet의 GeoJSON, CircleMarker, MarkerClusterGroup 사용
- [카카오맵 전환 후] CustomOverlay → React 포탈, Polygon/Marker → kakao.maps 네임스페이스
- 히트맵은 커스텀 캔버스 오버레이로 구현
- z-index 순서: BoundaryLayer(최하) → ElectionLayer → PopulationLayer → TransportLayer → CommerceLayer(최상)
