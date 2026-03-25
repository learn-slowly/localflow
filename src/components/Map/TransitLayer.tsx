"use client";

import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";

interface BusStop {
  sttnId: string;
  sttnNm: string;
  emdCd: string;
}

// 법정동 → 행정동 매핑
const LEGAL_TO_ADMIN: Record<string, string> = {
  "4817010100": "천전동", "4817010200": "천전동", "4817010300": "천전동", "4817010400": "천전동",
  "4817010500": "성북동", "4817010600": "성북동", "4817010700": "성북동", "4817010800": "성북동",
  "4817010900": "중앙동", "4817011000": "중앙동", "4817011100": "중앙동", "4817011200": "중앙동",
  "4817011300": "성북동", "4817011400": "상봉동", "4817011500": "중앙동", "4817011600": "중앙동",
  "4817011700": "중앙동", "4817011800": "중앙동", "4817011900": "상대동", "4817012000": "하대동",
  "4817012100": "상평동", "4817012200": "초장동", "4817012300": "초장동", "4817012400": "이현동",
  "4817012500": "신안동", "4817012600": "평거동", "4817012700": "이현동", "4817012800": "판문동",
  "4817012900": "판문동", "4817013100": "가호동", "4817013200": "가호동", "4817013700": "충무공동",
};

const PREFIX_TO_ADMIN: Record<string, string> = {
  "4817025": "문산읍", "4817031": "내동면", "4817032": "정촌면", "4817033": "금곡면",
  "4817035": "진성면", "4817036": "일반성면", "4817037": "이반성면", "4817038": "사봉면",
  "4817039": "지수면", "4817040": "대곡면", "4817041": "금산면", "4817042": "집현면",
  "4817043": "미천면", "4817044": "명석면", "4817045": "대평면", "4817046": "수곡면",
};

function getAdminDong(emdCd: string): string {
  return LEGAL_TO_ADMIN[emdCd.slice(0, 10)] || PREFIX_TO_ADMIN[emdCd.slice(0, 7)] || "기타";
}

function getTransitColor(count: number): string {
  if (count >= 100) return "#0C4A6E";
  if (count >= 60) return "#0369A1";
  if (count >= 40) return "#0EA5E9";
  if (count >= 20) return "#7DD3FC";
  if (count >= 10) return "#BAE6FD";
  return "#E0F2FE";
}

interface TransitLayerProps {
  boundaryData: any;
}

export default function TransitLayer({ boundaryData }: TransitLayerProps) {
  const [dongCounts, setDongCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_TRANSIT_API_KEY;
    if (!apiKey) {
      setLoading(false);
      return;
    }

    fetch(`https://stcis.go.kr/openapi/bussttn.json?apikey=${apiKey}&sggCd=48170`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== "OK") return;
        const counts: Record<string, number> = {};
        for (const st of data.result) {
          const dong = getAdminDong(st.emdCd);
          counts[dong] = (counts[dong] || 0) + 1;
        }
        setDongCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !dongCounts) return null;

  function transitStyle(feature: any): PathOptions {
    const name = feature?.properties?.name;
    const count = dongCounts?.[name] || 0;
    return {
      color: "#075985",
      weight: 1.5,
      fillColor: getTransitColor(count),
      fillOpacity: 0.6,
    };
  }

  function onEachFeature(feature: any, layer: Layer) {
    const name = feature?.properties?.name;
    const count = dongCounts?.[name] || 0;
    layer.bindTooltip(
      `<strong>${name}</strong><br/>정류장 ${count}개`,
      { direction: "top" }
    );
  }

  return (
    <GeoJSON
      key="transit"
      data={boundaryData}
      style={transitStyle}
      onEachFeature={onEachFeature}
    />
  );
}

export const TRANSIT_LEGEND = [
  { label: "100+", color: "#0C4A6E" },
  { label: "60+", color: "#0369A1" },
  { label: "40+", color: "#0EA5E9" },
  { label: "20+", color: "#7DD3FC" },
  { label: "10+", color: "#BAE6FD" },
  { label: "10 미만", color: "#E0F2FE" },
];
