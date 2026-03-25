import { NextRequest, NextResponse } from "next/server";
import { fetchPopulation } from "@/lib/api/population";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ctpvNm = searchParams.get("ctpvNm") || undefined;
  const signguNm = searchParams.get("signguNm") || undefined;

  const data = await fetchPopulation({ ctpvNm, signguNm });
  return NextResponse.json(data);
}
