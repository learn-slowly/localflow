"use client";

import { Marker, Tooltip, useMap } from "react-leaflet";
import { useMemo, useEffect } from "react";
import L from "leaflet";

interface Facility {
  name: string;
  category: string;
  type: string;
  address: string;
  tel: string;
  lat: number;
  lng: number;
}

// 카테고리별 아이콘 설정
const CATEGORY_CONFIG: Record<string, { emoji: string; color: string }> = {
  관공서: { emoji: "🏛️", color: "#4338CA" },
  종합병원: { emoji: "🏥", color: "#DC2626" },
  보건소: { emoji: "🏥", color: "#E11D48" },
  산재지정병원: { emoji: "🏥", color: "#BE123C" },
  병의원: { emoji: "💊", color: "#F43F5E" },
  요양병원: { emoji: "🏥", color: "#FB7185" },
  한방병의원: { emoji: "🏥", color: "#F97316" },
  치과병의원: { emoji: "🦷", color: "#EC4899" },
  약국: { emoji: "💊", color: "#10B981" },
  대학교: { emoji: "🎓", color: "#7C3AED" },
  "초중고": { emoji: "🏫", color: "#6366F1" },
  유아시설: { emoji: "👶", color: "#F59E0B" },
  어린이놀이시설: { emoji: "🛝", color: "#EAB308" },
  약자보호시설: { emoji: "🛡️", color: "#0EA5E9" },
  우수다중시설: { emoji: "⭐", color: "#8B5CF6" },
  종교시설: { emoji: "🛐", color: "#78716C" },
  전통시장: { emoji: "🏪", color: "#D97706" },
};

function createIcon(category: string) {
  const config = CATEGORY_CONFIG[category] || { emoji: "📍", color: "#6B7280" };
  return L.divIcon({
    html: `<div style="
      font-size: 16px;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 2px solid ${config.color};
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    ">${config.emoji}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// 카테고리 그룹
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
    categories: ["관공서", "약자보호시설", "우수다중시설", "종교시설", "전통시장"],
  },
];

export const ALL_CATEGORIES = FACILITY_GROUPS.flatMap((g) => g.categories);

interface FacilitiesLayerProps {
  facilities: Facility[];
  visibleCategories: Set<string>;
}

export default function FacilitiesLayer({
  facilities,
  visibleCategories,
}: FacilitiesLayerProps) {
  const map = useMap();
  const zoom = map.getZoom();

  const filtered = useMemo(() => {
    if (visibleCategories.size === 0) return [];
    return facilities.filter(
      (f) => visibleCategories.has(f.category) && f.lat && f.lng
    );
  }, [facilities, visibleCategories]);

  // 줌 레벨이 낮으면 마커 표시 안 함 (성능)
  if (zoom < 13) return null;

  return (
    <>
      {filtered.map((f, i) => (
        <Marker
          key={`${f.category}-${i}`}
          position={[f.lat, f.lng]}
          icon={createIcon(f.category)}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            <strong>{f.name}</strong>
            <br />
            <span style={{ color: "#6B7280", fontSize: "11px" }}>
              {f.type} · {f.address}
            </span>
            {f.tel && (
              <>
                <br />
                <span style={{ color: "#6B7280", fontSize: "11px" }}>
                  ☎ {f.tel}
                </span>
              </>
            )}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
