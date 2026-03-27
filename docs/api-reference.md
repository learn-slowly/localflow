# LocalFlow API Reference

## 인증키 요약

| 구분 | 환경변수 | 비고 |
| --- | --- | --- |
| 공공데이터포털 (data.go.kr) 9건 | `DATA_GO_KR_API_KEY` | 공통 키 1개 |
| 교통카드 빅데이터 | `TRANSIT_API_KEY` | 별도 사이트, 키 미등록 |
| 행정경계 (읍면동 법정경계) | `BOUNDARY_API_KEY` | 별도 키, 승인 대기 중 |

---

## 1. 행정안전부 — 법정동별 주민등록 인구 및 세대현황

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/1741000/stdgPpltnHhStus`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/selectStdgPpltnHhStus` | 법정동별 주민등록 인구 및 세대현황 목록 조회 |

- **응답 항목**: 시도명, 시군구명, 법정동명, 리명, 행정기관코드, 행정동명, 통, 반, 총인구수, 세대수, 세대당 인구, 남자인구수, 여자인구수, 남녀비율

---

## 2. 읍면동 법정경계 (한국지역정보개발원, 재난안전데이터)

- **키**: `BOUNDARY_API_KEY`

- **Endpoint**: `https://www.safetydata.go.kr/V2/api/DSSP-IF-10467`

- **API 유형**: REST

- **데이터 포맷**: JSON

- **제공기관**: 한국지역정보개발원

- **갱신주기**: 월 1회

- **일일 호출량**: 100건 (0이면 최대 1,000건)

- **만료일자**: 2027-03-25

- **요청 파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | serviceKey | Y | 서비스키 |
  | numOfRows | N | 페이지당 개수 |
  | pageNo | N | 페이지번호 |
  | returnType | N | 응답타입 (json, xml) |

- **응답 항목**:

  | 항목 | 영문 | 설명 |
  | --- | --- | --- |
  | 법정동읍면동코드 | STDG_EMD_CD | 법정동 코드 |
  | 읍면동명한글 | EMD_NM_KORN | 읍면동명 (한글) |
  | 읍면동명영문 | EMD_NM_ENG | 읍면동명 (영문) |
  | 시군구명 | SGG_NM | 시군구명 |
  | 지오메트리 | GEOM | 경계 공간 데이터 |

- **용도**: 행정동 경계 오버레이 (GEOM 필드가 핵심)

---

## 3. 소상공인시장진흥공단 — 상가(상권)정보

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/B553077/api/open/sdsc2`

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/storeListInDong` | 행정동 단위 상가업소 조회 |
  | GET | `/storeListInRadius` | 반경내 상가업소 조회 |
  | GET | `/storeListInRectangle` | 사각형내 상가업소 조회 |
  | GET | `/storeListInPolygon` | 다각형내 상가업소 조회 |
  | GET | `/storeListInUpjong` | 업종별 상가업소 조회 |
  | GET | `/storeZoneOne` | 지정 상권조회 |
  | GET | `/storeZoneInRadius` | 반경내 상권조회 |
  | GET | `/storeZoneInAdmi` | 행정구역 단위 상권조회 |
  | GET | `/baroApi` | 행정경계조회 (시도/시군구/읍면동) |
  | GET | `/largeUpjongList` | 업종 대분류 조회 |
  | GET | `/middleUpjongList` | 업종 중분류 조회 |
  | GET | `/smallUpjongList` | 업종 소분류 조회 |

- **일일 트래픽**: 각 10,000건

- **데이터 포맷**: JSON + XML

- **업종 분류**: 대분류(10개/2자리), 중분류(75개/4자리), 소분류(247개/6자리)

- **데이터 출처**: 국세청/카드사

---

## 4. 중앙선거관리위원회 — 투·개표 정보

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/9760000/VoteXmntckInfoInqireService2`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/getVoteSttusInfoInqire` | 투표 결과 (선거인수, 투표자수, 투표율 등) |
  | GET | `/getXmntckSttusInfoInqire` | 개표 결과 (득표수, 유효/무효투표수, 정당명, 후보자명 등) |

