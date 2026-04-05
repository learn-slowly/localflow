"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface CampaignRecord {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: "canvass" | "rally" | "visit" | "other";
  status: "planned" | "done" | "skipped";
  date: string;
  time?: string;
  memo: string;
  reaction?: "good" | "neutral" | "bad";
  attendees?: number;
  address?: string;
  dong?: string;
  createdAt: string;
  source?: string;
  telegramPhoto?: string;
}

type RecordType = CampaignRecord["type"];
type RecordStatus = CampaignRecord["status"];
type Reaction = NonNullable<CampaignRecord["reaction"]>;

const TYPE_CONFIG: Record<RecordType, { label: string; icon: string }> = {
  canvass: { label: "유세", icon: "📢" },
  rally: { label: "집회", icon: "🚩" },
  visit: { label: "방문", icon: "🚶" },
  other: { label: "기타", icon: "📌" },
};

const STATUS_CONFIG: Record<RecordStatus, { label: string; color: string; bg: string }> = {
  planned: { label: "예정", color: "#3B82F6", bg: "#DBEAFE" },
  done: { label: "완료", color: "#10B981", bg: "#D1FAE5" },
  skipped: { label: "건너뜀", color: "#9CA3AF", bg: "#F3F4F6" },
};

const REACTION_CONFIG: Record<Reaction, { label: string; icon: string }> = {
  good: { label: "좋음", icon: "😊" },
  neutral: { label: "보통", icon: "😐" },
  bad: { label: "나쁨", icon: "😞" },
};

