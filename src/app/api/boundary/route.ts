import { NextRequest, NextResponse } from "next/server";
import { fetchBoundary } from "@/lib/api/boundary";
import fs from "fs";
import path from "path";

let _boundaryCache: any = null;
function getNationwideBoundary() {
  if (!_boundaryCache) {
    const filePath = path.join(process.cwd(), "public/data/nationwide-boundary.json");
    _boundaryCache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return _boundaryCache;
}

// 캐시된 전국 경계에서 시군구별 GeoJSON 추출
function getBoundarybySgg(sggCode: string) {
  const data = getNationwideBoundary();
  const features = data.features.filter(
    (f: any) => f.properties.sgg === sggCode
  );
  return { type: "FeatureCollection", features };
}

// 시도별 전체 시군구 경계 추출
function getBoundaryBySido(sidoCode: string) {
  const data = getNationwideBoundary();
  const features = data.features.filter(
    (f: any) => f.properties.sido === sidoCode
  );
  return { type: "FeatureCollection", features };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const sggCode = searchParams.get("sggCode");
  const sidoCode = searchParams.get("sidoCode");

  // 캐시된 전국 경계에서 추출
  if (type === "cached") {
    if (sggCode) {
      return NextResponse.json(getBoundarybySgg(sggCode));
    }
    if (sidoCode) {
      return NextResponse.json(getBoundaryBySido(sidoCode));
    }
    return NextResponse.json({ error: "sggCode 또는 sidoCode 필수" }, { status: 400 });
  }

  // 기존: 재난안전데이터 API 직접 호출
  const pageNo = searchParams.get("pageNo") || undefined;
  const numOfRows = searchParams.get("numOfRows") || undefined;
  const data = await fetchBoundary({ pageNo, numOfRows });
  return NextResponse.json(data);
}
