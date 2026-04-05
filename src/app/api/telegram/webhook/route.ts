import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME?.toLowerCase() || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const PHOTOS_KEY = "photo-markers";
const CAMPAIGN_KEY = "campaign-records";
// 위치 대기 상태: chat_id → 마지막 저장된 record id
const PENDING_LOCATION_KEY = "telegram-pending-location";

// 수집 트리거 리액션 이모지
const TRIGGER_EMOJI = ["📌", "\u{1F4CC}"];

// ─── 텔레그램 API 헬퍼 ───

async function sendMessage(chatId: number, text: string, replyToMessageId?: number, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_to_message_id: replyToMessageId,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function getFile(fileId: string): Promise<string | null> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) return null;
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

async function downloadAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

// ─── EXIF GPS 추출 (서버사이드, 수동 파싱) ───

function extractGpsFromBuffer(buffer: Buffer): { lat: number; lng: number } | null {
  try {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

    let offset = 2;
    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xe1) {
        const len = buffer.readUInt16BE(offset + 2);
        const exifData = buffer.subarray(offset + 4, offset + 2 + len);
        return parseExifGps(exifData);
      }
      if (marker === 0xda) break;
      const segLen = buffer.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
    return null;
  } catch {
    return null;
  }
}

function parseExifGps(data: Buffer): { lat: number; lng: number } | null {
  if (data.toString("ascii", 0, 4) !== "Exif") return null;

  const tiffOffset = 6;
  const byteOrder = data.toString("ascii", tiffOffset, tiffOffset + 2);
  const le = byteOrder === "II";

  const readU16 = (o: number) => le ? data.readUInt16LE(tiffOffset + o) : data.readUInt16BE(tiffOffset + o);
  const readU32 = (o: number) => le ? data.readUInt32LE(tiffOffset + o) : data.readUInt32BE(tiffOffset + o);

  const ifd0Offset = readU32(4);
  const ifd0Count = readU16(ifd0Offset);

  let gpsIfdOffset = 0;
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    const tag = readU16(entryOffset);
    if (tag === 0x8825) {
      gpsIfdOffset = readU32(entryOffset + 8);
      break;
    }
  }

  if (!gpsIfdOffset) return null;

  const gpsCount = readU16(gpsIfdOffset);
  let latRef = "", lngRef = "";
  let latValues: number[] = [];
  let lngValues: number[] = [];

  const readRational = (offset: number): number => {
    const num = readU32(offset);
    const den = readU32(offset + 4);
    return den ? num / den : 0;
  };

  const readDMS = (valueOffset: number): number[] => [
    readRational(valueOffset),
    readRational(valueOffset + 8),
    readRational(valueOffset + 16),
  ];

  for (let i = 0; i < gpsCount; i++) {
    const entryOffset = gpsIfdOffset + 2 + i * 12;
    const tag = readU16(entryOffset);
    const valueOffset = readU32(entryOffset + 8);

    switch (tag) {
      case 1: latRef = String.fromCharCode(data[tiffOffset + entryOffset + 8]); break;
      case 2: latValues = readDMS(valueOffset); break;
      case 3: lngRef = String.fromCharCode(data[tiffOffset + entryOffset + 8]); break;
      case 4: lngValues = readDMS(valueOffset); break;
    }
  }

  if (latValues.length !== 3 || lngValues.length !== 3) return null;

  let lat = latValues[0] + latValues[1] / 60 + latValues[2] / 3600;
  let lng = lngValues[0] + lngValues[1] / 60 + lngValues[2] / 3600;
  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;

  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

// ─── 위치 대기 상태 관리 ───

async function setPendingLocation(chatId: number, recordId: string, store: "campaign" | "photos") {
  const pending = (await redis.get<Record<string, any>>(PENDING_LOCATION_KEY)) || {};
  pending[String(chatId)] = { recordId, store, createdAt: Date.now() };
  await redis.set(PENDING_LOCATION_KEY, pending);
}

async function getPendingLocation(chatId: number): Promise<{ recordId: string; store: "campaign" | "photos" } | null> {
  const pending = (await redis.get<Record<string, any>>(PENDING_LOCATION_KEY)) || {};
  const entry = pending[String(chatId)];
  if (!entry) return null;
  // 1시간 이내만 유효
  if (Date.now() - entry.createdAt > 3600_000) {
    delete pending[String(chatId)];
    await redis.set(PENDING_LOCATION_KEY, pending);
    return null;
  }
  return entry;
}

