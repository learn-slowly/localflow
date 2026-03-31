import { NextRequest, NextResponse } from "next/server";

const REST_KEY = process.env.KAKAO_REST_API_KEY!;
const HEADERS = { Authorization: `KakaoAK ${REST_KEY}` };

// 좌표 → 주소 + 주변 장소
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json({ error: "lat, lng 필수" }, { status: 400 });

  const [addrRes, placesRes] = await Promise.all([
    // 좌표 → 주소 변환
    fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      { headers: HEADERS },
    ),
    // 주변 장소 검색 (반경 50m)
    fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
      { headers: HEADERS },
    ),
  ]);

  const addrData = await addrRes.json();
  const regionData = await placesRes.json();

  // 키워드 검색 (반경 100m 내 장소)
  const keywordRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=장소&x=${lng}&y=${lat}&radius=100&sort=distance&size=5`,
    { headers: HEADERS },
  );
  const keywordData = await keywordRes.json();

  const address = addrData.documents?.[0];
  const region = regionData.documents?.find((d: any) => d.region_type === "H");

  return NextResponse.json({
    address: address?.road_address?.address_name || address?.address?.address_name || null,
    roadAddress: address?.road_address?.address_name || null,
    jibunAddress: address?.address?.address_name || null,
    region: region?.address_name || null,
    places: (keywordData.documents || []).map((p: any) => ({
      name: p.place_name,
      category: p.category_group_name || p.category_name?.split(" > ").pop(),
      address: p.road_address_name || p.address_name,
      phone: p.phone || null,
      distance: p.distance ? `${p.distance}m` : null,
      url: p.place_url || null,
    })),
  });
}
