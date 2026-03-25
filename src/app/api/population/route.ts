import { NextRequest, NextResponse } from "next/server";
import { fetchPopulation } from "@/lib/api/population";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const stdgCd = searchParams.get("stdgCd") || "4817000000";
  const srchFrYm = searchParams.get("srchFrYm") || "202501";
  const srchToYm = searchParams.get("srchToYm") || "202501";
  const lv = searchParams.get("lv") || "3";

  const data = await fetchPopulation({ stdgCd, srchFrYm, srchToYm, lv });
  return NextResponse.json(data);
}
