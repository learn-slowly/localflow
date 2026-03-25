import { API_KEYS, BASE_URLS } from "./config";

export interface BoundaryData {
  STDG_EMD_CD: string;  // 법정동읍면동코드
  EMD_NM_KORN: string;  // 읍면동명한글
  EMD_NM_ENG: string;   // 읍면동명영문
  SGG_NM: string;       // 시군구명
  GEOM: string;         // 지오메트리 공간 데이터
}

export async function fetchBoundary(params?: {
  pageNo?: string;
  numOfRows?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.boundary,
    returnType: "json",
    numOfRows: params?.numOfRows || "100",
    pageNo: params?.pageNo || "1",
  });

  const res = await fetch(`${BASE_URLS.boundary}?${searchParams}`);
  return res.json();
}
