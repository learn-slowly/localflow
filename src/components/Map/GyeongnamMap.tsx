"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useKakaoMap, toKakaoLevel } from "@/hooks/useKakaoMap";
import { GYEONGNAM_VIEW } from "@/config/cities";
import gyeongnamCities from "@/data/gyeongnam-cities.json";
import {
  buildDongDistrictMap,
  type ElectionType,
  type GyeongnamDistricts,
} from "@/lib/district-mapping";

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


export default function GyeongnamMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [electionType, setElectionType] = useState<string>("local");
  const [gyeongnamDistricts, setGyeongnamDistricts] =
    useState<GyeongnamDistricts | null>(null);

  const { map, isLoaded } = useKakaoMap(mapRef, {
    center: GYEONGNAM_VIEW.center,
    level: toKakaoLevel(GYEONGNAM_VIEW.zoom),
  });

  // 전국 매핑 데이터 fetch (한 번)
  useEffect(() => {
    let cancelled = false;
    fetch("/data/gyeongnam-districts.json")
      .then((r) => r.json())
      .then((data: GyeongnamDistricts) => {
        if (!cancelled) setGyeongnamDistricts(data);
      })
      .catch((e) => console.error("경남 선거구 매핑 로드 실패:", e));
    return () => {
      cancelled = true;
    };
  }, []);

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

  // 동 모드 레이어: 22개 시·군 행정동 폴리곤을 선거구별 색으로 색칠.
  // 현재는 항상 동 폴리곤도 함께 그림 (다음 task에서 줌 임계값으로 전환).
  const [dongGeo, setDongGeo] = useState<{
    features: Array<{
      geometry:
        | { type: "Polygon"; coordinates: number[][][] }
        | { type: "MultiPolygon"; coordinates: number[][][][] };
      properties: { sgg: string; admName: string; cityKey: string };
    }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/gyeongnam-dong-boundary.json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDongGeo(data);
      })
      .catch((e) => console.error("경남 행정동 GeoJSON 로드 실패:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !map || !dongGeo || !gyeongnamDistricts) return;
    const polygons: kakao.maps.Polygon[] = [];

    for (const feat of dongGeo.features) {
      const { cityKey, admName } = feat.properties;
      const mapping = buildDongDistrictMap(
        gyeongnamDistricts,
        cityKey,
        electionType as ElectionType,
      );
      const entry = mapping[admName];
      if (!entry) continue;

      const geom = feat.geometry;
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
          zIndex: 5,
        });
        p.setMap(map);

        window.kakao.maps.event.addListener(p, "click", () => {
          router.push(`/${cityKey}`);
        });
        window.kakao.maps.event.addListener(p, "mouseover", () => {
          p.setOptions({ fillOpacity: 0.55 });
        });
        window.kakao.maps.event.addListener(p, "mouseout", () => {
          p.setOptions({ fillOpacity: 0.35 });
        });

        polygons.push(p);
      }
    }

    return () => {
      polygons.forEach((p) => p.setMap(null));
    };
  }, [isLoaded, map, dongGeo, gyeongnamDistricts, electionType, router]);

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
