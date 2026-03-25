"use client";

import { useState } from "react";
import {
  MapContainer as LeafletMap,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import { DEFAULT_CITY } from "@/config/cities";
import adminBoundary from "@/data/jinju-boundary.json";
import legalBoundary from "@/data/jinju-legal-boundary.json";
import pollingStations from "@/data/jinju-polling-stations.json";
import busStops from "@/data/jinju-bus-stops.json";
import electionResults from "@/data/jinju-election-results.json";
import districtData from "@/data/jinju-districts.json";
import PopulationPanel from "./PopulationPanel";
import ElectionPanel from "./ElectionPanel";
import TransitUsagePanel from "./TransitUsagePanel";
import TransitLayer, { TRANSIT_LEGEND } from "./TransitLayer";
import CommerceLayer, { COMMERCE_LEGEND } from "./CommerceLayer";
import transitUsageData from "@/data/jinju-transit-usage.json";
import type { Layer, PathOptions } from "leaflet";

// 정류장 ID로 이용량 데이터 검색 (48 + 우리ID = API sttn_id)
const usageById: Record<string, any> = {};
(transitUsageData as any[]).forEach((s) => {
  usageById[s.sttn_id] = s;
});

// 선거구별 색상
const DISTRICT_COLORS = [
  "#2563EB", "#DC2626", "#16A34A", "#CA8A04",
  "#9333EA", "#EA580C", "#0891B2", "#BE185D",
];

function buildDongMapping(electionType: string) {
  const mapping: Record<string, { name: string; color: string }> = {};
  const districts = (districtData as any).types[electionType].districts;
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

export default function MapContainer() {
  const city = DEFAULT_CITY;
  const [showAdmin, setShowAdmin] = useState(true);
  const [showLegal, setShowLegal] = useState(false);
  const [showPopulation, setShowPopulation] = useState(false);
  const [showPolling, setShowPolling] = useState(false);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showTransit, setShowTransit] = useState(false);
  const [showCommerce, setShowCommerce] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [electionType, setElectionType] = useState<"local" | "provincial" | "mayor">("local");
  const [selectedDong, setSelectedDong] = useState<SelectedDong>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedBusStop, setSelectedBusStop] = useState<any>(null);

  const dongToDistrict = buildDongMapping(electionType);
  const currentDistricts = (districtData as any).types[electionType].districts;

  function districtStyle(feature: any): PathOptions {
    const name = feature?.properties?.name;
    const info = dongToDistrict[name];
    const isSelected = selectedDistrict && info?.name === selectedDistrict;
    return {
      color: info?.color || "#999",
      weight: isSelected ? 3 : 2,
      fillColor: info?.color || "#999",
      fillOpacity: isSelected ? 0.4 : 0.2,
    };
  }

  function onDistrictFeature(feature: any, layer: Layer) {
    const name = feature?.properties?.name;
    const info = dongToDistrict[name];
    if (info) {
      layer.bindTooltip(`<strong>${name}</strong><br/>${info.name}`, {
        direction: "center",
      });
      layer.on("click", () => {
        setSelectedDong(null);
        setSelectedDistrict(name); // 동 이름을 전달 (선거구 이름 대신)
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
    const name = feature.properties?.name || feature.properties?.fullName;
    if (name) {
      layer.bindTooltip(name, { permanent: false, direction: "center" });
    }
  }

  // Group polling stations by district for the selector
  const districts = (electionResults as any[]).map((r) => r.district);

  return (
    <div className="relative h-screen w-full">
      <LeafletMap
        center={city.center}
        zoom={city.zoom}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {showAdmin && !showPopulation && (
          <GeoJSON
            key="admin"
            data={adminBoundary as any}
            style={adminStyle}
            onEachFeature={onBoundaryFeature}
          />
        )}
        {showPopulation && (
          <GeoJSON
            key="population"
            data={adminBoundary as any}
            style={populationStyle}
            onEachFeature={onPopulationFeature}
          />
        )}
        {showLegal && (
          <GeoJSON
            key="legal"
            data={legalBoundary as any}
            style={legalStyle}
            onEachFeature={onBoundaryFeature}
          />
        )}
        {showDistricts && (
          <GeoJSON
            key={`districts-${electionType}-${selectedDistrict || 'all'}`}
            data={adminBoundary as any}
            style={districtStyle}
            onEachFeature={onDistrictFeature}
          />
        )}
        {showPolling &&
          (pollingStations as any[]).map((st, i) => (
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
        {showCommerce && (
          <CommerceLayer boundaryData={adminBoundary} />
        )}
        {showTransit && (
          <TransitLayer boundaryData={adminBoundary} />
        )}
        {showBusStops && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
          >
            {(busStops as any[]).map((st, i) => {
              const apiId = `48${String(st.id).padStart(5, "0")}`;
              const usage = usageById[apiId];
              const hasUsage = !!usage;
              return (
                <CircleMarker
                  key={`bus-${i}`}
                  center={[st.lat, st.lng]}
                  radius={hasUsage ? 5 : 4}
                  pathOptions={{
                    color: hasUsage ? "#1D4ED8" : "#0E7490",
                    fillColor: hasUsage ? "#3B82F6" : "#06B6D4",
                    fillOpacity: 0.7,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      const data = usage || { sttn_id: apiId, name: st.name, dong: "", totalRide: 0, totalGoff: 0, hourly: {}, byDow: {} };
                      if (usage) data.name = st.name; // 정류장명 보충
                      setSelectedBusStop(data);
                      setSelectedDong(null);
                      setSelectedDistrict(null);
                    },
                  }}
                >
                  <Tooltip>
                    <strong>{st.name}</strong>
                    <br />
                    <span style={{ fontSize: "11px", color: "#666" }}>
                      ID: {st.id}
                      {usage ? ` · 승차 ${usage.totalRide.toLocaleString()}` : ""}
                    </span>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MarkerClusterGroup>
        )}
      </LeafletMap>

      {/* Layer toggle panel */}
      <div className="absolute top-4 right-4 z-[1000] rounded-lg bg-white p-3 shadow-lg">
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
          인구 밀도
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
          투표소 (86개)
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input
            type="checkbox"
            checked={showBusStops}
            onChange={(e) => setShowBusStops(e.target.checked)}
            className="accent-cyan-600"
          />
          버스정류장 (1,962개)
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 mt-1">
          <input
            type="checkbox"
            checked={showTransit}
            onChange={(e) => setShowTransit(e.target.checked)}
            className="accent-sky-600"
          />
          교통 밀집도
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

        {showPopulation && (
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

        {showCommerce && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">상가 수 (19,076개)</p>
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

        {showTransit && (
          <div className="mt-2 border-t pt-2">
            <p className="text-xs text-gray-500 mb-1">정류장 수 (stcis)</p>
            {TRANSIT_LEGEND.map((item) => (
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

        {/* 선거구 선택 */}
        {showDistricts && (
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

      {/* Population detail panel */}
      {showPopulation && selectedDong && (
        <PopulationPanel
          data={selectedDong}
          onClose={() => setSelectedDong(null)}
        />
      )}

      {/* Election result panel */}
      {showDistricts && selectedDistrict && (
        <ElectionPanel
          dongName={selectedDistrict}
          onClose={() => setSelectedDistrict(null)}
        />
      )}

      {/* Transit usage panel */}
      {showBusStops && selectedBusStop && (
        <TransitUsagePanel
          station={selectedBusStop}
          onClose={() => setSelectedBusStop(null)}
        />
      )}
    </div>
  );
}
