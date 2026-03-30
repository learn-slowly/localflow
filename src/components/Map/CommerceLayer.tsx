"use client";

import { useEffect, useRef } from "react";
import commerceDensity from "@/data/jinju-commerce-density.json";

const density = commerceDensity as Record<string, number>;

function getCommerceColor(count: number): string {
  if (count >= 1500) return "#14532D";
  if (count >= 1000) return "#15803D";
  if (count >= 500) return "#22C55E";
  if (count >= 200) return "#86EFAC";
  if (count >= 100) return "#BBF7D0";
  return "#DCFCE7";
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
  map: kakao.maps.Map;
  boundaryData: any;
}

export default function CommerceLayer({ map, boundaryData }: CommerceLayerProps) {
  const polygonsRef = useRef<kakao.maps.Polygon[]>([]);
  const tooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);

  useEffect(() => {
    if (!map || !boundaryData?.features) return;

    const tooltip = new kakao.maps.CustomOverlay({ zIndex: 100, yAnchor: 1.3 });
    tooltipRef.current = tooltip;
    const polygons: kakao.maps.Polygon[] = [];

    for (const feature of boundaryData.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      const name = feature.properties?.name;
      const count = density[name] || 0;

      const coordSets: number[][][][] =
        geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];

      for (const polyCoords of coordSets) {
        const path = polyCoords.map((ring: number[][]) =>
          ring.map(([lng, lat]: number[]) => new kakao.maps.LatLng(lat, lng)),
        );

        const polygon = new kakao.maps.Polygon({
          map,
          path,
          strokeWeight: 1.5,
          strokeColor: "#166534",
          strokeOpacity: 0.8,
          fillColor: getCommerceColor(count),
          fillOpacity: 0.6,
        });

        kakao.maps.event.addListener(polygon, "mouseover", () => {
          tooltip.setContent(
            `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap"><strong>${name}</strong><br/>상가 ${count.toLocaleString()}개</div>`,
          );
          const [lat, lng] = getCentroid(polyCoords[0]);
          tooltip.setPosition(new kakao.maps.LatLng(lat, lng));
          tooltip.setMap(map);
        });

        kakao.maps.event.addListener(polygon, "mouseout", () => {
          tooltip.setMap(null);
        });

        polygons.push(polygon);
      }
    }

    polygonsRef.current = polygons;

    return () => {
      for (const p of polygons) p.setMap(null);
      tooltip.setMap(null);
    };
  }, [map, boundaryData]);

  return null;
}

function getCentroid(ring: number[][]): [number, number] {
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lat += y; lng += x; }
  const n = ring.length || 1;
  return [lat / n, lng / n];
}
