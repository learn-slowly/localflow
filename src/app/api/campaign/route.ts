import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY = "campaign-records";

// 전체 기록 조회
export async function GET() {
  const records = await redis.get<any[]>(KEY);
  return NextResponse.json(records || []);
}

// 기록 저장 (전체 덮어쓰기)
export async function PUT(req: NextRequest) {
  const records = await req.json();
  await redis.set(KEY, records);
  return NextResponse.json({ ok: true });
}
