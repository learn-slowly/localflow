import { NextRequest, NextResponse } from "next/server";

const REST_KEY = process.env.KAKAO_REST_API_KEY!;
const HEADERS = { Authorization: `KakaoAK ${REST_KEY}` };

// 키워드로 장소 검색
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q");
  if (!query) return NextResponse.json({ error: "q 필수" }, { status: 400 });

  const x = searchParams.get("x");
  const y = searchParams.get("y");
  const page = searchParams.get("page") || "1";

  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10&page=${page}`;
  if (x && y) url += `&x=${x}&y=${y}&sort=distance`;

  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();

  return NextResponse.json({
    places: (data.documents || []).map((p: any) => ({
      id: p.id,
      name: p.place_name,
      category: p.category_group_name || p.category_name?.split(" > ").pop(),
      address: p.road_address_name || p.address_name,
      phone: p.phone || null,
      lat: parseFloat(p.y),
      lng: parseFloat(p.x),
      distance: p.distance ? `${p.distance}m` : null,
      url: p.place_url || null,
    })),
    hasMore: !data.meta?.is_end,
  });
}
