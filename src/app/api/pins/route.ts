import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY = "pin-memos";

// 전체 핀 조회
export async function GET() {
  const pins = await redis.get<any[]>(KEY);
  return NextResponse.json(pins || []);
}

// 핀 저장 (전체 덮어쓰기)
export async function PUT(req: NextRequest) {
  const pins = await req.json();
  await redis.set(KEY, pins);
  return NextResponse.json({ ok: true });
}
