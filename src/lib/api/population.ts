import { API_KEYS, BASE_URLS } from "./config";

export interface PopulationData {
  stdgCd: string;        // 행정기관코드
  stdgNm: string;        // 행정동명
  ctpvNm: string;        // 시도명
  signguNm: string;      // 시군구명
  stdgDongNm: string;    // 법정동명
  liNm: string;          // 리명
  tong: string;          // 통
  ban: string;           // 반
  totPpltnCo: number;    // 총인구수
  hhCo: number;          // 세대수
  hhPpltn: number;       // 세대당인구
  maleePpltnCo: number;  // 남자인구수
  fmaleePpltnCo: number; // 여자인구수
  mfRatio: number;       // 남녀비율
}

export async function fetchPopulation(params: {
  ctpvNm?: string;  // 시도명
  signguNm?: string; // 시군구명
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    type: "json",
    numOfRows: "1000",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.population}/selectStdgPpltnHhStus?${searchParams}`
  );
  return res.json();
}
