"use client";

import { useEffect, useRef } from "react";
import transitDensity from "@/data/jinju-transit-density.json";

const density = transitDensity as Record<string, number>;

function getTransitColor(count: number): string {
  if (count >= 100) return "#0C4A6E";
  if (count >= 60) return "#0369A1";
  if (count >= 40) return "#0EA5E9";
  if (count >= 20) return "#7DD3FC";
  if (count >= 10) return "#BAE6FD";
  return "#E0F2FE";
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
  map: kakao.maps.Map;
  boundaryData: any;
}

export default function TransitLayer({ map, boundaryData }: TransitLayerProps) {
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
          strokeColor: "#075985",
          strokeOpacity: 0.8,
          fillColor: getTransitColor(count),
          fillOpacity: 0.6,
        });

        kakao.maps.event.addListener(polygon, "mouseover", () => {
          tooltip.setContent(
            `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap"><strong>${name}</strong><br/>정류장 ${count}개</div>`,
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
