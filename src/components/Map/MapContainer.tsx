"use client";

import { useState, useEffect, useRef } from "react";
import { useKakaoMap, toKakaoLevel } from "@/hooks/useKakaoMap";
import { cities, DEFAULT_CITY, GYEONGNAM_VIEW } from "@/config/cities";
import type { CityConfig } from "@/config/cities";
import jinjuBoundary from "@/data/jinju-boundary.json";
import jinjuLegalBoundary from "@/data/jinju-legal-boundary.json";
import jinjuPollingStations from "@/data/jinju-polling-stations.json";
import jinjuBusStops from "@/data/jinju-bus-stops.json";
import PopulationPanel from "./PopulationPanel";
import ElectionPanel from "./ElectionPanel";
import TransitUsagePanel from "./TransitUsagePanel";
import DistrictDashboard from "./DistrictDashboard";
import CommerceLayer, { COMMERCE_LEGEND } from "./CommerceLayer";
import TransitHeatmapLayer, {
  DOW_OPTIONS,
  DOW_SHORT,
  HOUR_OPTIONS,
  HEATMAP_LEGEND,
} from "./TransitHeatmapLayer";
import FacilitiesLayer, { FACILITY_GROUPS, ALL_CATEGORIES } from "./FacilitiesLayer";
import PinMemoLayer from "./PinMemoLayer";
import CampaignLayer from "./CampaignLayer";
import type { CampaignRecord } from "./CampaignLayer";
import jinjuTransitUsage from "@/data/jinju-transit-usage.json";
import jinjuDistricts from "@/data/jinju-districts.json";

// 경계 데이터를 API에서 fetch
async function fetchBoundaryData(sggCode?: string): Promise<any> {
  const params = sggCode
    ? `type=cached&sggCode=${sggCode}`
    : `type=cached&sidoCode=48`;
  const res = await fetch(`/api/boundary?${params}`);
  return res.json();
}

// 진주 전용: 정류장 ID로 이용량 데이터 검색
const jinjuUsageById: Record<string, any> = {};
(jinjuTransitUsage as any[]).forEach((s) => {
  jinjuUsageById[s.sttn_id] = s;
});

// 선거구별 색상
const DISTRICT_COLORS = [
  "#2563EB", "#DC2626", "#16A34A", "#CA8A04",
  "#9333EA", "#EA580C", "#0891B2", "#BE185D",
];

function buildDongMappingFromElections(
  electionsData: any[],
  localElectionsData: any[],
  type: string,
) {
  const mapping: Record<string, { name: string; color: string }> = {};
  let entry: any;

  if (type === "assembly") {
    entry = electionsData.find((e: any) => e.dongResults?.length > 0 && (e.label?.includes("총선") || e.results?.length > 1));
  } else {
    const subTypeMap: Record<string, string> = { local: "기초의원", provincial: "도의원", mayor: "시장" };
    const sub = subTypeMap[type];
    entry = [...localElectionsData]
      .filter((e: any) => e.subType === sub && e.dongResults?.length > 0)
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))[0];
  }

  const staticDistricts = ((jinjuDistricts as any)?.types?.[type]?.districts || []);
  const districtOrder: string[] = staticDistricts.map((d: any) => d.name);

  if (entry?.dongResults) {
    for (const d of entry.dongResults) {
      if (!d.dong || d.dong in mapping) continue;
      if (d.district && !districtOrder.includes(d.district)) districtOrder.push(d.district);
      const idx = districtOrder.indexOf(d.district);
      mapping[d.dong] = { name: d.district, color: DISTRICT_COLORS[idx % DISTRICT_COLORS.length] };
    }
  }

  for (const dist of staticDistricts) {
    const idx = districtOrder.indexOf(dist.name);
    for (const dong of dist.dongs || []) {
      if (!(dong in mapping)) {
        mapping[dong] = { name: dist.name, color: DISTRICT_COLORS[idx % DISTRICT_COLORS.length] };
      }
    }
  }

  return mapping;
}

function getPopulationColor(population: number): string {
  if (population >= 30000) return "#7F1D1D";
  if (population >= 20000) return "#DC2626";
  if (population >= 10000) return "#F87171";
  if (population >= 5000) return "#FCA5A5";
  if (population >= 2000) return "#FECACA";
  return "#FEE2E2";
}

const SGG_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
  "#E11D48", "#84CC16", "#0EA5E9", "#D946EF", "#FB923C",
  "#22D3EE", "#A855F7", "#4ADE80", "#F43F5E", "#2DD4BF",
  "#818CF8", "#FBBF24",
];

const POP_LEGEND = [
  { label: "3만+", color: "#7F1D1D" },
  { label: "2만+", color: "#DC2626" },
  { label: "1만+", color: "#F87171" },
  { label: "5천+", color: "#FCA5A5" },
  { label: "2천+", color: "#FECACA" },
  { label: "2천 미만", color: "#FEE2E2" },
];

