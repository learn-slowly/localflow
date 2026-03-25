import { NextRequest, NextResponse } from "next/server";
import {
  fetchVoteResult,
  fetchCountResult,
  fetchVoterCount,
  fetchPollingStations,
  fetchElectionCodes,
} from "@/lib/api/election";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const sgId = searchParams.get("sgId") || "";
  const sgTypecode = searchParams.get("sgTypecode") || "";
  const sdName = searchParams.get("sdName") || undefined;
  const sggName = searchParams.get("sggName") || undefined;

  switch (type) {
    case "codes":
      return NextResponse.json(await fetchElectionCodes());
    case "vote":
      return NextResponse.json(await fetchVoteResult({ sgId, sgTypecode, sdName, sggName }));
    case "count":
      return NextResponse.json(await fetchCountResult({ sgId, sgTypecode, sdName, sggName }));
    case "voters":
      return NextResponse.json(await fetchVoterCount({ sgId, sgTypecode, sdName, sggName }));
    case "stations":
      return NextResponse.json(await fetchPollingStations({ sgId, sdName, sggName }));
    default:
      return NextResponse.json({ error: "type required (codes|vote|count|voters|stations)" }, { status: 400 });
  }
}