- **파라미터**: 선거ID, 선거종류, 시도명, 구시군명, 선거구명

---

## 7-1. 중앙선거관리위원회 — 코드 정보 (선관위 API 공통 유틸)

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/9760000/CommonCodeService`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 각 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/getCommonSgCodeList` | 선거코드 (선거ID, 선거종류코드, 선거명) |
  | GET | `/getCommonGusigunCodeList` | 구시군코드 |
  | GET | `/getCommonSggCodeList` | 선거구코드 |
  | GET | `/getCommonPartyCodeList` | 정당코드 |
  | GET | `/getCommonJobCodeList` | 직업코드 |
  | GET | `/getCommonEduBckgrdCodeList` | 학력코드 |

- **용도**: 선관위 다른 API 호출 시 필요한 선거ID, 선거구코드 등을 조회

---

## 7-2. 중앙선거관리위원회 — 후보자 정보

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/9760000/PofelcddInfoInqireService`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 각 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/getPoelpcddRegistSttusInfoInqire` | 예비후보자 정보 (후보자등록 개시일부터 조회 불가) |
  | GET | `/getPofelcddRegistSttusInfoInqire` | 후보자 정보 (정당명, 직업, 학력, 경력, 기호 등) |

- **파라미터**: 선거ID, 선거종류, 선거구명, 시도명

---

## 8. 중앙선거관리위원회 — 선거인수 정보

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/9760000/ElcntInfoInqireService`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 각 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/getCtpvElcntInfoInqire` | 시도별 선거인수 |
  | GET | `/getGsigElcntInfoInqire` | 구시군별 선거인수 |
  | GET | `/getElpcElcntInfoInqire` | 선거구별 선거인수 |
  | GET | `/getEmdElcntInfoInqire` | 읍면동별 선거인수 |
  | GET | `/getVtdsElcntInfoInqire` | 투표구별 선거인수 |

---

## 9. 중앙선거관리위원회 — 투표소 정보

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/9760000/PolplcInfoInqireService2`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 각 10,000건

- **주요 API**:

  | 메서드 | 경로 | 설명 |
  | --- | --- | --- |
  | GET | `/getPrePolplcOtlnmapTrnsportInfoInqire` | 사전투표소 정보 |
  | GET | `/getPolplcOtlnmapTrnsportInfoInqire` | 선거일투표소 정보 |

- **파라미터**: 선거ID, 시도명, 구시군명

- **응답 항목**: 투표소명, 시도명, 위원회명, 읍면동명, 건물명, 주소, 층수 등

- **비고**: 직전 선거 기준 데이터만 존재, 이번 선거분 미확정

---

## 10. 국토교통부 — 지역별 교통카드이용 합성데이터

- **키**: `DATA_GO_KR_API_KEY` (data.go.kr 공통 키)

- **Endpoint**: `https://apis.data.go.kr/1613000/RegionalTransportationCardUsageSyntheticData`

- **데이터 포맷**: JSON + XML

- **일일 트래픽**: 각 1,000건

- **용도**: 승하차 데이터 → 유동인구 추정

- **주요 API** (지역별 endpoint):

  | 메서드 | 경로 | 지역 |
  | --- | --- | --- |
  | GET | `/getSeoulTransportationCardUsageSyntheticData` | 서울 |
  | GET | `/getGyeonggiTransportationCardUsageSyntheticData` | 경기 |
  | GET | `/getIncheonTransportationCardUsageSyntheticData` | 인천 |
  | GET | `/getBusanTransportationCardUsageSyntheticData` | 부산 |
  | GET | `/getDaeguTransportationCardUsageSyntheticData` | 대구 |
  | GET | `/getGwangjuTransportationCardUsageSyntheticData` | 광주 |
  | GET | `/getDaejeonTransportationCardUsageSyntheticData` | 대전 |
  | GET | `/getUlsanTransportationCardUsageSyntheticData` | 울산 |
  | GET | `/getJejuTransportationCardUsageSyntheticData` | 제주 |

