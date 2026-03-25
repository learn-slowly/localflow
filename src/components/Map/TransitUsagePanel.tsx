"use client";

import { useState } from "react";

type HourData = { ride: number; goff: number };
type StationUsage = {
  sttn_id: string;
  name: string;
  dong: string;
  totalRide: number;
  totalGoff: number;
  hourly: Record<string, HourData>;
  byDow: Record<string, Record<string, HourData>>;
};

const DOW_ORDER = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
const DOW_SHORT: Record<string, string> = {
  "월요일": "월", "화요일": "화", "수요일": "수", "목요일": "목",
  "금요일": "금", "토요일": "토", "일요일": "일",
};
const HOURS = Array.from({ length: 19 }, (_, i) => String(i + 5).padStart(2, "0"));

function HourlyBar({ data, maxVal }: { data: Record<string, HourData>; maxVal: number }) {
  return (
    <div className="flex items-end gap-px h-20">
      {HOURS.map((h) => {
        const d = data[h];
        const ride = d?.ride || 0;
        const goff = d?.goff || 0;
        const total = ride + goff;
        const pct = maxVal > 0 ? (total / maxVal) * 100 : 0;
        return (
          <div key={h} className="flex-1 flex flex-col items-center group relative">
            <div className="w-full flex flex-col justify-end" style={{ height: "64px" }}>
              <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${(ride / maxVal) * 64}px` }} />
              <div className="w-full bg-orange-400" style={{ height: `${(goff / maxVal) * 64}px` }} />
            </div>
            <span className="text-[9px] text-gray-400 mt-0.5">{parseInt(h)}</span>
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              {parseInt(h)}시: 승{ride} 하{goff}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DowHeatmap({ byDow, maxVal }: { byDow: Record<string, Record<string, HourData>>; maxVal: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex">
        <div className="w-6" />
        {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
          <div key={h} className="flex-1 text-[8px] text-gray-400 text-center">{parseInt(h)}</div>
        ))}
      </div>
      {DOW_ORDER.map((dow) => {
        const hours = byDow[dow] || {};
        return (
          <div key={dow} className="flex items-center">
            <div className="w-6 text-[10px] text-gray-500 font-medium">{DOW_SHORT[dow]}</div>
            <div className="flex flex-1 gap-px">
              {HOURS.map((h) => {
                const d = hours[h];
                const total = (d?.ride || 0) + (d?.goff || 0);
                const intensity = maxVal > 0 ? Math.min(total / maxVal, 1) : 0;
                const bg = intensity > 0
                  ? `rgba(37, 99, 235, ${0.1 + intensity * 0.9})`
                  : "#f3f4f6";
                return (
                  <div
                    key={h}
                    className="flex-1 h-4 rounded-sm group relative"
                    style={{ backgroundColor: bg }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {DOW_SHORT[dow]} {parseInt(h)}시: 승{d?.ride || 0} 하{d?.goff || 0}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TransitUsagePanelProps {
  station: StationUsage | null;
  onClose: () => void;
}

export default function TransitUsagePanel({ station, onClose }: TransitUsagePanelProps) {
  const [view, setView] = useState<"hourly" | "heatmap">("hourly");

  if (!station) return null;

  // 시간대별 최대값 (바 차트 스케일용)
  const maxHourly = Math.max(
    ...Object.values(station.hourly).map((d) => d.ride + d.goff),
    1
  );

  // 히트맵 최대값
  const maxCell = Math.max(
    ...Object.values(station.byDow).flatMap((hours) =>
      Object.values(hours).map((d) => d.ride + d.goff)
    ),
    1
  );

  return (
    <div className="absolute bottom-4 left-4 z-[1000] w-[420px] rounded-lg bg-white p-4 shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-800">{station.name}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        {station.dong} · ID {station.sttn_id}
      </p>

      <div className="flex gap-3 mb-3 text-sm">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          승차 <strong>{station.totalRide.toLocaleString()}</strong>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-400" />
          하차 <strong>{station.totalGoff.toLocaleString()}</strong>
        </div>
        <span className="text-xs text-gray-400 ml-auto">2024.06 기준</span>
      </div>

      {/* 보기 전환 */}
      <div className="flex gap-1 mb-3">
        <button
          className={`text-xs px-2 py-1 rounded ${view === "hourly" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
          onClick={() => setView("hourly")}
        >
          시간대별
        </button>
        <button
          className={`text-xs px-2 py-1 rounded ${view === "heatmap" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500"}`}
          onClick={() => setView("heatmap")}
        >
          요일×시간 히트맵
        </button>
      </div>

      {view === "hourly" ? (
        <div>
          <p className="text-xs text-gray-500 mb-1">시간대별 승하차 (전체 합계)</p>
          <HourlyBar data={station.hourly} maxVal={maxHourly} />
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-1">요일 × 시간대 히트맵 (진할수록 이용량 많음)</p>
          <DowHeatmap byDow={station.byDow} maxVal={maxCell} />
        </div>
      )}
    </div>
  );
}