async function fetchRecords(): Promise<CampaignRecord[]> {
  try {
    const res = await fetch("/api/campaign");
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function syncRecords(records: CampaignRecord[]) {
  await fetch("/api/campaign", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(records),
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<{ address?: string; dong?: string }> {
  try {
    const res = await fetch(`/api/places?lat=${lat}&lng=${lng}`);
    if (!res.ok) return {};
    const data = await res.json();
    return {
      address: data.roadAddress || data.jibunAddress || data.address || undefined,
      dong: data.region || undefined,
    };
  } catch {
    return {};
  }
}

interface Props {
  map: kakao.maps.Map;
  editMode: boolean;
  statusFilter: Set<RecordStatus>;
  onRecordCount?: (count: number) => void;
  onUnlocatedCount?: (count: number) => void;
  showUnlocated?: boolean;
  onShowUnlocatedChange?: (show: boolean) => void;
}

export default function CampaignLayer({ map, editMode, statusFilter, onRecordCount, onUnlocatedCount, showUnlocated, onShowUnlocatedChange }: Props) {
  const [records, setRecords] = useState<CampaignRecord[]>([]);
  const [editing, setEditing] = useState<CampaignRecord | null>(null);
  const setShowUnlocated = onShowUnlocatedChange || (() => {});
  const [placingRecord, setPlacingRecord] = useState<CampaignRecord | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    type: "canvass" as RecordType,
    status: "planned" as RecordStatus,
    date: new Date().toISOString().slice(0, 10),
    time: "",
    memo: "",
    reaction: undefined as Reaction | undefined,
    attendees: undefined as number | undefined,
  });
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const clickListenerRef = useRef<((e: any) => void) | null>(null);

  // 초기 로딩
  useEffect(() => {
    fetchRecords().then(setRecords);
  }, []);

  // 기록 개수 알림
  useEffect(() => {
    onRecordCount?.(records.length);
  }, [records.length, onRecordCount]);

  // 위치 미지정 개수 알림
  const unlocatedRecords = records.filter((r) => !r.lat && !r.lng);
  useEffect(() => {
    onUnlocatedCount?.(unlocatedRecords.length);
  }, [unlocatedRecords.length, onUnlocatedCount]);

  // 위치 배치 모드: 지도 클릭으로 기록 위치 지정
  useEffect(() => {
    if (!map || !placingRecord) return;
    const container = map.getNode();
    container.style.cursor = "crosshair";

    const handler = (e: any) => {
      const latlng = e.latLng;
      const updated = { ...placingRecord, lat: latlng.getLat(), lng: latlng.getLng() };
      setRecords((prev) => {
        const next = prev.map((r) => (r.id === updated.id ? updated : r));
        syncRecords(next);
        return next;
      });
      setPlacingRecord(null);
      container.style.cursor = "";
    };

    kakao.maps.event.addListener(map, "click", handler);
    return () => {
      kakao.maps.event.removeListener(map, "click", handler);
      container.style.cursor = "";
    };
  }, [map, placingRecord]);

  // 편집 모드: 지도 클릭으로 기록 추가
  useEffect(() => {
    if (!map) return;

    if (clickListenerRef.current) {
      kakao.maps.event.removeListener(map, "click", clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (!editMode) return;

    const handler = async (e: any) => {
      const latlng = e.latLng;
      const lat = latlng.getLat();
      const lng = latlng.getLng();

      const newRecord: CampaignRecord = {
        id: crypto.randomUUID(),
        lat,
        lng,
        title: "",
        type: "canvass",
        status: "planned",
        date: new Date().toISOString().slice(0, 10),
        memo: "",
        createdAt: new Date().toISOString(),
      };

      // 역지오코딩 (비동기)
      reverseGeocode(lat, lng).then((geo) => {
        newRecord.address = geo.address;
        newRecord.dong = geo.dong;
        setEditing({ ...newRecord });
        setDraft({
          title: geo.dong ? `${geo.dong} ` : "",
          type: "canvass",
          status: "planned",
          date: new Date().toISOString().slice(0, 10),
          time: "",
          memo: "",
          reaction: undefined,
          attendees: undefined,
        });
      });

      setEditing(newRecord);
      setDraft({
        title: "",
        type: "canvass",
        status: "planned",
        date: new Date().toISOString().slice(0, 10),
        time: "",
        memo: "",
        reaction: undefined,
        attendees: undefined,
      });
    };

    kakao.maps.event.addListener(map, "click", handler);
    clickListenerRef.current = handler;

    return () => {
      kakao.maps.event.removeListener(map, "click", handler);
      clickListenerRef.current = null;
    };
  }, [map, editMode]);

  // 커서 스타일 변경
  useEffect(() => {
    if (!map) return;
    const container = map.getNode();
    if (editMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
    return () => { container.style.cursor = ""; };
  }, [map, editMode]);

  // 마커 오버레이 렌더링
  useEffect(() => {
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    if (!map) return;

    const visible = records.filter((r) => statusFilter.has(r.status));

    for (const rec of visible) {
      const cfg = STATUS_CONFIG[rec.status];
      const typeIcon = TYPE_CONFIG[rec.type].icon;

      const el = document.createElement("div");
      el.style.cssText = "position:relative;cursor:pointer;";

      // 마커: 타입 아이콘 + 상태 색상
      const marker = document.createElement("div");
      marker.style.cssText = `
        width:32px;height:32px;
        background:${cfg.color};
        border:2px solid white;
        border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;line-height:1;
      `;
      marker.textContent = typeIcon;
      el.appendChild(marker);

      // 제목 미리보기
      if (rec.title) {
        const preview = document.createElement("div");
        preview.style.cssText = `
          position:absolute;top:-6px;left:36px;
          background:white;padding:2px 6px;border-radius:4px;
          font-size:11px;color:#374151;white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,.2);
          max-width:160px;overflow:hidden;text-overflow:ellipsis;
          pointer-events:none;
          border-left:3px solid ${cfg.color};
        `;
        preview.textContent = rec.title;
        el.appendChild(preview);
      }

      // 완료 표시 배지
      if (rec.status === "done") {
        const badge = document.createElement("div");
        badge.style.cssText = `
          position:absolute;top:-4px;right:-4px;
          width:14px;height:14px;background:#10B981;
          border-radius:50%;border:2px solid white;
          display:flex;align-items:center;justify-content:center;
          font-size:8px;color:white;line-height:1;
        `;
        badge.textContent = "✓";
        el.appendChild(badge);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setEditing(rec);
        setDraft({
          title: rec.title,
          type: rec.type,
          status: rec.status,
          date: rec.date,
          time: rec.time || "",
          memo: rec.memo,
          reaction: rec.reaction,
          attendees: rec.attendees,
        });
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(rec.lat, rec.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 55,
      });
      overlaysRef.current.push(overlay);
    }

    return () => {
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
    };
  }, [map, records, statusFilter]);

  const handleSave = useCallback(() => {
    if (!editing) return;
    const updated: CampaignRecord = {
      ...editing,
      title: draft.title,
      type: draft.type,
      status: draft.status,
      date: draft.date,
      time: draft.time || undefined,
      memo: draft.memo,
      reaction: draft.reaction,
      attendees: draft.attendees,
    };
    setRecords((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      const next = exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [...prev, updated];
      syncRecords(next);
      return next;
    });
    setEditing(null);
  }, [editing, draft]);

  const handleDelete = useCallback(() => {
    if (!editing) return;
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== editing.id);
      syncRecords(next);
      return next;
    });
    setEditing(null);
  }, [editing]);

  if (!editing && !showUnlocated && !placingRecord) return null;

  const isNew = editing ? !records.find((r) => r.id === editing.id) : false;

  return (
    <>
    {/* 위치 배치 모드 안내 배너 */}
    {placingRecord && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-3">
        <span>📍 &quot;{placingRecord.title || "기록"}&quot;의 위치를 지도에서 클릭하세요</span>
        <button
          onClick={() => { setPlacingRecord(null); if (map) map.getNode().style.cursor = ""; }}
          className="text-white/80 hover:text-white text-xs underline"
        >
          취소
        </button>
      </div>
    )}

    {/* 위치 미지정 목록 패널 */}
    {showUnlocated && !editing && !placingRecord && (
      <div
        className="fixed inset-0 z-[2000] flex items-center justify-center"
        onClick={() => setShowUnlocated(false)}
      >
        <div className="absolute inset-0 bg-black/20" />
        <div
          className="relative bg-white rounded-lg shadow-xl p-4 w-96 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-bold text-gray-700 mb-3">
            📍 위치 미지정 기록 ({unlocatedRecords.length}건)
          </h4>
          {unlocatedRecords.length === 0 ? (
            <p className="text-sm text-gray-400">모든 기록에 위치가 지정되어 있습니다.</p>
          ) : (
            <div className="space-y-2">
              {unlocatedRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{rec.title || rec.memo?.slice(0, 40) || "제목 없음"}</p>
                    <p className="text-[10px] text-gray-400">{rec.date} · {rec.source === "telegram" ? "텔레그램" : "직접 입력"}</p>
                  </div>
                  <button
                    className="text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 shrink-0"
                    onClick={() => {
                      setShowUnlocated(false);
                      setPlacingRecord(rec);
                    }}
                  >
                    위치 지정
                  </button>
                  <button
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                    onClick={() => {
                      setRecords((prev) => {
                        const next = prev.filter((r) => r.id !== rec.id);
                        syncRecords(next);
                        return next;
                      });
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowUnlocated(false)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 w-full text-center py-1"
          >
            닫기
          </button>
        </div>
      </div>
    )}

    {/* 기록 편집 모달 */}
    {editing && (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      onClick={() => setEditing(null)}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-lg shadow-xl p-4 w-96 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-gray-700 mb-3">
          {isNew ? "새 선거운동 기록" : "기록 수정"}
        </h4>

        {/* 주소 표시 */}
        {editing.address && (
          <p className="text-[11px] text-gray-400 mb-2 -mt-1">
            {editing.dong && <span className="text-gray-600 font-medium">{editing.dong}</span>}
            {editing.dong && " · "}
            {editing.address}
          </p>
        )}

        {/* 제목 */}
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="제목 (예: 문산읍 시장 앞 유세)"
          className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          autoFocus
        />

        {/* 타입 선택 */}
        <div className="flex gap-1.5 mb-2">
          {(Object.entries(TYPE_CONFIG) as [RecordType, typeof TYPE_CONFIG[RecordType]][]).map(([key, cfg]) => (
            <button
              key={key}
              className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
                draft.type === key
                  ? "bg-blue-50 border-blue-400 text-blue-700"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => setDraft((d) => ({ ...d, type: key }))}
            >
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        {/* 날짜 + 시간 */}
        <div className="flex gap-2 mb-2">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            className="flex-1 border rounded-md px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="time"
            value={draft.time}
            onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
            className="w-28 border rounded-md px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 상태 */}
        <div className="flex gap-1.5 mb-2">
          {(Object.entries(STATUS_CONFIG) as [RecordStatus, typeof STATUS_CONFIG[RecordStatus]][]).map(([key, cfg]) => (
            <button
              key={key}
              className="flex-1 text-xs px-2 py-1.5 rounded border transition-colors"
              style={{
                background: draft.status === key ? cfg.bg : "white",
                borderColor: draft.status === key ? cfg.color : "#E5E7EB",
                color: draft.status === key ? cfg.color : "#6B7280",
              }}
              onClick={() => setDraft((d) => ({ ...d, status: key }))}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* 메모 */}
        <textarea
          value={draft.memo}
          onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
          placeholder="상세 메모..."
          className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
          rows={3}
        />

        {/* 반응 + 참석자 (완료 상태일 때만) */}
        {draft.status === "done" && (
          <div className="flex gap-3 mb-2 items-center">
            <div className="flex gap-1">
              {(Object.entries(REACTION_CONFIG) as [Reaction, typeof REACTION_CONFIG[Reaction]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`text-lg px-1 rounded transition-transform ${
                    draft.reaction === key ? "scale-125 bg-gray-100" : "opacity-50 hover:opacity-80"
                  }`}
                  onClick={() => setDraft((d) => ({ ...d, reaction: d.reaction === key ? undefined : key }))}
                  title={cfg.label}
                >
                  {cfg.icon}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">참석</span>
              <input
                type="number"
                min={0}
                value={draft.attendees ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, attendees: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0"
                className="w-16 border rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">명</span>
            </div>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex justify-between mt-3 pt-2 border-t">
          {!isNew ? (
            <button
              onClick={handleDelete}
              className="text-xs text-red-500 hover:text-red-700"
            >
              삭제
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(null)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
    )}
    </>
  );
}