- **주의: 경남/진주 미지원** — 현재 9개 광역시/도만 제공. 진주시 데이터 없음.

---

## 11. 교통카드 빅데이터 통합정보시스템 (별도 사이트)

- **키**: `TRANSIT_API_KEY`
- **Base URL**: `https://stcis.go.kr/openapi`
- **데이터 포맷**: JSON

### 11-1. 지역코드 API

- **URL**: `https://stcis.go.kr/openapi/areacode.json`

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | apikey | 필수 | 발급받은 API 키 |
  | sdCd | 선택 | 시/도 코드 (2자리) |
  | sggCd | 선택 | 시/군/구 코드 (5자리) |

- **응답 항목**:

  - 파라미터 없이 호출 → 시/도 코드(sdCd), 시/도명(sdNm)
  - sdCd 지정 → 시/군/구 코드(sggCd), 시/군/구명(sggNm)
  - sggCd 지정 → 읍/면/동 코드(emdCd), 읍/면/동명(emdNm)

- **상태값**: OK(성공), NOT_FOUND(결과없음), ERROR(에러)

### 11-2. 15분단위 OD API

- **URL**: `https://stcis.go.kr/openapi/quarterod.json`

- **용도**: 읍면동 간 15분 단위 이동인원 — 유동인구 핵심 데이터

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | apikey | 필수 | 발급받은 API 키 |
  | opratDate | 필수 | 운행일자 (8자리, YYYYMMDD) |
  | stgEmdCd | 필수 | 출발지 읍/면/동 코드 (10자리) |
  | arrEmdCd | 필수 | 도착지 읍/면/동 코드 (10자리) |

- **응답 항목**:

  \[table\]

### 11-3. 버스 노선별 경유정류장정보 API

- **URL**: `https://stcis.go.kr/openapi/busroutesttn.json`

- **용도**: 노선별 경유 정류장 목록 및 위치(읍면동) 조회

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | apikey | 필수 | 발급받은 API 키 |
  | sdCd | 선택 | 시/도 코드 (2자리) |
  | sggCd | 선택 | 시/군/구 코드 (5자리) |
  | emdCd | 선택 | 읍/면/동 코드 (10자리) |
  | routeId | 필수 | 노선ID |

  - sdCd/sggCd/emdCd 중 하나는 필수

- **응답 항목**: routeId, routeNo(노선번호), routeNm(노선명), sttnSeq(정류장 순번), sttnId, sttnNm(정류장명), sdCd/sdNm, sggCd/sggNm, emdCd/emdNm

### 11-4. 버스 정류장정보 API

- **URL**: `https://stcis.go.kr/openapi/bussttn.json`

- **용도**: 지역별 버스 정류장 목록 조회

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | apikey | 필수 | 발급받은 API 키 |
  | sdCd | 선택 | 시/도 코드 (2자리) |
  | sggCd | 선택 | 시/군/구 코드 (5자리) |
  | emdCd | 선택 | 읍/면/동 코드 (10자리) |
  | sttnArsno | 선택 | 정류장 ARS번호 |

  - sdCd/sggCd/emdCd 중 하나는 필수

- **응답 항목**: sttnId, bimsId(BIMS ID), sttnNm(정류장명), sttnArsno(ARS번호), sdCd, sggCd, emdCd

### 11-5. 도시철도 노선정보 API

- **URL**: `https://stcis.go.kr/openapi/rlrdroute.json`
- **용도**: 도시철도(지하철) 노선 목록 조회
- **파라미터**: apikey만 필수
- **응답 항목**: area(지역), routenm(노선명), stgsttnnma(기점), arrsttnnma(종점)
- **비고**: 진주에는 도시철도 없으므로 당장 불필요, 다른 도시 확장 시 활용

### 11-6. 버스 노선정보 API

- **URL**: `https://stcis.go.kr/openapi/busroute.json`

- **용도**: 시도 내 버스 노선 조회 (노선ID, 기점, 종점)

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | apikey | 필수 | 발급받은 API 키 |
  | sdCd | 필수 | 시/도 코드 (2자리) |
  | routeNo | 필수 | 노선번호 |