async function clearPendingLocation(chatId: number) {
  const pending = (await redis.get<Record<string, any>>(PENDING_LOCATION_KEY)) || {};
  delete pending[String(chatId)];
  await redis.set(PENDING_LOCATION_KEY, pending);
}

async function updateRecordLocation(recordId: string, store: "campaign" | "photos", lat: number, lng: number): Promise<boolean> {
  const key = store === "campaign" ? CAMPAIGN_KEY : PHOTOS_KEY;
  const records = (await redis.get<any[]>(key)) || [];
  const idx = records.findIndex((r: any) => r.id === recordId);
  if (idx === -1) return false;
  records[idx].lat = lat;
  records[idx].lng = lng;
  await redis.set(key, records);
  return true;
}

// ─── 위치 공유 요청 키보드 ───

function locationRequestKeyboard() {
  return {
    keyboard: [[{ text: "📍 현재 위치 공유", request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

// ─── 메시지 처리 로직 ───

interface TelegramPhoto {
  file_id: string;
  width: number;
  height: number;
}

interface ProcessableMessage {
  message_id: number;
  chat_id: number;
  text?: string;
  caption?: string;
  photos?: TelegramPhoto[];
  location?: { latitude: number; longitude: number };
  from_name: string;
}

async function processMessage(msg: ProcessableMessage): Promise<{ results: string[]; needsLocation: boolean; recordId?: string; store?: "campaign" | "photos" }> {
  const text = msg.caption || msg.text || "";
  const results: string[] = [];
  let needsLocation = false;
  let savedRecordId: string | undefined;
  let savedStore: "campaign" | "photos" | undefined;

  if (msg.photos && msg.photos.length > 0) {
    const largest = msg.photos.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
    const fileUrl = await getFile(largest.file_id);

    if (fileUrl) {
      const buffer = await downloadAsBuffer(fileUrl);
      const gps = extractGpsFromBuffer(buffer) || (msg.location ? { lat: msg.location.latitude, lng: msg.location.longitude } : null);

      const thumbnail = buffer.length > 500_000
        ? bufferToDataUrl(buffer.subarray(0, 500_000))
        : bufferToDataUrl(buffer);

      const id = crypto.randomUUID();

      if (gps) {
        const photos = (await redis.get<any[]>(PHOTOS_KEY)) || [];
        photos.push({
          id,
          lat: gps.lat,
          lng: gps.lng,
          thumbnail,
          memo: text ? `[${msg.from_name}] ${text}` : `[${msg.from_name}] 텔레그램 사진`,
          takenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          source: "telegram",
        });
        await redis.set(PHOTOS_KEY, photos);
        results.push("사진 저장 완료 ✅");
      } else {
        const records = (await redis.get<any[]>(CAMPAIGN_KEY)) || [];
        records.push({
          id,
          lat: 0,
          lng: 0,
          title: text || "텔레그램 사진",
          type: "other",
          status: "done",
          date: new Date().toISOString().slice(0, 10),
          memo: `[${msg.from_name}] ${text || "사진"}`,
          createdAt: new Date().toISOString(),
          source: "telegram",
          telegramPhoto: thumbnail,
        });
        await redis.set(CAMPAIGN_KEY, records);
        results.push("저장 완료");
        needsLocation = true;
        savedRecordId = id;
        savedStore = "campaign";
      }
    }
  } else if (text) {
    const id = crypto.randomUUID();
    const hasLocation = !!msg.location;
    const records = (await redis.get<any[]>(CAMPAIGN_KEY)) || [];
    records.push({
      id,
      lat: msg.location?.latitude || 0,
      lng: msg.location?.longitude || 0,
      title: text.slice(0, 50),
      type: "other",
      status: "done",
      date: new Date().toISOString().slice(0, 10),
      memo: `[${msg.from_name}] ${text}`,
      createdAt: new Date().toISOString(),
      source: "telegram",
    });
    await redis.set(CAMPAIGN_KEY, records);

    if (hasLocation) {
      results.push("기록 저장 완료 ✅");
    } else {
      results.push("저장 완료");
      needsLocation = true;
      savedRecordId = id;
      savedStore = "campaign";
    }
  }

  return { results, needsLocation, recordId: savedRecordId, store: savedStore };
}

function getFromName(from: any): string {
  if (!from) return "알수없음";
  return from.first_name + (from.last_name ? ` ${from.last_name}` : "");
}

// ─── 웹훅 핸들러 ───

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    if (update.message) {
      const msg = update.message;
      const isPrivate = msg.chat.type === "private";
      const isForward = !!(msg.forward_date || msg.forward_origin);
      // 봇 @멘션 여부: 엔티티에서 실제 username을 추출하여 비교
      const extractMention = (text: string | undefined, entities: any[] | undefined) =>
        (entities || []).some((e: any) => {
          if (e.type !== "mention" || !text) return false;
          const mentioned = text.slice(e.offset + 1, e.offset + e.length).toLowerCase();
          return BOT_USERNAME && mentioned === BOT_USERNAME;
        });
      const botMentioned = extractMention(msg.text, msg.entities) || extractMention(msg.caption, msg.caption_entities);

      // 위치 공유 메시지 → 대기 중인 기록에 위치 업데이트
      if (msg.location && isPrivate) {
        const pending = await getPendingLocation(msg.chat.id);
        if (pending) {
          const ok = await updateRecordLocation(
            pending.recordId,
            pending.store,
            msg.location.latitude,
            msg.location.longitude,
          );
          await clearPendingLocation(msg.chat.id);
          if (ok) {
            await sendMessage(
              msg.chat.id,
              "📍 위치가 저장되었습니다! 지도에서 확인할 수 있어요.",
              msg.message_id,
              removeKeyboard(),
            );
          } else {
            await sendMessage(msg.chat.id, "기록을 찾을 수 없습니다. 다시 보내주세요.", msg.message_id, removeKeyboard());
          }
          return NextResponse.json({ ok: true });
        }
      }

      // DM이면 모든 메시지 처리, 그룹이면 멘션만 처리
      if (isPrivate || botMentioned) {
        const cleanText = (msg.text || msg.caption || "")
          .replace(/@\S+/g, "")
          .trim();

        const { results, needsLocation, recordId, store } = await processMessage({
          message_id: msg.message_id,
          chat_id: msg.chat.id,
          text: cleanText,
          caption: msg.caption?.replace(/@\S+/g, "").trim(),
          photos: msg.photo,
          location: msg.location,
          from_name: getFromName(isForward ? (msg.forward_from || msg.from) : msg.from),
        });

        if (results.length > 0) {
          if (needsLocation && recordId && store && isPrivate) {
            // 위치 대기 상태 저장 + 위치 공유 버튼 제공
            await setPendingLocation(msg.chat.id, recordId, store);
            await sendMessage(
              msg.chat.id,
              `📌 ${results.join(", ")}\n\n📍 위치를 알려주시면 지도에 표시됩니다.\n아래 버튼을 눌러 현재 위치를 공유하거나, 건너뛰셔도 됩니다.`,
              msg.message_id,
              locationRequestKeyboard(),
            );
          } else if (needsLocation && !isPrivate) {
            // 그룹에서는 키보드 버튼 불가 → DM 안내
            await sendMessage(
              msg.chat.id,
              `📌 ${results.join(", ")}\n\n📍 위치를 추가하려면 저에게 DM으로 위치를 공유해주세요.`,
              msg.message_id,
            );
          } else {
            await sendMessage(msg.chat.id, `📌 ${results.join(", ")}`, msg.message_id);
          }
        } else if (isPrivate) {
          await sendMessage(msg.chat.id, "저장할 내용이 없습니다 (사진 또는 텍스트를 보내주세요)");
        }
      }
    }

    // 리액션 (📌 이모지)
    if (update.message_reaction) {
      const reaction = update.message_reaction;
      const newEmojis = (reaction.new_reaction || []).map((r: any) => r.emoji);
      const hasTrigger = newEmojis.some((e: string) => TRIGGER_EMOJI.includes(e));

      if (hasTrigger) {
        const chatId = reaction.chat.id;
        await sendMessage(
          chatId,
          `📌 리액션 감지! 이 메시지를 저장하려면 메시지를 길게 눌러 저에게 전달해주세요.`,
          reaction.message_id,
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "active", triggers: ["@mention", "forward to DM", "📌 reaction", "location reply"] });
}
