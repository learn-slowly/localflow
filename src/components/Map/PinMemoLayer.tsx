"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface PinMemo {
  id: string;
  lat: number;
  lng: number;
  memo: string;
  color: string;
  createdAt: string;
}

const PIN_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];

async function fetchPins(): Promise<PinMemo[]> {
  try {
    const res = await fetch("/api/pins");
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function syncPins(pins: PinMemo[]) {
  await fetch("/api/pins", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pins),
  });
}

interface Props {
  map: kakao.maps.Map;
  editMode: boolean;
  onPinCount?: (count: number) => void;
}

export default function PinMemoLayer({ map, editMode, onPinCount }: Props) {
  const [pins, setPins] = useState<PinMemo[]>([]);
  const [editingPin, setEditingPin] = useState<PinMemo | null>(null);
  const [draftMemo, setDraftMemo] = useState("");
  const [draftColor, setDraftColor] = useState(PIN_COLORS[0]);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const clickListenerRef = useRef<((e: any) => void) | null>(null);

  // 초기 로딩
  useEffect(() => {
    fetchPins().then(setPins);
  }, []);

  // 핀 개수 알림
  useEffect(() => {
    onPinCount?.(pins.length);
  }, [pins.length, onPinCount]);

  // 편집 모드: 지도 클릭으로 핀 추가
  useEffect(() => {
    if (!map) return;

    if (clickListenerRef.current) {
      kakao.maps.event.removeListener(map, "click", clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (!editMode) return;

    const handler = (e: any) => {
      const latlng = e.latLng;
      const newPin: PinMemo = {
        id: crypto.randomUUID(),
        lat: latlng.getLat(),
        lng: latlng.getLng(),
        memo: "",
        color: PIN_COLORS[0],
        createdAt: new Date().toISOString(),
      };
      setEditingPin(newPin);
      setDraftMemo("");
      setDraftColor(PIN_COLORS[0]);
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

  // 핀 오버레이 렌더링
  useEffect(() => {
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    if (!map) return;

    for (const pin of pins) {
      const el = document.createElement("div");
      el.style.cssText = `position:relative;cursor:pointer;`;

      const marker = document.createElement("div");
      marker.style.cssText = `
        width:28px;height:28px;
        background:${pin.color};
        border:2px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
      `;
      const inner = document.createElement("div");
      inner.style.cssText = `
        width:10px;height:10px;
        background:white;border-radius:50%;
        transform:rotate(45deg);
      `;
      marker.appendChild(inner);
      el.appendChild(marker);

      if (pin.memo) {
        const preview = document.createElement("div");
        preview.style.cssText = `
          position:absolute;top:-8px;left:32px;
          background:white;padding:2px 6px;border-radius:4px;
          font-size:11px;color:#374151;white-space:nowrap;
          box-shadow:0 1px 3px rgba(0,0,0,.2);
          max-width:150px;overflow:hidden;text-overflow:ellipsis;
          pointer-events:none;
        `;
        preview.textContent = pin.memo;
        el.appendChild(preview);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setEditingPin(pin);
        setDraftMemo(pin.memo);
        setDraftColor(pin.color);
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(pin.lat, pin.lng),
        content: el,
        xAnchor: 0.2,
        yAnchor: 1,
        zIndex: 50,
      });
      overlaysRef.current.push(overlay);
    }

    return () => {
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
    };
  }, [map, pins]);

  const handleSave = useCallback(() => {
    if (!editingPin) return;
    const updated = { ...editingPin, memo: draftMemo, color: draftColor };
    setPins((prev) => {
      const exists = prev.find((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
      syncPins(next);
      return next;
    });
    setEditingPin(null);
  }, [editingPin, draftMemo, draftColor]);

  const handleDelete = useCallback(() => {
    if (!editingPin) return;
    setPins((prev) => {
      const next = prev.filter((p) => p.id !== editingPin.id);
      syncPins(next);
      return next;
    });
    setEditingPin(null);
  }, [editingPin]);

  if (!editingPin) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      onClick={() => setEditingPin(null)}
    >
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-lg shadow-xl p-4 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-sm font-bold text-gray-700 mb-3">
          {pins.find((p) => p.id === editingPin.id) ? "메모 수정" : "새 핀 메모"}
        </h4>

        <textarea
          value={draftMemo}
          onChange={(e) => setDraftMemo(e.target.value)}
          placeholder="메모를 입력하세요..."
          className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
          autoFocus
        />

        <div className="flex gap-1.5 mt-2">
          {PIN_COLORS.map((c) => (
            <button
              key={c}
              className="w-6 h-6 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: c,
                borderColor: draftColor === c ? "#1F2937" : "transparent",
                transform: draftColor === c ? "scale(1.2)" : "scale(1)",
              }}
              onClick={() => setDraftColor(c)}
            />
          ))}
        </div>

        <div className="flex justify-between mt-3">
          {pins.find((p) => p.id === editingPin.id) ? (
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
              onClick={() => setEditingPin(null)}
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
  );
}
