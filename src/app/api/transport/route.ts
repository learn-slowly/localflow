import { NextRequest, NextResponse } from "next/server";
import {
  fetchAreaCode,
  fetchQuarterOD,
  fetchBusStations,
  fetchBusRoute,
  fetchBusRouteStations,
} from "@/lib/api/transport";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");

  switch (type) {
    case "areacode": {
      const sdCd = searchParams.get("sdCd") || undefined;
      const sggCd = searchParams.get("sggCd") || undefined;
      return NextResponse.json(await fetchAreaCode({ sdCd, sggCd }));
    }
    case "od": {
      const opratDate = searchParams.get("opratDate");
      const stgEmdCd = searchParams.get("stgEmdCd");
      const arrEmdCd = searchParams.get("arrEmdCd");
      if (!opratDate || !stgEmdCd || !arrEmdCd) {
        return NextResponse.json({ error: "opratDate, stgEmdCd, arrEmdCd required" }, { status: 400 });
      }
      return NextResponse.json(await fetchQuarterOD({ opratDate, stgEmdCd, arrEmdCd }));
    }
    case "stations": {
      const sdCd = searchParams.get("sdCd") || undefined;
      const sggCd = searchParams.get("sggCd") || undefined;
      const emdCd = searchParams.get("emdCd") || undefined;
      return NextResponse.json(await fetchBusStations({ sdCd, sggCd, emdCd }));
    }
    case "route": {
      const sdCd = searchParams.get("sdCd");
      const routeNo = searchParams.get("routeNo");
      if (!sdCd || !routeNo) {
        return NextResponse.json({ error: "sdCd, routeNo required" }, { status: 400 });
      }
      return NextResponse.json(await fetchBusRoute({ sdCd, routeNo }));
    }
    case "routeStations": {
      const routeId = searchParams.get("routeId");
      const sdCd = searchParams.get("sdCd") || undefined;
      const sggCd = searchParams.get("sggCd") || undefined;
      if (!routeId) {
        return NextResponse.json({ error: "routeId required" }, { status: 400 });
      }
      return NextResponse.json(await fetchBusRouteStations({ routeId, sdCd, sggCd }));
    }
    default:
      return NextResponse.json({ error: "type required (areacode|od|stations|route|routeStations)" }, { status: 400 });
  }
}