type SelectedDong = {
  name: string;
  population: number;
  households: number;
  male: number;
  female: number;
  age?: Record<string, number>;
} | null;

const sggColorMap: Record<string, string> = {};
Object.values(cities).forEach((city, i) => {
  sggColorMap[city.code] = SGG_COLORS[i % SGG_COLORS.length];
});

// GeoJSON 좌표 → 카카오 폴리곤 path
function geoJsonToPath(coordinates: number[][][]): kakao.maps.LatLng[][] {
  return coordinates.map((ring) =>
    ring.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng)),
  );
}

// 좌표 배열의 중심점
function getCentroid(ring: number[][]): [number, number] {
  let lat = 0, lng = 0;
  for (const [x, y] of ring) { lat += y; lng += x; }
  const n = ring.length || 1;
  return [lat / n, lng / n];
}

// 폴리곤 생성 헬퍼
function createPolygonsFromGeoJson(
  map: kakao.maps.Map,
  geojson: any,
  styleFunc: (feature: any) => {
    strokeWeight?: number; strokeColor?: string; strokeOpacity?: number;
    strokeStyle?: string; fillColor?: string; fillOpacity?: number;
  },
  opts?: {
    tooltip?: (feature: any) => string;
    onClick?: (feature: any) => void;
    sharedTooltip?: kakao.maps.CustomOverlay;
  },
): { polygons: kakao.maps.Polygon[]; tooltip: kakao.maps.CustomOverlay } {
  const tooltip = opts?.sharedTooltip || new kakao.maps.CustomOverlay({ zIndex: 100, yAnchor: 1.3 });
  const polygons: kakao.maps.Polygon[] = [];

  for (const feature of (geojson?.features || [])) {
    const geom = feature.geometry;
    if (!geom) continue;

    const style = styleFunc(feature);
    const coordSets: number[][][][] =
      geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];

    for (const polyCoords of coordSets) {
      const path = geoJsonToPath(polyCoords);

      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: style.strokeWeight ?? 2,
        strokeColor: style.strokeColor ?? "#333",
        strokeOpacity: style.strokeOpacity ?? 0.8,
        strokeStyle: style.strokeStyle,
        fillColor: style.fillColor ?? "#fff",
        fillOpacity: style.fillOpacity ?? 0.1,
      });

      if (opts?.tooltip) {
        const [lat, lng] = getCentroid(polyCoords[0]);
        kakao.maps.event.addListener(polygon, "mouseover", () => {
          tooltip.setContent(
            `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap">${opts.tooltip!(feature)}</div>`,
          );
          tooltip.setPosition(new kakao.maps.LatLng(lat, lng));
          tooltip.setMap(map);
        });
        kakao.maps.event.addListener(polygon, "mouseout", () => tooltip.setMap(null));
      }

      if (opts?.onClick) {
        kakao.maps.event.addListener(polygon, "click", () => opts.onClick!(feature));
      }

      polygons.push(polygon);
    }
  }

  return { polygons, tooltip };
}

function clearPolygons(polygons: kakao.maps.Polygon[], tooltip?: kakao.maps.CustomOverlay | null) {
  for (const p of polygons) p.setMap(null);
  if (tooltip) tooltip.setMap(null);
}

