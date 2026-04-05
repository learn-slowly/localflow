"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import exifr from "exifr";

export interface PhotoMarker {
  id: string;
  lat: number;
  lng: number;
  thumbnail: string; // base64 data URL
  memo: string;
  takenAt?: string; // EXIF 촬영 시각
  createdAt: string;
}

const MAX_THUMB_SIZE = 800;
const JPEG_QUALITY = 0.7;

async function fetchPhotos(): Promise<PhotoMarker[]> {
  try {
    const res = await fetch("/api/photos");
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function syncPhotos(photos: PhotoMarker[]) {
  await fetch("/api/photos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(photos),
  });
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > MAX_THUMB_SIZE || height > MAX_THUMB_SIZE) {
        const ratio = Math.min(MAX_THUMB_SIZE / width, MAX_THUMB_SIZE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.src = URL.createObjectURL(file);
  });
}

async function extractGps(file: File): Promise<{ lat: number; lng: number; takenAt?: string } | null> {
  try {
    const exif = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate"] });
    if (!exif) return null;
    const lat = exif.latitude;
    const lng = exif.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const takenAt = exif.DateTimeOriginal || exif.CreateDate;
    return {
      lat,
      lng,
      takenAt: takenAt instanceof Date ? takenAt.toISOString() : takenAt ? String(takenAt) : undefined,
    };
  } catch {
    return null;
  }
}

interface Props {
  map: kakao.maps.Map;
  onPhotoCount?: (count: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function PhotoLayer({ map, onPhotoCount, fileInputRef }: Props) {
  const [photos, setPhotos] = useState<PhotoMarker[]>([]);
  const [viewing, setViewing] = useState<PhotoMarker | null>(null);
  const [draftMemo, setDraftMemo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [noGpsFile, setNoGpsFile] = useState<{ file: File; thumbnail: string; takenAt?: string } | null>(null);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const mapClickRef = useRef<((e: any) => void) | null>(null);

  // 초기 로딩
  useEffect(() => {
    fetchPhotos().then(setPhotos);
  }, []);

  useEffect(() => {
    onPhotoCount?.(photos.length);
  }, [photos.length, onPhotoCount]);

  // GPS 없는 사진: 지도 클릭으로 위치 지정
  useEffect(() => {
    if (!map) return;
    if (mapClickRef.current) {
      kakao.maps.event.removeListener(map, "click", mapClickRef.current);
      mapClickRef.current = null;
    }
    if (!noGpsFile) return;

    const container = map.getNode();
    container.style.cursor = "crosshair";

    const handler = (e: any) => {
      const latlng = e.latLng;
      const newPhoto: PhotoMarker = {
        id: crypto.randomUUID(),
        lat: latlng.getLat(),
        lng: latlng.getLng(),
        thumbnail: noGpsFile.thumbnail,
        memo: "",
        takenAt: noGpsFile.takenAt,
        createdAt: new Date().toISOString(),
      };
      container.style.cursor = "";
      setNoGpsFile(null);
      setViewing(newPhoto);
      setDraftMemo("");
    };

    kakao.maps.event.addListener(map, "click", handler);
    mapClickRef.current = handler;

    return () => {
      kakao.maps.event.removeListener(map, "click", handler);
      mapClickRef.current = null;
      container.style.cursor = "";
    };
  }, [map, noGpsFile]);

  // 마커 오버레이 렌더링
  useEffect(() => {
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];
    if (!map) return;

    for (const photo of photos) {
      const el = document.createElement("div");
      el.style.cssText = "position:relative;cursor:pointer;";

      const thumb = document.createElement("div");
      thumb.style.cssText = `
        width:40px;height:40px;
        border-radius:6px;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
        background:url(${photo.thumbnail}) center/cover;
        transition:transform .15s;
      `;
      thumb.addEventListener("mouseenter", () => { thumb.style.transform = "scale(1.2)"; });
      thumb.addEventListener("mouseleave", () => { thumb.style.transform = "scale(1)"; });
      el.appendChild(thumb);

      // 촬영 날짜 라벨
      if (photo.takenAt) {
        const label = document.createElement("div");
        const d = new Date(photo.takenAt);
        label.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
        label.style.cssText = `
          position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,.7);color:white;
          font-size:9px;padding:1px 4px;border-radius:3px;
          white-space:nowrap;pointer-events:none;
        `;
        el.appendChild(label);
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setViewing(photo);
        setDraftMemo(photo.memo);
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(photo.lat, photo.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 60,
      });
      overlaysRef.current.push(overlay);
    }

    return () => {
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
    };
  }, [map, photos]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const [gps, thumbnail] = await Promise.all([extractGps(file), resizeImage(file)]);

      if (gps) {
        const newPhoto: PhotoMarker = {
          id: crypto.randomUUID(),
          lat: gps.lat,
          lng: gps.lng,
          thumbnail,
          memo: "",
          takenAt: gps.takenAt,
          createdAt: new Date().toISOString(),
        };
        setViewing(newPhoto);
        setDraftMemo("");

        // 해당 위치로 지도 이동
        if (map) {
          map.setCenter(new kakao.maps.LatLng(gps.lat, gps.lng));
        }
      } else {
        // GPS 없음 → 수동 위치 지정 모드
        setNoGpsFile({ file, thumbnail, takenAt: undefined });
      }
      break; // 한 장씩 처리
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [map]);

  const handleSave = useCallback(() => {
    if (!viewing) return;
    const updated = { ...viewing, memo: draftMemo };
    setPhotos((prev) => {
      const exists = prev.find((p) => p.id === updated.id);
      const next = exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
      syncPhotos(next);
      return next;
    });
    setViewing(null);
  }, [viewing, draftMemo]);

  const handleDelete = useCallback(() => {
    if (!viewing) return;
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== viewing.id);
      syncPhotos(next);
      return next;
    });
    setViewing(null);
  }, [viewing]);

  return (
    <>
      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* GPS 없는 사진 안내 배너 */}
      {noGpsFile && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[2000] bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-3">
          <span>GPS 정보 없음 — 지도를 클릭하여 위치를 지정하세���</span>
          <button
            onClick={() => { setNoGpsFile(null); if (map) map.getNode().style.cursor = ""; }}
            className="text-white/80 hover:text-white text-xs underline"
          >
            취소
          </button>
        </div>
      )}

      {/* 사진 상세/편집 모달 */}
      {viewing && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center"
          onClick={() => setViewing(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 사진 미리보기 */}
            <div className="relative">
              <img
                src={viewing.thumbnail}
                alt="사진"
                className="w-full rounded-t-lg object-cover max-h-64"
              />
              {viewing.takenAt && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {new Date(viewing.takenAt).toLocaleString("ko-KR")}
                </div>
              )}
            </div>

            <div className="p-4">
              <p className="text-[11px] text-gray-400 mb-2">
                {viewing.lat.toFixed(6)}, {viewing.lng.toFixed(6)}
              </p>

              <textarea
                value={draftMemo}
                onChange={(e) => setDraftMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                autoFocus
              />

              <div className="flex justify-between mt-3">
                {photos.find((p) => p.id === viewing.id) ? (
                  <button
                    onClick={handleDelete}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    ���제
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewing(null)}
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
        </div>
      )}
    </>
  );
}
