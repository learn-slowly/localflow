import { API_KEYS, BASE_URLS } from "./config";

export interface CommerceData {
  bizesId: string;       // 상가업소번호
  bizesNm: string;       // 상호명
  brchNm: string;        // 지점명
  indsLclsCd: string;    // 업종대분류코드
  indsLclsNm: string;    // 업종대분류명
  indsMclsCd: string;    // 업종중분류코드
  indsMclsNm: string;    // 업종중분류명
  indsSclsCd: string;    // 업종소분류코드
  indsSclsNm: string;    // 업종소분류명
  lnoAdr: string;        // 지번주소
  rdnmAdr: string;       // 도로명주소
  lon: number;           // 경도
  lat: number;           // 위도
}

export async function fetchCommerceByDong(params: {
  divId: string;    // "adongCd" (행정동코드)
  key: string;      // 행정동코드 값
  pageNo?: string;
  numOfRows?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    divId: params.divId,
    key: params.key,
    type: "json",
    numOfRows: params.numOfRows || "1000",
    pageNo: params.pageNo || "1",
  });

  const res = await fetch(
    `${BASE_URLS.commerce}/storeListInDong?${searchParams}`
  );
  return res.json();
}

export async function fetchCommerceByRadius(params: {
  radius: string;
  cx: string; // 경도
  cy: string; // 위도
  pageNo?: string;
  numOfRows?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    radius: params.radius,
    cx: params.cx,
    cy: params.cy,
    type: "json",
    numOfRows: params.numOfRows || "1000",
    pageNo: params.pageNo || "1",
  });

  const res = await fetch(
    `${BASE_URLS.commerce}/storeListInRadius?${searchParams}`
  );
  return res.json();
}
