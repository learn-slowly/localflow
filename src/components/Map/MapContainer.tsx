"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapContainer as LeafletMap,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import { cities, DEFAULT_CITY, GYEONGNAM_VIEW } from "@/config/cities";
import type { CityConfig } from "@/config/cities";
// 진주 전용 데이터 (다른 도시 확장 시 동적 로딩으로 전환)
import jinjuBoundary from "@/data/jinju-boundary.json";
import jinjuLegalBoundary from "@/data/jinju-legal-boundary.json";
import jinjuPollingStations from "@/data/jinju-polling-stations.json";
import jinjuBusStops from "@/data/jinju-bus-stops.json";
import jinjuDistrictData from "@/data/jinju-districts.json";
import PopulationPanel from "./PopulationPanel";
import ElectionPanel from "./ElectionPanel";
import TransitUsagePanel from "./TransitUsagePanel";
import CommerceLayer, { COMMERCE_LEGEND } from "./CommerceLayer";
import TransitHeatmapLayer, {
  DOW_OPTIONS,
  DOW_SHORT,
  HOUR_OPTIONS,
  HEATMAP_LEGEND,
} from "./TransitHeatmapLayer";
import jinjuTransitUsage from "@/data/jinju-transit-usage.json";
import type { Layer, PathOptions } from "leaflet";

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

function buildDongMapping(electionType: string) {
  const mapping: Record<string, { name: string; color: string }> = {};
  const districts = (jinjuDistrictData as any).types[electionType]?.districts;
  if (!districts) return mapping;
  districts.forEach((d: any, i: number) => {
    d.dongs.forEach((dong: string) => {
      mapping[dong] = { name: d.name, color: DISTRICT_COLORS[i % DISTRICT_COLORS.length] };
    });
  });
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

function populationStyle(feature: any): PathOptions {
  const pop = feature?.properties?.population || 0;
  return {
    color: "#991B1B",
    weight: 1.5,
    fillColor: getPopulationColor(pop),
    fillOpacity: 0.6,
  };
}

const adminStyle: PathOptions = {
  color: "#2563EB",
  weight: 2,
  fillColor: "#3B82F6",
  fillOpacity: 0.1,
};

const legalStyle: PathOptions = {
  color: "#DC2626",
  weight: 2,
  fillColor: "#EF4444",
  fillOpacity: 0.1,
  dashArray: "5 5",
};

// 경남 전체 보기용 스타일: 시군구별 다른 색상
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
} | null;

// 지도 뷰 변경 컴포넌트
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevRef = useRef({ center, zoom });
  useEffect(() => {
    if (prevRef.current.center !== center || prevRef.current.zoom !== zoom) {
      map.flyTo(center, zoom, { duration: 1 });
      prevRef.current = { center, zoom };
    }
  }, [map, center, zoom]);
  return null;
}

