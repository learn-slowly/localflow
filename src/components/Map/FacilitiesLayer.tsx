"use client";

import { useEffect, useRef, useMemo, useState } from "react";

interface Facility {
  name: string;
  category: string;
  type: string;
  address: string;
  tel: string;
  lat: number;
  lng: number;
}

const CATEGORY_CONFIG: Record<string, { emoji: string; color: string }> = {
  관공서: { emoji: "\u{1F3DB}\uFE0F", color: "#4338CA" },
  종합병원: { emoji: "\u{1F3E5}", color: "#DC2626" },
  보건소: { emoji: "\u{1F3E5}", color: "#E11D48" },
  산재지정병원: { emoji: "\u{1F3E5}", color: "#BE123C" },
  병의원: { emoji: "\u{1F48A}", color: "#F43F5E" },
  요양병원: { emoji: "\u{1F3E5}", color: "#FB7185" },
  한방병의원: { emoji: "\u{1F3E5}", color: "#F97316" },
  치과병의원: { emoji: "\u{1F9B7}", color: "#EC4899" },
  약국: { emoji: "\u{1F48A}", color: "#10B981" },
  대학교: { emoji: "\u{1F393}", color: "#7C3AED" },
  "초중고": { emoji: "\u{1F3EB}", color: "#6366F1" },
  유아시설: { emoji: "\u{1F476}", color: "#F59E0B" },
  어린이놀이시설: { emoji: "\u{1F6DD}", color: "#EAB308" },
  약자보호시설: { emoji: "\u{1F6E1}\uFE0F", color: "#0EA5E9" },
  우수다중시설: { emoji: "\u{2B50}", color: "#8B5CF6" },
  종교시설: { emoji: "\u{1F6D0}", color: "#78716C" },
  전통시장: { emoji: "\u{1F3EA}", color: "#D97706" },
  경로당: { emoji: "\u{1F3E0}", color: "#92400E" },
};

export const FACILITY_GROUPS: { label: string; categories: string[] }[] = [
  {
    label: "의료",
    categories: ["종합병원", "보건소", "병의원", "한방병의원", "치과병의원", "요양병원", "산재지정병원", "약국"],
  },
  {
    label: "교육",
    categories: ["대학교", "초중고", "유아시설", "어린이놀이시설"],
  },
  {
    label: "공공·안전",
    categories: ["관공서", "약자보호시설", "우수다중시설", "종교시설", "전통시장", "경로당"],
  },
];

export const ALL_CATEGORIES = FACILITY_GROUPS.flatMap((g) => g.categories);

interface FacilitiesLayerProps {
  map: kakao.maps.Map;
  facilities: Facility[];
  visibleCategories: Set<string>;
}

export default function FacilitiesLayer({
  map,
  facilities,
  visibleCategories,
}: FacilitiesLayerProps) {
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const tooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const [level, setLevel] = useState<number>(8);

  // 줌 변경 감지
  useEffect(() => {
    if (!map) return;
    setLevel(map.getLevel());
    const handler = () => setLevel(map.getLevel());
    kakao.maps.event.addListener(map, "zoom_changed", handler);
    return () => kakao.maps.event.removeListener(map, "zoom_changed", handler);
  }, [map]);

  const filtered = useMemo(() => {
    if (visibleCategories.size === 0) return [];
    return facilities.filter(
      (f) => visibleCategories.has(f.category) && f.lat && f.lng,
    );
  }, [facilities, visibleCategories]);

  useEffect(() => {
    // 기존 오버레이 제거
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];
    if (tooltipRef.current) tooltipRef.current.setMap(null);

    // 카카오 level 7 이하 = Leaflet zoom 13+ (상세 보기)
    if (!map || level > 7) return;

    const tooltip = new kakao.maps.CustomOverlay({ zIndex: 200, yAnchor: 1.5 });
    tooltipRef.current = tooltip;

    const overlays: kakao.maps.CustomOverlay[] = [];

    for (const f of filtered) {
      const config = CATEGORY_CONFIG[f.category] || { emoji: "\u{1F4CD}", color: "#6B7280" };

      const el = document.createElement("div");
      el.style.cssText = `
        font-size:16px;width:26px;height:26px;
        display:flex;align-items:center;justify-content:center;
        background:white;border:2px solid ${config.color};border-radius:50%;
        box-shadow:0 1px 3px rgba(0,0,0,.3);cursor:pointer;
      `;
      el.textContent = config.emoji;

      el.addEventListener("mouseenter", () => {
        let html = `<strong>${f.name}</strong><br/><span style="color:#6B7280;font-size:11px">${f.type} · ${f.address}</span>`;
        if (f.tel) html += `<br/><span style="color:#6B7280;font-size:11px">\u260E ${f.tel}</span>`;
        tooltip.setContent(
          `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap">${html}</div>`,
        );
        tooltip.setPosition(new kakao.maps.LatLng(f.lat, f.lng));
        tooltip.setMap(map);
      });
      el.addEventListener("mouseleave", () => tooltip.setMap(null));

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(f.lat, f.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 20,
      });

      overlays.push(overlay);
    }

    overlaysRef.current = overlays;

    return () => {
      for (const o of overlays) o.setMap(null);
      tooltip.setMap(null);
    };
  }, [map, filtered, level]);

  return null;
}