- **응답 항목**: routeId(노선ID), routeNo(노선번호), stgSttnNma(기점), arrSttnNma(종점)

### 11-7. 도시철도 노선별 경유역정보 API

- **URL**: `https://stcis.go.kr/openapi/rlrdroutesttn.json`
- **용도**: 도시철도 노선별 경유역 목록
- **파라미터**: apikey(필수), routeNm(선택, 노선명)
- **응답 항목**: routenm(노선명), sttnnm(역명), sttnid(역ID), sttnseq(역순번)
- **비고**: 진주 해당 없음, 다른 도시 확장 시 활용

---

## 12. 국토교통부 — 정류장별 노선별 승하차인원 (일별)

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/1613000/StopbyRouteTripVolume/getDailyStopbyRouteTripVolume`

- **데이터 포맷**: JSON

- **일일 트래픽**: 제한 있음 (대량 호출 시 429 발생, 일 약 2,000\~3,000페이지 수준)

- **용도**: 버스 정류장별 시간대·요일별 승하차 인원 → 대중교통 히트맵 레이어

- **파라미터**:

  | 파라미터 | 필수 | 설명 |
  | --- | --- | --- |
  | serviceKey | Y | 서비스키 |
  | dataType | N | json / xml |
  | numOfRows | N | 페이지당 건수 (기본 10, 최대 100) |
  | pageNo | N | 페이지번호 |
  | opr_ymd | Y | 운행일자 (YYYYMMDD) |
  | ctpv_cd | N | 시도코드 (2자리, 예: 48=경남) |
  | sgg_cd | N | 시군구코드 (5자리, 예: 48170=진주시) |

- **응답 항목**:

  | 항목 | 설명 |
  | --- | --- |
  | opr_ymd | 운행일자 |
  | dow_cd / dow_nm | 요일코드 / 요일명 |
  | ctpv_cd / ctpv_nm | 시도코드 / 시도명 |
  | sgg_cd / sgg_nm | 시군구코드 / 시군구명 |
  | emd_cd / emd_nm | 읍면동코드 / 읍면동명 |
  | sttn_id / sttn_nm | 정류장ID / 정류장명 |
  | sttn_arsno | 정류장 ARS번호 |
  | tzon | 시간대 (HH) |
  | ride_nope | 승차인원 |
  | goff_nope | 하차인원 |

- **비고**: 진주시 기준 일 약 32,000건 (320페이지). 요일별 패턴 분석을 위해 같은 요일 2일치씩 수집하여 합산. `scripts/fetch-transit-remaining.py` 참조.

---

## 13. 행정안전부 — 우수 다중이용시설 (생활안전지도)

- **키**: `SAFETY_API_KEY` (값: `JG87ETU4-JG87-JG87-JG87-JG87ETU4XZ`)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 행정안전부

- **갱신주기**: 1년

- **주요항목**: 다중이용업소 안전관리 우수업소 공표현황

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0005`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0005_WMS`

- **비고**: XML로 목록 조회, WMS로 지도 레이어 오버레이 가능. 상세 파라미터 확인 후 업데이트 예정.

---

## 14. 행정안전부 — 관공서 (민원행정기관 전자지도)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 행정안전부 협업정책과 (044-205-2249)

- **갱신주기**: 1년

- **주요항목**: 중앙행정기관, 지방자치단체청사, 법원, 세관 등 행정기관 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0031`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0031_WMS`

---

## 15. 근로복지공단 — 병의원 (산재지정병원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 근로복지공단 재활국/요양부

- **갱신주기**: 1년

- **주요항목**: 산업재해 근로자 치료·재활을 위한 산재지정병원 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0025`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0025_WMS`

---

## 16. 국립중앙의료원 — 병의원 (보건소)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 지역보건법에 따라 설치된 보건소 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0024`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0024_WMS`

---

## 17. 국립중앙의료원 — 병의원 (병/의원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 외래환자 대상 의료기관 (의원, 치과의원, 한의원 등) 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0026`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0026_WMS`

---

## 18. 국립중앙의료원 — 병의원 (한방병의원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 한의사 의료기관 (입원 30명 이상 시설) 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0028`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0028_WMS`

---

## 19. 국립중앙의료원 — 병의원 (요양병원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 요양병원 (30병상 이상, 장기입원 환자 대상) 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0027`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0027_WMS`

---

## 20. 국립중앙의료원 — 병의원 (치과병의원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 치과 의료기관 (입원 30명 이상 시설) 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0029`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0029_WMS`

---

## 21. 국립중앙의료원 — 병의원 (종합병원)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 종합병원 (100병상 이상, 7\~9개 진료과목) 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0022`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0022_WMS`

---

## 22. 국립중앙의료원 — 약국

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 약국 위치·주소·진료요일 등 목록 조회

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0048`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0048_WMS`

---

## 23. 국립중앙의료원 — 응급의료시설

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: WMS only

- **제공기관**: 국립중앙의료원

- **갱신주기**: 일단위

- **주요항목**: 응급의료기관 (중앙·권역·전문·지역 응급의료센터) 위치

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0047_WMS`

