import { API_KEYS, BASE_URLS } from "./config";

// 투표 결과
export async function fetchVoteResult(params: {
  sgId: string;       // 선거ID
  sgTypecode: string; // 선거종류코드
  sdName?: string;    // 시도명
  sggName?: string;   // 구시군명
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVote}/getVoteSttusInfoInqire?${searchParams}`
  );
  return res.json();
}

// 개표 결과
export async function fetchCountResult(params: {
  sgId: string;
  sgTypecode: string;
  sdName?: string;
  sggName?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVote}/getXmntckSttusInfoInqire?${searchParams}`
  );
  return res.json();
}

// 선거인수 (선거구별) — 선거ID + 선거종류코드 필수
export async function fetchVoterCountByDistrict(params: {
  sgId: string;
  sgTypecode: string; // 2,4,5,6,10,11만 조회 가능
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVoters}/getElpcElcntInfoInqire?${searchParams}`
  );
  return res.json();
}

// 선거인수 (시도별) — 선거ID 필수
export async function fetchVoterCountBySido(params: {
  sgId: string;
  sgTypecode: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVoters}/getSidoElcntInfoInqire?${searchParams}`
  );
  return res.json();
}

// 선거인수 (구시군별) — 선거ID + 시도명 필수
export async function fetchVoterCountByGusigun(params: {
  sgId: string;
  sgTypecode: string;
  sdName: string;     // 시도명 필수
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVoters}/getGusigunElcntInfoInqire?${searchParams}`
  );
  return res.json();
}

// 선거인수 (읍면동별) — 선거ID + 시도명 + 구시군명 필수
export async function fetchVoterCount(params: {
  sgId: string;
  sgTypecode: string;
  sdName?: string;
  sggName?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVoters}/getEmdElcntInfoInqire?${searchParams}`
  );
  return res.json();
}

// 선거인수 (투표구별) — 선거ID + 시도명 + 구시군명 필수
export async function fetchVoterCountByPollingDistrict(params: {
  sgId: string;
  sgTypecode: string;
  sdName: string;
  wiwName: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionVoters}/getTpgElcntInfoInqire?${searchParams}`
  );
  return res.json();
}

// 투표소 (선거일)
export async function fetchPollingStations(params: {
  sgId: string;
  sdName?: string;
  sggName?: string;
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionPollingStation}/getPolplcOtlnmapTrnsportInfoInqire?${searchParams}`
  );
  return res.json();
}

// 구시군코드 조회
export async function fetchGusigunCodes(params: {
  sgId: string;       // 선거ID
  sgTypecode: string; // 선거종류코드
  sdName?: string;    // 시도명 (옵션)
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionCode}/getCommonGusigunCodeList?${searchParams}`
  );
  return res.json();
}

// 선거구코드 조회
export async function fetchSggCodes(params: {
  sgId: string;       // 선거ID
  sgTypecode: string; // 선거종류코드
  sdName?: string;    // 시도명 (옵션)
  wiwName?: string;   // 구시군명 (옵션)
}) {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });

  const res = await fetch(
    `${BASE_URLS.electionCode}/getCommonSggCodeList?${searchParams}`
  );
  return res.json();
}

// 선거코드 조회
export async function fetchElectionCodes() {
  const searchParams = new URLSearchParams({
    serviceKey: API_KEYS.dataGoKr,
    resultType: "json",
    numOfRows: "100",
    pageNo: "1",
  });

  const res = await fetch(
    `${BASE_URLS.electionCode}/getCommonSgCodeList?${searchParams}`
  );
  return res.json();
}
