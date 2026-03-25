// API 키 및 베이스 URL 관리

export const API_KEYS = {
  dataGoKr: process.env.DATA_GO_KR_API_KEY!,
  boundary: process.env.BOUNDARY_API_KEY!,
  transit: process.env.TRANSIT_API_KEY!,
};

export const BASE_URLS = {
  // 공공데이터포털 (data.go.kr)
  population: "https://apis.data.go.kr/1741000/stdgPpltnHhStus",
  commerce: "https://apis.data.go.kr/B553077/api/open/sdsc2",
  election: "https://apis.data.go.kr/9760000",
  electionCode: "https://apis.data.go.kr/9760000/CommonCodeService",
  electionCandidate: "https://apis.data.go.kr/9760000/PofelcddInfoInqireService",
  electionVote: "https://apis.data.go.kr/9760000/VoteXmntckInfoInqireService2",
  electionVoters: "https://apis.data.go.kr/9760000/ElcntInfoInqireService",
  electionPollingStation: "https://apis.data.go.kr/9760000/PolplcInfoInqireService2",

  // 재난안전데이터 (safetydata.go.kr)
  boundary: "https://www.safetydata.go.kr/V2/api/DSSP-IF-10467",

  // 교통카드 빅데이터 (stcis.go.kr)
  transit: "https://stcis.go.kr/openapi",
};
