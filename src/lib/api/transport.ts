import { API_KEYS, BASE_URLS } from "./config";
import { TransitResponse } from "./types";

// 지역코드 조회
export async function fetchAreaCode(params?: {
  sdCd?: string;
  sggCd?: string;
}) {
  const searchParams = new URLSearchParams({
    apikey: API_KEYS.transit,
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.transit}/areacode.json?${searchParams}`
  );
  return res.json() as Promise<TransitResponse<{ sdCd: string; sdNm: string; sggCd?: string; sggNm?: string; emdCd?: string; emdNm?: string }>>;
}

// 15분단위 OD (유동인구 핵심)
export async function fetchQuarterOD(params: {
  opratDate: string;  // YYYYMMDD
  stgEmdCd: string;   // 출발지 읍면동코드 10자리
  arrEmdCd: string;   // 도착지 읍면동코드 10자리
}) {
  const searchParams = new URLSearchParams({
    apikey: API_KEYS.transit,
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.transit}/quarterod.json?${searchParams}`
  );
  return res.json();
}

// 버스 정류장 정보
export async function fetchBusStations(params: {
  sdCd?: string;
  sggCd?: string;
  emdCd?: string;
}) {
  const searchParams = new URLSearchParams({
    apikey: API_KEYS.transit,
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.transit}/bussttn.json?${searchParams}`
  );
  return res.json();
}

// 버스 노선 정보
export async function fetchBusRoute(params: {
  sdCd: string;
  routeNo: string;
}) {
  const searchParams = new URLSearchParams({
    apikey: API_KEYS.transit,
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.transit}/busroute.json?${searchParams}`
  );
  return res.json();
}

// 버스 노선별 경유정류장
export async function fetchBusRouteStations(params: {
  routeId: string;
  sdCd?: string;
  sggCd?: string;
  emdCd?: string;
}) {
  const searchParams = new URLSearchParams({
    apikey: API_KEYS.transit,
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.transit}/busroutesttn.json?${searchParams}`
  );
  return res.json();
}
