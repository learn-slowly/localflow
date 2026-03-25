import { NextRequest, NextResponse } from "next/server";
import { fetchBoundary } from "@/lib/api/boundary";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const pageNo = searchParams.get("pageNo") || undefined;
  const numOfRows = searchParams.get("numOfRows") || undefined;

  const data = await fetchBoundary({ pageNo, numOfRows });
  return NextResponse.json(data);
}
