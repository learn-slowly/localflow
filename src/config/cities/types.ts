export interface CityConfig {
  code: string;           // 시군구 코드 5자리 (예: "38030")
  name: string;           // 도시명 (예: "진주시")
  province: string;       // 시도명 (예: "경상남도")
  center: [number, number]; // 지도 중심 좌표 [위도, 경도]
  zoom: number;           // 기본 줌 레벨
  sdCd: string;           // 시도코드 2자리 (교통카드 빅데이터용)
  sggCd: string;          // 시군구코드 5자리 (교통카드 빅데이터용)
  electionId: string;     // 선관위 선거ID
}
