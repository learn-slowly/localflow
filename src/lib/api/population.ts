import { API_KEYS, BASE_URLS } from "./config";

export interface PopulationItem {
  stdgCd: string;        // 법정동코드 10자리
  stdgNm: string;        // 법정동명
  ctpvNm: string;        // 시도명
  sggNm: string;         // 시군구명
  dongNm: string;        // 행정동명
  tong: string;          // 통
  ban: string;           // 반
  totNmprCnt: string;    // 총인구수
  hhCnt: string;         // 세대수
  hhNmpr: string;        // 세대당인구
  maleNmprCnt: string;   // 남자인구수
  femlNmprCnt: string;   // 여자인구수
  maleFemlRate: string;  // 남녀비율
  statsYm: string;       // 통계년월
  admmCd: string;        // 행정기관코드
}

export async function fetchPopulation(params: {
  stdgCd: string;      // 법정동코드 (진주시: 4817000000)
  srchFrYm: string;    // 조회시작년월 (YYYYMM)
  srchToYm: string;    // 조회종료년월 (YYYYMM)
  lv?: string;         // 1:시도 2:시군구 3:읍면동 4:통반 (기본 3)
  regSeCd?: string;    // 1:전체 2:거주자 (기본 1)
  numOfRows?: string;
  pageNo?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    type: "json",
    numOfRows: params.numOfRows || "200",
    pageNo: params.pageNo || "1",
    stdgCd: params.stdgCd,
    srchFrYm: params.srchFrYm,
    srchToYm: params.srchToYm,
    lv: params.lv || "3",
    regSeCd: params.regSeCd || "1",
  });

  const res = await fetch(
    `${BASE_URLS.population}/selectStdgPpltnHhStus?${searchParams}`
  );
  return res.json();
}
