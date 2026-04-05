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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const clickListenerRef = useRef<((e: any) => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 초기 로딩
  useEffect(() => {
    fetchPins().then(setPins);
  }, []);

  // 핀 개수 알림
  useEffect(() => {
    onPinCount?.(pins.length);
  }, [pins.length, onPinCount]);

  // 현재 편집 중인 핀 저장 (다른 곳 클릭 시 자동 저장용)
  const saveCurrentPin = useCallback(() => {
    if (!editingPin) return;
    const updated = { ...editingPin, memo: draftMemo, color: draftColor };
    setPins((prev) => {
      const exists = prev.find((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
      syncPins(next);
      return next;
    });
    setEditingPin(null);
    setConfirmDelete(false);
  }, [editingPin, draftMemo, draftColor]);

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
      // 이전 핀 자동 저장
      saveCurrentPin();

      const newPin: PinMemo = {
        id: crypto.randomUUID(),
        lat: latlng.getLat(),
        lng: latlng.getLng(),
        memo: "",
        color: draftColor, // 마지막 선택한 색상 유지
        createdAt: new Date().toISOString(),
      };
      // 즉시 저장 (빈 메모로)
      setPins((prev) => {
        const next = [...prev, newPin];
        syncPins(next);
        return next;
      });
      setEditingPin(newPin);
      setDraftMemo("");
      setConfirmDelete(false);
      // 에디터에 포커스
      setTimeout(() => textareaRef.current?.focus(), 50);
    };

    kakao.maps.event.addListener(map, "click", handler);
    clickListenerRef.current = handler;

    return () => {
      kakao.maps.event.removeListener(map, "click", handler);
      clickListenerRef.current = null;
    };
  }, [map, editMode, saveCurrentPin, draftColor]);

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

  // 편집 모드 해제 시 현재 편집 중인 핀 저장
  useEffect(() => {
    if (!editMode && editingPin) {
      saveCurrentPin();
    }
  }, [editMode]);

  // 핀 오버레이 렌더링
  useEffect(() => {
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    if (!map) return;

    for (const pin of pins) {
      const el = document.createElement("div");
      el.style.cssText = `position:relative;cursor:pointer;`;

      const marker = document.createElement("div");
      const isEditing = editingPin?.id === pin.id;
      marker.style.cssText = `
        width:${isEditing ? "32px" : "28px"};height:${isEditing ? "32px" : "28px"};
        background:${pin.color};
        border:2px solid ${isEditing ? "#1F2937" : "white"};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        transition:all .15s;
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
        // 다른 핀 클릭 시 이전 핀 저장
        if (editingPin && editingPin.id !== pin.id) {
          saveCurrentPin();
        }
        setEditingPin(pin);
        setDraftMemo(pin.memo);
        setDraftColor(pin.color);
        setConfirmDelete(false);
        setTimeout(() => textareaRef.current?.focus(), 50);
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(pin.lat, pin.lng),
        content: el,
        xAnchor: 0.2,
        yAnchor: 1,
        zIndex: isEditing ? 51 : 50,
      });
      overlaysRef.current.push(overlay);
    }

    return () => {
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
    };
  }, [map, pins, editingPin?.id]);

  const handleSave = useCallback(() => {
    if (!editingPin) return;
    const updated = { ...editingPin, memo: draftMemo, color: draftColor };
    setPins((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      syncPins(next);
      return next;
    });
    setEditingPin(null);
    setConfirmDelete(false);
  }, [editingPin, draftMemo, draftColor]);

  const handleDelete = useCallback(() => {
    if (!editingPin) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPins((prev) => {
      const next = prev.filter((p) => p.id !== editingPin.id);
      syncPins(next);
      return next;
    });
    setEditingPin(null);
    setConfirmDelete(false);
  }, [editingPin, confirmDelete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditingPin(null);
      setConfirmDelete(false);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  if (!editingPin) return null;

  const isNew = !pins.find((p) => p.id === editingPin.id);

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2000] w-80"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* 헤더: 색상 선택 + 닫기 */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
          <div className="flex gap-1.5">
            {PIN_COLORS.map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: draftColor === c ? "#1F2937" : "transparent",
                  transform: draftColor === c ? "scale(1.15)" : "scale(1)",
                }}
                onClick={() => {
                  setDraftColor(c);
                  // 색상 변경 즉시 반영
                  if (editingPin) {
                    const updated = { ...editingPin, color: c };
                    setEditingPin(updated);
                    setPins((prev) => {
                      const next = prev.map((p) => (p.id === updated.id ? updated : p));
                      syncPins(next);
                      return next;
                    });
                  }
                }}
              />
            ))}
          </div>
          <button
            onClick={() => { setEditingPin(null); setConfirmDelete(false); }}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* 메모 입력 */}
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={draftMemo}
            onChange={(e) => setDraftMemo(e.target.value)}
            placeholder="메모 입력 (선택)"
            className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
          />

          {/* 하단 버튼 */}
          <div className="flex items-center justify-between mt-2">
            <div>
              {!isNew && (
                <button
                  onClick={handleDelete}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    confirmDelete
                      ? "bg-red-600 text-white"
                      : "text-red-500 hover:text-red-700"
                  }`}
                >
                  {confirmDelete ? "정말 삭제" : "삭제"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter
              </span>
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
    </div>
  );
}
