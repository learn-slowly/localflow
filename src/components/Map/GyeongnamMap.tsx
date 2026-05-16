"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useKakaoMap, toKakaoLevel } from "@/hooks/useKakaoMap";
import { GYEONGNAM_VIEW } from "@/config/cities";
import gyeongnamCities from "@/data/gyeongnam-cities.json";
import jinjuBoundary from "@/data/jinju-boundary.json";
import jinjuDistricts from "@/data/jinju-districts.json";

// 선거 유형 탭
const ELECTION_TYPES = [
  { key: "local", label: "기초의원" },
  { key: "provincial", label: "도의원" },
  { key: "assembly", label: "국회의원" },
  { key: "mayor", label: "시장·군수" },
] as const;

// 인구수에 따른 코로플레스 색상
function populationColor(p: number): string {
  if (p >= 500000) return "#7F1D1D";
  if (p >= 300000) return "#DC2626";
  if (p >= 150000) return "#F87171";
  if (p >= 80000) return "#FCA5A5";
  if (p >= 40000) return "#FECACA";
  return "#FEE2E2";
}

// 진주 선거구 색상 팔레트 (최대 8개 선거구)
const DISTRICT_COLORS = [
  "#2563EB", "#DC2626", "#16A34A", "#CA8A04",
  "#9333EA", "#EA580C", "#0891B2", "#BE185D",
];

// 진주 행정동 → 선거구 색상 매핑 (electionType별)
function jinjuDongDistrictMap(
  electionType: string,
): Record<string, { name: string; color: string }> {
  const types = (jinjuDistricts as { types?: Record<string, { districts?: Array<{ name: string; dongs?: string[] }> }> }).types ?? {};
  const districts = types[electionType]?.districts ?? [];
  const result: Record<string, { name: string; color: string }> = {};
  districts.forEach((d, idx) => {
    const color = DISTRICT_COLORS[idx % DISTRICT_COLORS.length];
    (d.dongs ?? []).forEach((dong: string) => {
      result[dong] = { name: d.name, color };
    });
  });
  return result;
}

export default function GyeongnamMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [electionType, setElectionType] = useState<string>("local");

  const { map, isLoaded } = useKakaoMap(mapRef, {
    center: GYEONGNAM_VIEW.center,
    level: toKakaoLevel(GYEONGNAM_VIEW.zoom),
  });

  // 시군구 폴리곤 로드·표시
  useEffect(() => {
    if (!isLoaded || !map) return;
    let cancelled = false;
    const polygons: kakao.maps.Polygon[] = [];

    fetch("/data/gyeongnam-boundary.json")
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        for (const feat of geo.features) {
          const cityKey = feat.properties.key as string;
          const summary = (gyeongnamCities as Record<string, { totalPopulation?: number }>)[cityKey];
          const color = populationColor(summary?.totalPopulation ?? 0);

          // MultiPolygon: coordinates는 [[outer, inner1, ...], [outer2, ...]] 구조
          // 각 subPoly의 outer ring(subPoly[0])만 사용 (구멍은 무시)
          for (const subPoly of feat.geometry.coordinates) {
            const path = subPoly[0].map(
              ([lng, lat]: [number, number]) => new window.kakao.maps.LatLng(lat, lng),
            );
            const polygon = new window.kakao.maps.Polygon({
              path,
              strokeWeight: 1,
              strokeColor: "#FFFFFF",
              strokeOpacity: 0.8,
              fillColor: color,
              fillOpacity: 0.6,
            });
            polygon.setMap(map);

            window.kakao.maps.event.addListener(polygon, "click", () => {
              router.push(`/${cityKey}`);
            });
            window.kakao.maps.event.addListener(polygon, "mouseover", () => {
              polygon.setOptions({ fillOpacity: 0.85 });
            });
            window.kakao.maps.event.addListener(polygon, "mouseout", () => {
              polygon.setOptions({ fillOpacity: 0.6 });
            });

            polygons.push(polygon);
          }
        }
      })
      .catch((e) => console.error("경남 시군구 경계 로드 실패:", e));

    return () => {
      cancelled = true;
      polygons.forEach((p) => p.setMap(null));
    };
  }, [isLoaded, map, router]);

  // 진주 선거구 레이어: 행정동 폴리곤을 선거구별 색깔로 색칠
  useEffect(() => {
    if (!isLoaded || !map) return;
    const mapping = jinjuDongDistrictMap(electionType);
    const polygons: kakao.maps.Polygon[] = [];

    type BoundaryFeature = {
      properties: { name?: string };
      geometry:
        | { type: "Polygon"; coordinates: number[][][] }
        | { type: "MultiPolygon"; coordinates: number[][][][] };
    };
    const boundary = jinjuBoundary as { features: BoundaryFeature[] };

    for (const feat of boundary.features) {
      const dongName = feat.properties?.name;
      if (!dongName) continue;
      const entry = mapping[dongName];
      if (!entry) continue;

      const geom = feat.geometry;
      // Polygon: coordinates = [outer, hole1, ...]
      // MultiPolygon: coordinates = [[outer, hole1, ...], [outer2, ...]]
      const rings: number[][][][] =
        geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

      for (const polygon of rings) {
        const path = polygon[0].map(
          ([lng, lat]: number[]) => new window.kakao.maps.LatLng(lat, lng),
        );
        const p = new window.kakao.maps.Polygon({
          path,
          strokeWeight: 2,
          strokeColor: entry.color,
          strokeOpacity: 1.0,
          fillColor: entry.color,
          fillOpacity: 0.35,
          zIndex: 5, // 시군구 폴리곤 위에 표시
        });
        p.setMap(map);
        polygons.push(p);
      }
    }

    return () => {
      polygons.forEach((p) => p.setMap(null));
    };
  }, [isLoaded, map, electionType]);

  return (
    <div className="relative h-dvh w-full">
      <div ref={mapRef} className="absolute inset-0" />

      {/* 상단 선거 유형 탭 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-1 bg-white/95 backdrop-blur rounded-full shadow-md px-1 py-1">
        {ELECTION_TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setElectionType(key)}
            className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
              electionType === key
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 좌측 안내 */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur rounded-lg shadow-md px-4 py-3 max-w-xs">
        <h1 className="text-base font-bold text-gray-900">경상남도 지방선거 분석</h1>
        <p className="text-xs text-gray-500 mt-1">시·군을 클릭하면 도시별 상세로 이동</p>
        <p className="text-[11px] text-gray-400 mt-1">
          진주시는 선거 유형 탭에 따라 선거구별 색깔 표시 (다른 시·군 준비 중)
        </p>
      </div>

      {/* 우측 인구 범례 */}
      <div className="absolute bottom-4 right-4 z-10 bg-white/95 backdrop-blur rounded-lg shadow-md px-3 py-2 text-xs">
        <div className="font-semibold text-gray-700 mb-1.5">인구</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-gray-700">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#FEE2E2" }} /> &lt;4만
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#FECACA" }} /> 4–8만
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#FCA5A5" }} /> 8–15만
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#F87171" }} /> 15–30만
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#DC2626" }} /> 30–50만
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: "#7F1D1D" }} /> 50만+
          </div>
        </div>
      </div>
    </div>
  );
}