---

## 24. 행정안전부 — 어린이놀이시설정보

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 행정안전부 안전개선과 (044-205-4213)

- **갱신주기**: 1년

- **주요항목**: 전국 어린이놀이시설 시설정보 조회

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0007`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0007_WMS`

---

## 25. 교육부/보건복지부 — 유아시설

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 교육부 (유치원), 보건복지부 (어린이집)

- **갱신주기**: 1년

- **주요항목**: 유치원 기본현황 + 어린이집 기본정보 조회

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0037`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0037_WMS`

---

## 26. 보건복지부 — 약자보호시설

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 보건복지부

- **갱신주기**: 1년

- **주요항목**: 성폭력지원시설, 자살예방센터, 장애인편의시설 위치

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0053`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0053_WMS`

---

## 27. 교육부 — 학교 (대학교)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 교육부

- **갱신주기**: 1년

- **주요항목**: 학교알리미 서비스 — 대학교 위치 정보

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0034`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0034_WMS`

---

## 28. 교육부 — 학교 (초·중·고·기타)

- **키**: `SAFETY_API_KEY` (동일)

- **API 유형**: REST

- **데이터 포맷**: XML + WMS

- **제공기관**: 교육부

- **갱신주기**: 1년

- **주요항목**: 학교알리미 서비스 — 전국 초·중·고등학교 및 기타 학교 위치·공시정보

- **XML Endpoint**: `https://safemap.go.kr/openapi2/IF_0035`

- **WMS Endpoint**: `https://safemap.go.kr/openapi2/IF_0035_WMS`

---

## 29. 행정안전부 — 전통시장 안전점검결과 (재난안전데이터)

- **키**: `SAFETY_DATA_API_KEY` (값: `KXWDY78ZZPL2EDJ3`)

- **Endpoint**: `https://www.safetydata.go.kr/V2/api/DSSP-IF-10671`

- **API 유형**: REST

- **데이터 포맷**: JSON

- **제공기관**: 행정안전부

- **갱신주기**: 신청

- **만료일자**: 2027-03-27

- **일일 호출량**: 100건 (0이면 최대 1,000건)

- **주요항목**: 전통시장 안전점검결과 상세정보

---

## 30. 공공데이터포털 — 전국전통시장표준데이터

- **키**: `DATA_GO_KR_API_KEY`

- **Endpoint**: `https://apis.data.go.kr/openapi/tn_pubr_public_trdit_mrkt_api`

- **데이터 포맷**: JSON + XML (현재 CSV 파일로 사용 중)

- **주요항목**: 시장명, 시장유형, 주소, 위도/경도, 점포수, 취급품목, 개설연도, 전화번호

- **비고**: API 500 에러 간헐 발생 → CSV 파일(`src/data/전국전통시장표준데이터.csv`)로 대체. 진주시 16개 시장.