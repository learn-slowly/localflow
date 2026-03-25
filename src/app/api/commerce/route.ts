import { NextRequest, NextResponse } from "next/server";
import { fetchCommerceByDong, fetchCommerceByRadius } from "@/lib/api/commerce";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("mode"); // "dong" | "radius"

  if (mode === "radius") {
    const radius = searchParams.get("radius") || "500";
    const cx = searchParams.get("cx");
    const cy = searchParams.get("cy");
    if (!cx || !cy) {
      return NextResponse.json({ error: "cx, cy required" }, { status: 400 });
    }
    const data = await fetchCommerceByRadius({ radius, cx, cy });
    return NextResponse.json(data);
  }

  // default: dong mode
  const divId = searchParams.get("divId") || "adongCd";
  const key = searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  const data = await fetchCommerceByDong({ divId, key });
  return NextResponse.json(data);
}
