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

// 선거인수 (읍면동별)
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
