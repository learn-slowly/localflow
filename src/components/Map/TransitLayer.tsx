"use client";

import { GeoJSON } from "react-leaflet";
import transitDensity from "@/data/jinju-transit-density.json";
import type { Layer, PathOptions } from "leaflet";

const density = transitDensity as Record<string, number>;

function getTransitColor(count: number): string {
  if (count >= 100) return "#0C4A6E";
  if (count >= 60) return "#0369A1";
  if (count >= 40) return "#0EA5E9";
  if (count >= 20) return "#7DD3FC";
  if (count >= 10) return "#BAE6FD";
  return "#E0F2FE";
}

function transitStyle(feature: any): PathOptions {
  const name = feature?.properties?.name;
  const count = density[name] || 0;
  return {
    color: "#075985",
    weight: 1.5,
    fillColor: getTransitColor(count),
    fillOpacity: 0.6,
  };
}

function onEachFeature(feature: any, layer: Layer) {
  const name = feature?.properties?.name;
  const count = density[name] || 0;
  layer.bindTooltip(
    `<strong>${name}</strong><br/>정류장 ${count}개`,
    { direction: "top" }
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

interface TransitLayerProps {
  boundaryData: any;
}

export default function TransitLayer({ boundaryData }: TransitLayerProps) {
  return (
    <GeoJSON
      key="transit"
      data={boundaryData}
      style={transitStyle}
      onEachFeature={onEachFeature}
    />
  );
}
