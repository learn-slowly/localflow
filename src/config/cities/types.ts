export interface CityConfig {
  code: string;           // 행정표준코드 5자리 (예: "48170") — 경계 데이터·공공API 공통
  name: string;           // 도시명 (예: "진주시")
  province: string;       // 시도명 (예: "경상남도")
  center: [number, number]; // 지도 중심 좌표 [위도, 경도]
  zoom: number;           // 기본 줌 레벨
  sdCd: string;           // 시도코드 2자리 (교통카드 빅데이터용, stcis.go.kr)
  sggCd: string;          // 시군구코드 5자리 (교통카드 빅데이터용, stcis.go.kr)
  electionId: string;     // 선관위 선거ID
}
