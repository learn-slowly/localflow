import { NextRequest, NextResponse } from "next/server";
import {
  fetchVoteResult,
  fetchCountResult,
  fetchVoterCount,
  fetchVoterCountByDistrict,
  fetchVoterCountBySido,
  fetchVoterCountByGusigun,
  fetchVoterCountByPollingDistrict,
  fetchPollingStations,
  fetchElectionCodes,
  fetchGusigunCodes,
  fetchSggCodes,
} from "@/lib/api/election";

// 선거구-행정동 매핑 자동 생성
// 읍면동별 선거인수 API 응답에서 sggName으로 그룹핑
async function buildDistrictMapping(params: {
  sgId: string;
  sgTypecode: string;
  sdName: string;
  wiwName: string;
}) {
  // 읍면동별 선거인수 전체 조회 (페이징)
  const allItems: any[] = [];
  let pageNo = 1;
  while (true) {
    const res = await fetchVoterCount({
      sgId: params.sgId,
      sgTypecode: params.sgTypecode,
      sdName: params.sdName,
      sggName: params.wiwName,
    });
    const items = res?.getEmdElcntInfoInqire?.item;
    if (!items) break;
    const list = Array.isArray(items) ? items : [items];
    allItems.push(...list);
    const totalCount = res?.getEmdElcntInfoInqire?.totalCount || 0;
    if (allItems.length >= totalCount) break;
    pageNo++;
  }

  // sggName으로 그룹핑 → 선거구별 행정동 목록 + 선거인수
  const districtMap: Record<string, {
    name: string;
    dongs: { name: string; voterCount: number }[];
    totalVoters: number;
  }> = {};

  for (const item of allItems) {
    const districtName = item.sggName;
    const dongName = item.emdName;
    const voterCount = parseInt(item.cfmtnElcnt) || 0;
    if (!districtName || !dongName || dongName === "합계") continue;

    if (!districtMap[districtName]) {
      districtMap[districtName] = { name: districtName, dongs: [], totalVoters: 0 };
    }
    districtMap[districtName].dongs.push({ name: dongName, voterCount });
    districtMap[districtName].totalVoters += voterCount;
  }

  return {
    sgId: params.sgId,
    sgTypecode: params.sgTypecode,
    sdName: params.sdName,
    wiwName: params.wiwName,
    districts: Object.values(districtMap),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const sgId = searchParams.get("sgId") || "";
  const sgTypecode = searchParams.get("sgTypecode") || "";
  const sdName = searchParams.get("sdName") || undefined;
  const sggName = searchParams.get("sggName") || undefined;
  const wiwName = searchParams.get("wiwName") || undefined;

  switch (type) {
    case "codes":
      return NextResponse.json(await fetchElectionCodes());
    case "gusigun":
      return NextResponse.json(await fetchGusigunCodes({ sgId, sgTypecode, sdName }));
    case "sgg":
      return NextResponse.json(await fetchSggCodes({ sgId, sgTypecode, sdName, wiwName }));
    case "vote":
      return NextResponse.json(await fetchVoteResult({ sgId, sgTypecode, sdName, sggName }));
    case "count":
      return NextResponse.json(await fetchCountResult({ sgId, sgTypecode, sdName, sggName }));
    case "voters":
      return NextResponse.json(await fetchVoterCount({ sgId, sgTypecode, sdName, sggName }));
    case "voters-district":
      return NextResponse.json(await fetchVoterCountByDistrict({ sgId, sgTypecode }));
    case "voters-sido":
      return NextResponse.json(await fetchVoterCountBySido({ sgId, sgTypecode }));
    case "voters-gusigun":
      return NextResponse.json(await fetchVoterCountByGusigun({ sgId, sgTypecode, sdName: sdName! }));
    case "voters-polling":
      return NextResponse.json(await fetchVoterCountByPollingDistrict({ sgId, sgTypecode, sdName: sdName!, wiwName: wiwName! }));
    case "district-mapping":
      if (!sdName || !wiwName) {
        return NextResponse.json({ error: "sdName, wiwName 필수" }, { status: 400 });
      }
      return NextResponse.json(await buildDistrictMapping({ sgId, sgTypecode, sdName, wiwName }));
    case "stations":
      return NextResponse.json(await fetchPollingStations({ sgId, sdName, sggName }));
    default:
      return NextResponse.json(
        { error: "type required (codes|gusigun|sgg|vote|count|voters|voters-district|voters-sido|voters-gusigun|voters-polling|district-mapping|stations)" },
        { status: 400 }
      );
  }
}