export default function MapContainer() {
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>("jinju");
  const selectedCity = selectedCityKey ? cities[selectedCityKey] : null;
  const isJinju = selectedCityKey === "jinju";

  // 레이어 토글
  const [showAdmin, setShowAdmin] = useState(true);
  const [showLegal, setShowLegal] = useState(false);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showPolling, setShowPolling] = useState(false);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showCommerce, setShowCommerce] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [electionType, setElectionType] = useState<"local" | "provincial" | "mayor" | "assembly">("local");
  const [selectedDong, setSelectedDong] = useState<SelectedDong>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [clickedDongName, setClickedDongName] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [selectedBusStop, setSelectedBusStop] = useState<any>(null);
  const [transitDow, setTransitDow] = useState("전체");
  const [transitHour, setTransitHour] = useState("전체");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showFacilities, setShowFacilities] = useState(false);
  const [facilitiesData, setFacilitiesData] = useState<any[]>([]);
  const [facilityCategories, setFacilityCategories] = useState<Set<string>>(new Set(["종합병원", "보건소", "관공서", "전통시장"]));
  const [showPinMemo, setShowPinMemo] = useState(false);
  const [pinEditMode, setPinEditMode] = useState(false);
  const [pinCount, setPinCount] = useState(0);
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignEditMode, setCampaignEditMode] = useState(false);
  const [campaignCount, setCampaignCount] = useState(0);
  const [campaignFilter, setCampaignFilter] = useState<Set<CampaignRecord["status"]>>(new Set(["planned", "done", "skipped"]));
  const [placeInfo, setPlaceInfo] = useState<any>(null);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  // 경계·인구·선거 데이터
  const [boundaryData, setBoundaryData] = useState<any>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(true);
  const [populationData, setPopulationData] = useState<any>(null);
  const [electionsData, setElectionsData] = useState<any[]>([]);
  const [localElectionsData, setLocalElectionsData] = useState<any[]>([]);

  // 카카오맵 초기화
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapCenter = selectedCity ? selectedCity.center : GYEONGNAM_VIEW.center;
  const mapZoom = selectedCity ? selectedCity.zoom : GYEONGNAM_VIEW.zoom;
  const { map, isLoaded } = useKakaoMap(mapContainerRef, {
    center: mapCenter,
    level: toKakaoLevel(mapZoom),
  });

  // 폴리곤 refs
  const adminPolygonsRef = useRef<kakao.maps.Polygon[]>([]);
  const adminTooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const legalPolygonsRef = useRef<kakao.maps.Polygon[]>([]);
  const legalTooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const popPolygonsRef = useRef<kakao.maps.Polygon[]>([]);
  const popTooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const distPolygonsRef = useRef<kakao.maps.Polygon[]>([]);
  const distTooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const pollingOverlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  const pollingTooltipRef = useRef<kakao.maps.CustomOverlay | null>(null);

  // 시설 데이터 로딩
  useEffect(() => {
    if (!showFacilities) return;
    setFacilitiesData([]);
    const code = selectedCity?.code;
    const facilitiesUrl = code ? `/data/facilities/${code}-facilities.json` : null;
    const marketsUrl = code ? `/data/facilities/${code}-markets.json` : `/data/facilities/gyeongnam-markets.json`;

    const fetches: Promise<any[]>[] = [
      fetch(marketsUrl).then((r) => r.ok ? r.json() : []).catch(() => []),
    ];
    if (facilitiesUrl) {
      fetches.push(fetch(facilitiesUrl).then((r) => r.ok ? r.json() : []).catch(() => []));
    }
    Promise.all(fetches).then((results) => setFacilitiesData(results.flat()));
  }, [showFacilities, selectedCityKey]);

  // 도시 변경 시 데이터 로딩
  useEffect(() => {
    setSelectedDong(null);
    setSelectedDistrict(null);
    setSelectedBusStop(null);
    setBoundaryLoading(true);
    setPopulationData(null);
    setElectionsData([]);
    setLocalElectionsData([]);
    fetchBoundaryData(selectedCity?.code).then((data) => {
      setBoundaryData(data);
      setBoundaryLoading(false);
    });
    if (selectedCity) {
      fetch(`/data/population/${selectedCity.code}-population.json`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => setPopulationData(data))
        .catch(() => setPopulationData(null));
      Promise.all([
        fetch(`/data/elections/${selectedCity.code}-elections.json`).then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch(`/data/elections/${selectedCity.code}-local-elections.json`).then((r) => r.ok ? r.json() : []).catch(() => []),
      ]).then(([el, lo]) => {
        setElectionsData(el);
        setLocalElectionsData(lo);
      });
    }
  }, [selectedCityKey]);

  // 지도 뷰 업데이트
  useEffect(() => {
    if (!map) return;
    const center = new kakao.maps.LatLng(mapCenter[0], mapCenter[1]);
    map.panTo(center);
    map.setLevel(toKakaoLevel(mapZoom), { animate: true });
  }, [map, selectedCityKey]);

  // 선거구 매핑
  const dongToDistrict = selectedCity
    ? buildDongMappingFromElections(electionsData, localElectionsData, electionType)
    : {};
  const currentDistricts = (() => {
    const staticOrder = ((jinjuDistricts as any)?.types?.[electionType]?.districts || []).map((d: any) => d.name);
    const seen = new Set<string>();
    const list = Object.values(dongToDistrict)
      .filter((d) => { if (seen.has(d.name)) return false; seen.add(d.name); return true; })
      .map((d) => ({ name: d.name, color: d.color }));
    list.sort((a, b) => {
      const ai = staticOrder.indexOf(a.name);
      const bi = staticOrder.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return list;
  })();

  // ─── 경남 전체 / 행정동 경계 레이어 ───
  useEffect(() => {
    clearPolygons(adminPolygonsRef.current, adminTooltipRef.current);
    adminPolygonsRef.current = [];
    adminTooltipRef.current = null;

    if (!map || !boundaryData) return;

    // 경남 전체 보기
    if (!selectedCity && showAdmin) {
      const { polygons, tooltip } = createPolygonsFromGeoJson(
        map, boundaryData,
        (feature) => {
          const sgg = feature?.properties?.sgg;
          const color = sggColorMap[sgg] || "#999";
          return { strokeWeight: 1.5, strokeColor: color, fillColor: color, fillOpacity: 0.15 };
        },
        {
          tooltip: (feature) => {
            const adm = feature?.properties?.adm_nm || "";
            const sggnm = feature?.properties?.sggnm || "";
            const dongName = adm.replace(`경상남도 ${sggnm} `, "");
            return `<strong>${sggnm}</strong><br/>${dongName}`;
          },
          onClick: (feature) => {
            const sgg = feature?.properties?.sgg;
            const cityEntry = Object.entries(cities).find(([, c]) => c.code === sgg);
            if (cityEntry) setSelectedCityKey(cityEntry[0]);
          },
        },
      );
      adminPolygonsRef.current = polygons;
      adminTooltipRef.current = tooltip;
      return;
    }

    // 개별 도시: 행정동 경계 (인구·선거구 레이어가 없을 때만)
    if (selectedCity && showAdmin && !showPopulation) {
      const { polygons, tooltip } = createPolygonsFromGeoJson(
        map, boundaryData,
        () => ({ strokeWeight: 2, strokeColor: "#2563EB", fillColor: "#3B82F6", fillOpacity: 0.1 }),
        {
          tooltip: (feature) => {
            const name = feature.properties?.name || feature.properties?.adm_nm?.split(" ").pop();
            return name || "";
          },
        },
      );
      adminPolygonsRef.current = polygons;
      adminTooltipRef.current = tooltip;
    }
  }, [map, boundaryData, selectedCityKey, showAdmin, showPopulation]);

  // ─── 법정동 경계 (진주 전용) ───
  useEffect(() => {
    clearPolygons(legalPolygonsRef.current, legalTooltipRef.current);
    legalPolygonsRef.current = [];
    legalTooltipRef.current = null;

    if (!map || !isJinju || !showLegal) return;

    const { polygons, tooltip } = createPolygonsFromGeoJson(
      map, jinjuLegalBoundary,
      () => ({
        strokeWeight: 2, strokeColor: "#DC2626", strokeStyle: "shortdash",
        fillColor: "#EF4444", fillOpacity: 0.1,
      }),
      {
        tooltip: (feature) => {
          const name = feature.properties?.name || feature.properties?.adm_nm?.split(" ").pop();
          return name || "";
        },
      },
    );
    legalPolygonsRef.current = polygons;
    legalTooltipRef.current = tooltip;
  }, [map, isJinju, showLegal]);

  // ─── 인구정보 레이어 ───
  useEffect(() => {
    clearPolygons(popPolygonsRef.current, popTooltipRef.current);
    popPolygonsRef.current = [];
    popTooltipRef.current = null;

    if (!map || !selectedCity || !showPopulation || !populationData) return;

    const { polygons, tooltip } = createPolygonsFromGeoJson(
      map, populationData,
      (feature) => {
        const pop = feature?.properties?.population || 0;
        return { strokeWeight: 1.5, strokeColor: "#991B1B", fillColor: getPopulationColor(pop), fillOpacity: 0.6 };
      },
      {
        tooltip: (feature) => {
          const p = feature.properties;
          return `<strong>${p?.name}</strong> ${(p?.population || 0).toLocaleString()}명`;
        },
        onClick: (feature) => {
          const p = feature.properties;
          if (!p) return;
          setSelectedDistrict(null);
          setSelectedDong({
            name: p.name,
            population: p.population || 0,
            households: p.households || 0,
            male: p.male || 0,
            female: p.female || 0,
            age: p.age || undefined,
          });
        },
      },
    );
    popPolygonsRef.current = polygons;
    popTooltipRef.current = tooltip;
  }, [map, selectedCityKey, showPopulation, populationData]);

  // ─── 선거구 레이어 ───
  useEffect(() => {
    clearPolygons(distPolygonsRef.current, distTooltipRef.current);
    distPolygonsRef.current = [];
    distTooltipRef.current = null;

    if (!map || !selectedCity || !showDistricts || !populationData || currentDistricts.length === 0) return;

    const { polygons, tooltip } = createPolygonsFromGeoJson(
      map, populationData,
      (feature) => {
        const name = feature?.properties?.name || feature?.properties?.adm_nm?.split(" ").pop();
        const info = dongToDistrict[name || ""];
        const isSelected = selectedDistrict && info?.name === selectedDistrict;
        return {
          strokeWeight: isSelected ? 3 : 2,
          strokeColor: info?.color || "#999",
          fillColor: info?.color || "#999",
          fillOpacity: isSelected ? 0.4 : 0.2,
        };
      },
      {
        tooltip: (feature) => {
          const name = feature?.properties?.name || feature?.properties?.adm_nm?.split(" ").pop();
          const info = dongToDistrict[name || ""];
          return info ? `<strong>${name}</strong><br/>${info.name}` : (name || "");
        },
        onClick: (feature) => {
          const name = feature?.properties?.name || feature?.properties?.adm_nm?.split(" ").pop();
          const info = dongToDistrict[name || ""];
          if (info) {
            setSelectedDong(null);
            setClickedDongName(name || null);
            setSelectedDistrict(info.name || null);
          }
        },
      },
    );
    distPolygonsRef.current = polygons;
    distTooltipRef.current = tooltip;
  }, [map, selectedCityKey, showDistricts, populationData, electionType, selectedDistrict, currentDistricts.length, JSON.stringify(dongToDistrict)]);

  // ─── 투표소 오버레이 (진주 전용) ───
  useEffect(() => {
    for (const o of pollingOverlaysRef.current) o.setMap(null);
    pollingOverlaysRef.current = [];
    if (pollingTooltipRef.current) pollingTooltipRef.current.setMap(null);

    if (!map || !isJinju || !showPolling) return;

    const tooltip = new kakao.maps.CustomOverlay({ zIndex: 200, yAnchor: 1.5 });
    pollingTooltipRef.current = tooltip;
    const overlays: kakao.maps.CustomOverlay[] = [];

    for (const st of jinjuPollingStations as any[]) {
      const el = document.createElement("div");
      el.style.cssText = `
        width:12px;height:12px;border-radius:50%;
        background:#8B5CF6;border:1.5px solid #7C3AED;
        cursor:pointer;
      `;

      el.addEventListener("mouseenter", () => {
        let html = `<strong>${st.name}</strong><br/>${st.place}`;
        html += `<br/><span style="font-size:11px;color:#666">${st.addr}${st.floor ? ` (${st.floor})` : ""}</span>`;
        tooltip.setContent(
          `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap">${html}</div>`,
        );
        tooltip.setPosition(new kakao.maps.LatLng(st.lat, st.lng));
        tooltip.setMap(map);
      });
      el.addEventListener("mouseleave", () => tooltip.setMap(null));

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(st.lat, st.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 15,
      });
      overlays.push(overlay);
    }

    pollingOverlaysRef.current = overlays;

    return () => {
      for (const o of overlays) o.setMap(null);
      tooltip.setMap(null);
    };
  }, [map, isJinju, showPolling]);

  // ─── 지도 클릭 → 장소 정보 조회 ───
  useEffect(() => {
    if (!map) return;

    const handler = (e: any) => {
      // 핀 편집 모드일 때는 장소 조회 안 함
      if (pinEditMode || campaignEditMode) return;
      const lat = e.latLng.getLat();
      const lng = e.latLng.getLng();
      setPlaceLoading(true);
      setPlaceInfo(null);
      fetch(`/api/places?lat=${lat}&lng=${lng}`)
        .then((r) => r.json())
        .then((data) => setPlaceInfo({ ...data, lat, lng }))
        .catch(() => setPlaceInfo(null))
        .finally(() => setPlaceLoading(false));
    };

    kakao.maps.event.addListener(map, "click", handler);
    return () => { kakao.maps.event.removeListener(map, "click", handler); };
  }, [map, pinEditMode, campaignEditMode]);

  // 내 위치로 이동
  const goToMyLocation = () => {
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.setCenter(latlng);
        map.setLevel(3);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // ─── 장소 검색 ───
  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const center = map ? map.getCenter() : null;
      let url = `/api/places/search?q=${encodeURIComponent(q)}`;
      if (center) url += `&x=${center.getLng()}&y=${center.getLat()}`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.places || []);
    } catch { /* */ }
    setSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    for (const o of searchOverlaysRef.current) o.setMap(null);
    searchOverlaysRef.current = [];
  };

  const goToSearchResult = (place: any) => {
    if (!map) return;
    map.setCenter(new kakao.maps.LatLng(place.lat, place.lng));
    map.setLevel(3);
  };

  // 검색 결과 마커
  useEffect(() => {
    for (const o of searchOverlaysRef.current) o.setMap(null);
    searchOverlaysRef.current = [];

    if (!map || searchResults.length === 0) return;

    const tooltip = new kakao.maps.CustomOverlay({ zIndex: 300, yAnchor: 1.5 });

    for (let i = 0; i < searchResults.length; i++) {
      const place = searchResults[i];
      const el = document.createElement("div");
      el.style.cssText = `
        width:24px;height:24px;border-radius:50%;
        background:#EF4444;border:2px solid white;
        color:white;font-size:11px;font-weight:bold;
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.3);
      `;
      el.textContent = String(i + 1);

      el.addEventListener("mouseenter", () => {
        tooltip.setContent(
          `<div style="background:white;padding:4px 8px;border-radius:4px;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap">
            <strong>${place.name}</strong><br/>
            <span style="color:#666;font-size:11px">${place.address || ""}</span>
          </div>`,
        );
        tooltip.setPosition(new kakao.maps.LatLng(place.lat, place.lng));
        tooltip.setMap(map);
      });
      el.addEventListener("mouseleave", () => tooltip.setMap(null));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setPlaceInfo({
          address: place.address,
          region: null,
          places: [place],
          lat: place.lat,
          lng: place.lng,
        });
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: new kakao.maps.LatLng(place.lat, place.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 60,
      });
      searchOverlaysRef.current.push(overlay);
    }

    // 전체 결과가 보이도록 지도 범위 조정
    const bounds = new kakao.maps.LatLngBounds();
    for (const p of searchResults) bounds.extend(new kakao.maps.LatLng(p.lat, p.lng));
    map.setBounds(bounds, 80, 80, 80, 80);

    return () => {
      for (const o of searchOverlaysRef.current) o.setMap(null);
      searchOverlaysRef.current = [];
      tooltip.setMap(null);
    };
  }, [map, searchResults]);

  // 도시 선택 옵션
  const cityOptions = [
    { key: "", label: "경남 전체" },
    ...Object.entries(cities).map(([key, city]) => ({ key, label: city.name })),
  ];

  return (
    <div className="relative h-screen w-full">
      {/* 카카오맵 컨테이너 */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* 장소 검색 */}
      <div className="absolute top-4 left-4 z-[1000]">
        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="장소 검색..."
              className="w-56 px-3 py-2 pr-8 text-sm bg-white rounded-lg shadow-lg border-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 placeholder-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >&times;</button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="w-9 h-9 bg-blue-600 text-white rounded-lg shadow-lg flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            )}
          </button>
        </form>

        {searchOpen && searchResults.length > 0 && (
          <div className="mt-1 bg-white rounded-lg shadow-lg max-h-80 overflow-y-auto w-64">
            {searchResults.map((p, i) => (
              <button
                key={p.id || i}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0 flex items-start gap-2"
                onClick={() => goToSearchResult(p)}
              >
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{p.category}{p.distance ? ` · ${p.distance}` : ""}</p>
                  <p className="text-[10px] text-gray-400 truncate">{p.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 내 위치 버튼 */}
      <button
        onClick={goToMyLocation}
        disabled={locating}
        className="absolute bottom-6 right-4 z-[1000] w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
        title="내 위치"
      >
        {locating ? (
          <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        )}
      </button>

      {/* 카카오맵 위 레이어 컴포넌트 */}
      {map && isJinju && showCommerce && (
        <CommerceLayer map={map} boundaryData={jinjuBoundary} />
      )}
      {map && showFacilities && facilitiesData.length > 0 && (
        <FacilitiesLayer map={map} facilities={facilitiesData} visibleCategories={facilityCategories} />
      )}
      {map && showPinMemo && (
        <PinMemoLayer map={map} editMode={pinEditMode} onPinCount={setPinCount} />
      )}
      {map && showCampaign && (
        <CampaignLayer map={map} editMode={campaignEditMode} statusFilter={campaignFilter} onRecordCount={setCampaignCount} />
      )}
      {map && isJinju && showBusStops && (
        <TransitHeatmapLayer
          map={map}
          selectedDow={transitDow}
          selectedHour={transitHour}
          onStationClick={(s) => {
            setSelectedBusStop(s);
            setSelectedDong(null);
            setSelectedDistrict(null);
          }}
        />
      )}

      {/* 도시 선택 + 레이어 패널 */}
      <div className="absolute top-4 right-4 z-[1000] rounded-lg bg-white shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 p-3 pb-0">
          <select
            value={selectedCityKey || ""}
            onChange={(e) => setSelectedCityKey(e.target.value || null)}
            className="flex-1 text-sm border rounded px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {cityOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
            title={panelCollapsed ? "패널 펼치기" : "패널 접기"}
          >
            {panelCollapsed ? "\u25BC" : "\u25B2"}
          </button>
        </div>

        {!panelCollapsed && <div className="p-3 pt-2">
        <h3 className="mb-2 text-sm font-bold text-gray-700">레이어</h3>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input type="checkbox" checked={showAdmin} onChange={(e) => setShowAdmin(e.target.checked)} className="accent-blue-600" />
          행정동 경계
        </label>

        {selectedCity && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
            <input type="checkbox" checked={showPopulation} onChange={(e) => setShowPopulation(e.target.checked)} className="accent-rose-600" />
            인구정보
          </label>
        )}

        {selectedCity && (
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
            <input type="checkbox" checked={showDistricts} onChange={(e) => setShowDistricts(e.target.checked)} className="accent-purple-600" />
            선거결과
          </label>
        )}

        {isJinju && (
          <>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input type="checkbox" checked={showLegal} onChange={(e) => setShowLegal(e.target.checked)} className="accent-red-600" />
              법정동 경계
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input type="checkbox" checked={showPolling} onChange={(e) => setShowPolling(e.target.checked)} className="accent-violet-600" />
              투표소
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input type="checkbox" checked={showBusStops} onChange={(e) => setShowBusStops(e.target.checked)} className="accent-cyan-600" />
              대중교통
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input type="checkbox" checked={showCommerce} onChange={(e) => setShowCommerce(e.target.checked)} className="accent-green-600" />
              상권 밀집도
            </label>
          </>
        )}
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input type="checkbox" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)} className="accent-indigo-600" />
          주요시설
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input
            type="checkbox"
            checked={showDashboard}
            onChange={(e) => { setShowDashboard(e.target.checked); if (e.target.checked) setShowDistricts(true); else setSelectedDistrict(null); }}
            className="accent-amber-600"
          />
          종합 대시보드
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input
            type="checkbox"
            checked={showPinMemo}
            onChange={(e) => { setShowPinMemo(e.target.checked); if (!e.target.checked) setPinEditMode(false); }}
            className="accent-orange-600"
          />
          핀 메모{pinCount > 0 && showPinMemo ? ` (${pinCount})` : ""}
        </label>

        {showPinMemo && (
          <div className="mt-2 border-t pt-2">
            <button
              className={`text-xs px-2.5 py-1 rounded w-full ${
                pinEditMode
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick={() => {
                setPinEditMode(!pinEditMode);
                if (!pinEditMode) setCampaignEditMode(false);
              }}
            >
              {pinEditMode ? "지도 클릭하여 핀 추가 중..." : "핀 추가 모드"}
            </button>
            <p className="text-[10px] text-gray-400 mt-1">
              {pinEditMode ? "지도를 클릭하면 핀이 추가됩니다" : "기존 핀을 클릭하면 수정할 수 있습니다"}
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input
            type="checkbox"
            checked={showCampaign}
            onChange={(e) => { setShowCampaign(e.target.checked); if (!e.target.checked) setCampaignEditMode(false); }}
            className="accent-emerald-600"
          />
          선거운동 기록{campaignCount > 0 && showCampaign ? ` (${campaignCount})` : ""}
        </label>

        {showCampaign && (
          <div className="mt-2 border-t pt-2">
            <button
              className={`text-xs px-2.5 py-1 rounded w-full ${
                campaignEditMode
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              onClick={() => {
                setCampaignEditMode(!campaignEditMode);
                if (!campaignEditMode) setPinEditMode(false);
              }}
            >
              {campaignEditMode ? "지도 클릭하여 기록 추가 중..." : "기록 추가 모드"}
            </button>
            <div className="flex gap-1 mt-1.5">
              {(["planned", "done", "skipped"] as const).map((s) => {
                const labels = { planned: "예정", done: "완료", skipped: "건너뜀" };
                const colors = { planned: "blue", done: "emerald", skipped: "gray" };
                const isOn = campaignFilter.has(s);
                return (
                  <button
                    key={s}
                    className={`flex-1 text-[10px] py-0.5 rounded ${
                      isOn ? `bg-${colors[s]}-100 text-${colors[s]}-700` : "bg-gray-50 text-gray-400"
                    }`}
                    style={{
                      background: isOn ? (s === "planned" ? "#DBEAFE" : s === "done" ? "#D1FAE5" : "#F3F4F6") : "#FAFAFA",
                      color: isOn ? (s === "planned" ? "#1D4ED8" : s === "done" ? "#047857" : "#6B7280") : "#D1D5DB",
                    }}
                    onClick={() => {
                      setCampaignFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      });
                    }}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {campaignEditMode ? "지도를 클릭하면 기록이 추가됩니다" : "기존 기록을 클릭하면 수정할 수 있습니다"}
            </p>
          </div>
        )}

        {showFacilities && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">시설 종류 (줌 13+ 표시)</p>
            {FACILITY_GROUPS.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">{group.label}</p>
                <div className="flex flex-wrap gap-0.5">
                  {group.categories.map((cat) => (
                    <button
                      key={cat}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        facilityCategories.has(cat) ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                      onClick={() => {
                        setFacilityCategories((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat)) next.delete(cat); else next.add(cat);
                          return next;
                        });
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedCity && showPopulation && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">인구수 (2025.01)</p>
            {POP_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {isJinju && showCommerce && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">상가 수</p>
            {COMMERCE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {isJinju && showBusStops && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">요일</p>
            <div className="flex gap-0.5 flex-wrap mb-2">
              {DOW_OPTIONS.map((dow) => (
                <button
                  key={dow}
                  className={`text-xs px-1.5 py-0.5 rounded ${transitDow === dow ? "bg-cyan-700 text-white" : "bg-gray-100 text-gray-500"}`}
                  onClick={() => setTransitDow(dow)}
                >
                  {DOW_SHORT[dow]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-1">시간대</p>
            <div className="flex gap-0.5 flex-wrap mb-2">
              <button
                className={`text-xs px-1.5 py-0.5 rounded ${transitHour === "전체" ? "bg-cyan-700 text-white" : "bg-gray-100 text-gray-500"}`}
                onClick={() => setTransitHour("전체")}
              >전체</button>
              {HOUR_OPTIONS.filter((h) => h !== "전체").map((h) => (
                <button
                  key={h}
                  className={`text-xs px-1.5 py-0.5 rounded ${transitHour === h ? "bg-cyan-700 text-white" : "bg-gray-100 text-gray-500"}`}
                  onClick={() => setTransitHour(h)}
                >
                  {parseInt(h)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-1">승하차량</p>
            {HEATMAP_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {selectedCity && showDistricts && (
          <div className="mt-2 border-t pt-2">
            <div className="flex gap-1 mb-1 flex-wrap">
              {([
                ["assembly", "총선"],
                ["mayor", "시장"],
                ["provincial", "도의원"],
                ["local", "기초의원"],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  className={`text-xs px-2 py-0.5 rounded ${electionType === type ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
                  onClick={() => { setElectionType(type); setSelectedDistrict(null); }}
                >
                  {label}
                </button>
              ))}
            </div>
            {currentDistricts.map((d: any) => (
              <button
                key={d.name}
                className={`flex items-center gap-1.5 text-xs w-full text-left px-1.5 py-0.5 rounded ${
                  selectedDistrict === d.name ? "bg-gray-100 font-bold" : "text-gray-600"
                }`}
                onClick={() => {
                  setSelectedDong(null);
                  setSelectedDistrict(selectedDistrict === d.name ? null : d.name);
                }}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                {d.name.replace(selectedCity.name, "")}
              </button>
            ))}
          </div>
        )}
        </div>}
      </div>

      {/* 패널들 */}
      {selectedCity && showPopulation && selectedDong && (
        <PopulationPanel data={selectedDong} onClose={() => setSelectedDong(null)} />
      )}
      {selectedCity && selectedDistrict && showDistricts && !showDashboard && (
        <ElectionPanel
          dongName={selectedDistrict}
          clickedDong={clickedDongName}
          onClose={() => setSelectedDistrict(null)}
          electionsData={electionsData}
          localElectionsData={localElectionsData}
          cityName={selectedCity.name}
        />
      )}
      {selectedCity && selectedDistrict && showDashboard && (
        <DistrictDashboard
          districtName={selectedDistrict}
          electionType={electionType}
          onClose={() => setSelectedDistrict(null)}
          electionsData={electionsData}
          localElectionsData={localElectionsData}
          cityName={selectedCity.name}
          cityCode={selectedCity.code}
          isJinju={isJinju}
        />
      )}
      {isJinju && showBusStops && selectedBusStop && (
        <TransitUsagePanel station={selectedBusStop} onClose={() => setSelectedBusStop(null)} />
      )}

      {/* 장소 정보 패널 */}
      {(placeInfo || placeLoading) && (
        <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-lg shadow-lg max-w-sm w-80">
          <div className="flex items-center justify-between p-3 pb-0">
            <h4 className="text-sm font-bold text-gray-700">장소 정보</h4>
            <button
              onClick={() => { setPlaceInfo(null); setPlaceLoading(false); }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >&times;</button>
          </div>
          {placeLoading ? (
            <div className="p-3 text-xs text-gray-400">조회 중...</div>
          ) : placeInfo && (
            <div className="p-3 pt-2">
              {placeInfo.address && (
                <p className="text-xs text-gray-600 mb-1">{placeInfo.address}</p>
              )}
              {placeInfo.region && placeInfo.region !== placeInfo.address && (
                <p className="text-[10px] text-gray-400 mb-2">{placeInfo.region}</p>
              )}
              {placeInfo.places?.length > 0 && (
                <div className="border-t pt-2 space-y-1.5">
                  <p className="text-[10px] text-gray-400">주변 장소</p>
                  {placeInfo.places.map((p: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[10px] text-gray-300 mt-0.5 shrink-0">{p.distance}</span>
                      <div className="min-w-0">
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-medium block truncate"
                          >{p.name}</a>
                        ) : (
                          <span className="text-xs text-gray-700 font-medium block truncate">{p.name}</span>
                        )}
                        {p.category && <span className="text-[10px] text-gray-400">{p.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {(!placeInfo.places || placeInfo.places.length === 0) && !placeInfo.address && (
                <p className="text-xs text-gray-400">이 위치에 대한 정보가 없습니다</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
