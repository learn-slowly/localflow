import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY = "photo-markers";

// 전체 사진 조회
export async function GET() {
  const photos = await redis.get<any[]>(KEY);
  return NextResponse.json(photos || []);
}

// 사진 저장 (전체 덮어쓰기)
export async function PUT(req: NextRequest) {
  const photos = await req.json();
  await redis.set(KEY, photos);
  return NextResponse.json({ ok: true });
}
