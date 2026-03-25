"use client";

import { GeoJSON } from "react-leaflet";
import commerceDensity from "@/data/jinju-commerce-density.json";
import type { Layer, PathOptions } from "leaflet";

const density = commerceDensity as Record<string, number>;

function getCommerceColor(count: number): string {
  if (count >= 1500) return "#14532D";
  if (count >= 1000) return "#15803D";
  if (count >= 500) return "#22C55E";
  if (count >= 200) return "#86EFAC";
  if (count >= 100) return "#BBF7D0";
  return "#DCFCE7";
}

function commerceStyle(feature: any): PathOptions {
  const name = feature?.properties?.name;
  const count = density[name] || 0;
  return {
    color: "#166534",
    weight: 1.5,
    fillColor: getCommerceColor(count),
    fillOpacity: 0.6,
  };
}

function onEachFeature(feature: any, layer: Layer) {
  const name = feature?.properties?.name;
  const count = density[name] || 0;
  layer.bindTooltip(
    `<strong>${name}</strong><br/>상가 ${count.toLocaleString()}개`,
    { direction: "top" }
  );
}

export const COMMERCE_LEGEND = [
  { label: "1,500+", color: "#14532D" },
  { label: "1,000+", color: "#15803D" },
  { label: "500+", color: "#22C55E" },
  { label: "200+", color: "#86EFAC" },
  { label: "100+", color: "#BBF7D0" },
  { label: "100 미만", color: "#DCFCE7" },
];

interface CommerceLayerProps {
  boundaryData: any;
}

export default function CommerceLayer({ boundaryData }: CommerceLayerProps) {
  return (
    <GeoJSON
      key="commerce"
      data={boundaryData}
      style={commerceStyle}
      onEachFeature={onEachFeature}
    />
  );
}