// 시군구 코드 → 색상 인덱스 매핑
const sggColorMap: Record<string, string> = {};
Object.values(cities).forEach((city, i) => {
  sggColorMap[city.code] = SGG_COLORS[i % SGG_COLORS.length];
});

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
  const [electionType, setElectionType] = useState<"local" | "provincial" | "mayor">("local");
  const [selectedDong, setSelectedDong] = useState<SelectedDong>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedBusStop, setSelectedBusStop] = useState<any>(null);
  const [transitDow, setTransitDow] = useState("전체");
  const [transitHour, setTransitHour] = useState("전체");

  // 경계 데이터 (API에서 동적 로딩)
  const [boundaryData, setBoundaryData] = useState<any>(null);
  const [boundaryLoading, setBoundaryLoading] = useState(true);

  // 도시 변경 시 패널·선택 초기화 + 경계 데이터 로딩
  useEffect(() => {
    setSelectedDong(null);
    setSelectedDistrict(null);
    setSelectedBusStop(null);
    setBoundaryLoading(true);
    fetchBoundaryData(selectedCity?.code).then((data) => {
      setBoundaryData(data);
      setBoundaryLoading(false);
    });
  }, [selectedCityKey]);

  // 지도 중심·줌
  const mapCenter = selectedCity ? selectedCity.center : GYEONGNAM_VIEW.center;
  const mapZoom = selectedCity ? selectedCity.zoom : GYEONGNAM_VIEW.zoom;

  // 진주 전용: 선거구 매핑
  const dongToDistrict = isJinju ? buildDongMapping(electionType) : {};
  const currentDistricts = isJinju
    ? (jinjuDistrictData as any).types[electionType]?.districts || []
    : [];

  // 경남 전체 보기 스타일
  function gyeongnamStyle(feature: any): PathOptions {
    const sgg = feature?.properties?.sgg;
    const color = sggColorMap[sgg] || "#999";
    return {
      color,
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.15,
    };
  }

  function onGyeongnamFeature(feature: any, layer: Layer) {
    const adm = feature?.properties?.adm_nm || "";
    const sggnm = feature?.properties?.sggnm || "";
    const dongName = adm.replace(`경상남도 ${sggnm} `, "");
    layer.bindTooltip(`<strong>${sggnm}</strong><br/>${dongName}`, {
      direction: "center",
    });
    // 클릭 시 해당 도시로 이동
    const sgg = feature?.properties?.sgg;
    layer.on("click", () => {
      const cityEntry = Object.entries(cities).find(([, c]) => c.code === sgg);
      if (cityEntry) {
        setSelectedCityKey(cityEntry[0]);
      }
    });
  }

  function districtStyle(feature: any): PathOptions {
    const name = feature?.properties?.name || feature?.properties?.adm_nm?.split(" ").pop();
    const info = dongToDistrict[name || ""];
    const isSelected = selectedDistrict && info?.name === selectedDistrict;
    return {
      color: info?.color || "#999",
      weight: isSelected ? 3 : 2,
      fillColor: info?.color || "#999",
      fillOpacity: isSelected ? 0.4 : 0.2,
    };
  }

  function onDistrictFeature(feature: any, layer: Layer) {
    const name = feature?.properties?.name || feature?.properties?.adm_nm?.split(" ").pop();
    const info = dongToDistrict[name || ""];
    if (info) {
      layer.bindTooltip(`<strong>${name}</strong><br/>${info.name}`, {
        direction: "center",
      });
      layer.on("click", () => {
        setSelectedDong(null);
        setSelectedDistrict(name || null);
      });
    }
  }

  function onPopulationFeature(feature: any, layer: Layer) {
    const p = feature.properties;
    if (!p) return;
    const pop = (p.population || 0).toLocaleString();
    layer.bindTooltip(`<strong>${p.name}</strong> ${pop}명`, {
      direction: "top",
    });
    layer.on("click", () => {
      setSelectedDistrict(null);
      setSelectedDong({
        name: p.name,
        population: p.population || 0,
        households: p.households || 0,
        male: p.male || 0,
        female: p.female || 0,
      });
    });
  }

  function onBoundaryFeature(feature: any, layer: Layer) {
    const name = feature.properties?.name || feature.properties?.adm_nm?.split(" ").pop();
    if (name) {
      layer.bindTooltip(name, { permanent: false, direction: "center" });
    }
  }

  // 도시 선택 옵션 (경남 전체 + 22개 시군구)
  const cityOptions = [
    { key: "", label: "경남 전체" },
    ...Object.entries(cities).map(([key, city]) => ({
      key,
      label: city.name,
    })),
  ];

  // 진주 전용 데이터가 있는 레이어인지 확인
  const hasDetailData = isJinju;

  return (
    <div className="relative h-screen w-full">
      <LeafletMap
        center={mapCenter}
        zoom={mapZoom}
        className="h-full w-full"
      >
        <MapViewUpdater center={mapCenter} zoom={mapZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* 경남 전체 보기 */}
        {!selectedCity && showAdmin && boundaryData && (
          <GeoJSON
            key="gyeongnam-all"
            data={boundaryData as any}
            style={gyeongnamStyle}
            onEachFeature={onGyeongnamFeature}
          />
        )}

        {/* 개별 도시: 행정동 경계 */}
        {selectedCity && showAdmin && !showPopulation && boundaryData && (
          <GeoJSON
            key={`admin-${selectedCity.code}`}
            data={boundaryData as any}
            style={adminStyle}
            onEachFeature={onBoundaryFeature}
          />
        )}

        {/* 진주 전용: 인구 밀도 (진주 경계에 population 포함) */}
        {isJinju && showPopulation && (
          <GeoJSON
            key="population"
            data={jinjuBoundary as any}
            style={populationStyle}
            onEachFeature={onPopulationFeature}
          />
        )}

        {/* 진주 전용: 법정동 경계 */}
        {isJinju && showLegal && (
          <GeoJSON
            key="legal"
            data={jinjuLegalBoundary as any}
            style={legalStyle}
            onEachFeature={onBoundaryFeature}
          />
        )}

        {/* 진주 전용: 선거구 */}
        {isJinju && showDistricts && (
          <GeoJSON
            key={`districts-${electionType}-${selectedDistrict || "all"}`}
            data={jinjuBoundary as any}
            style={districtStyle}
            onEachFeature={onDistrictFeature}
          />
        )}

        {/* 진주 전용: 투표소 */}
        {isJinju && showPolling &&
          (jinjuPollingStations as any[]).map((st, i) => (
            <CircleMarker
              key={i}
              center={[st.lat, st.lng]}
              radius={6}
              pathOptions={{
                color: "#7C3AED",
                fillColor: "#8B5CF6",
                fillOpacity: 0.8,
                weight: 1.5,
              }}
            >
              <Tooltip>
                <strong>{st.name}</strong>
                <br />
                {st.place}
                <br />
                <span style={{ fontSize: "11px", color: "#666" }}>
                  {st.addr}
                  {st.floor ? ` (${st.floor})` : ""}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}

        {/* 진주 전용: 상권/교통 밀집도 */}
        {isJinju && showCommerce && (
          <CommerceLayer boundaryData={jinjuBoundary} />
        )}

        {/* 진주 전용: 대중교통 히트맵 */}
        {isJinju && showBusStops && (
          <TransitHeatmapLayer
            selectedDow={transitDow}
            selectedHour={transitHour}
            onStationClick={(s) => {
              setSelectedBusStop(s);
              setSelectedDong(null);
              setSelectedDistrict(null);
            }}
          />
        )}
      </LeafletMap>

      {/* 도시 선택 + 레이어 패널 */}
      <div className="absolute top-4 right-4 z-[1000] rounded-lg bg-white p-3 shadow-lg max-h-[90vh] overflow-y-auto">
        {/* 도시 선택 */}
        <select
          value={selectedCityKey || ""}
          onChange={(e) => setSelectedCityKey(e.target.value || null)}
          className="w-full mb-2 text-sm border rounded px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {cityOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <h3 className="mb-2 text-sm font-bold text-gray-700">레이어</h3>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showAdmin}
            onChange={(e) => setShowAdmin(e.target.checked)}
            className="accent-blue-600"
          />
          행정동 경계
        </label>

        {/* 진주 전용 레이어 */}
        {hasDetailData && (
          <>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showLegal}
                onChange={(e) => setShowLegal(e.target.checked)}
                className="accent-red-600"
              />
              법정동 경계
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showPopulation}
                onChange={(e) => setShowPopulation(e.target.checked)}
                className="accent-rose-600"
              />
              인구정보
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showDistricts}
                onChange={(e) => setShowDistricts(e.target.checked)}
                className="accent-purple-600"
              />
              선거결과
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showPolling}
                onChange={(e) => setShowPolling(e.target.checked)}
                className="accent-violet-600"
              />
              투표소
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showBusStops}
                onChange={(e) => setShowBusStops(e.target.checked)}
                className="accent-cyan-600"
              />
              대중교통
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
              <input
                type="checkbox"
                checked={showCommerce}
                onChange={(e) => setShowCommerce(e.target.checked)}
                className="accent-green-600"
              />
              상권 밀집도
            </label>
          </>
        )}

        {/* 진주 전용이 아닌 경우 안내 */}
        {selectedCity && !hasDetailData && (
          <p className="mt-2 text-xs text-gray-400">
            상세 레이어는 진주시만 지원 (확장 예정)
          </p>
        )}

        {/* 범례 */}
        {hasDetailData && showPopulation && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">인구수 (2025.01)</p>
            {POP_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {hasDetailData && showCommerce && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">상가 수</p>
            {COMMERCE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {hasDetailData && showBusStops && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">요일</p>
            <div className="flex gap-0.5 flex-wrap mb-2">
              {DOW_OPTIONS.map((dow) => (
                <button
                  key={dow}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    transitDow === dow
                      ? "bg-cyan-700 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  onClick={() => setTransitDow(dow)}
                >
                  {DOW_SHORT[dow]}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 mb-1">시간대</p>
            <div className="flex gap-0.5 flex-wrap mb-2">
              <button
                className={`text-xs px-1.5 py-0.5 rounded ${
                  transitHour === "전체"
                    ? "bg-cyan-700 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
                onClick={() => setTransitHour("전체")}
              >
                전체
              </button>
              {HOUR_OPTIONS.filter((h) => h !== "전체").map((h) => (
                <button
                  key={h}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    transitHour === h
                      ? "bg-cyan-700 text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                  onClick={() => setTransitHour(h)}
                >
                  {parseInt(h)}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500 mb-1">승하차량</p>
            {HEATMAP_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </div>
            ))}
          </div>
        )}

        {/* 선거구 선택 (진주 전용) */}
        {hasDetailData && showDistricts && (
          <div className="mt-2 border-t pt-2">
            <div className="flex gap-1 mb-1 flex-wrap">
              {([
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
            {currentDistricts.map((d: any, i: number) => (
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
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: DISTRICT_COLORS[i % DISTRICT_COLORS.length] }}
                />
                {d.name.replace("진주시", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 패널들 (진주 전용) */}
      {isJinju && showPopulation && selectedDong && (
        <PopulationPanel
          data={selectedDong}
          onClose={() => setSelectedDong(null)}
        />
      )}
      {isJinju && showDistricts && selectedDistrict && (
        <ElectionPanel
          dongName={selectedDistrict}
          onClose={() => setSelectedDistrict(null)}
        />
      )}
      {isJinju && showBusStops && selectedBusStop && (
        <TransitUsagePanel
          station={selectedBusStop}
          onClose={() => setSelectedBusStop(null)}
        />
      )}
    </div>
  );
}
