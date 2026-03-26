"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import { useMemo } from "react";
import jinjuTransitUsage from "@/data/jinju-transit-usage.json";

type HourData = { ride: number; goff: number };
type StationUsage = {
  sttn_id: string;
  name: string;
  dong: string;
  totalRide: number;
  totalGoff: number;
  lat?: number;
  lng?: number;
  hourly: Record<string, HourData>;
  byDow: Record<string, Record<string, HourData>>;
};

const DOW_KEYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];

function getHeatColor(intensity: number): string {
  if (intensity >= 0.8) return "#DC2626";
  if (intensity >= 0.6) return "#EA580C";
  if (intensity >= 0.4) return "#F59E0B";
  if (intensity >= 0.2) return "#84CC16";
  return "#22D3EE";
}

function getRadius(intensity: number): number {
  return 4 + intensity * 16;
}

interface TransitHeatmapLayerProps {
  selectedDow: string; // "전체" | "월요일" | ...
  selectedHour: string; // "전체" | "05" | "06" | ...
  onStationClick?: (station: StationUsage) => void;
}

export const HOURS = Array.from({ length: 19 }, (_, i) =>
  String(i + 5).padStart(2, "0")
);

export const DOW_OPTIONS = ["전체", ...DOW_KEYS];
export const DOW_SHORT: Record<string, string> = {
  전체: "전체",
  월요일: "월",
  화요일: "화",
  수요일: "수",
  목요일: "목",
  금요일: "금",
  토요일: "토",
  일요일: "일",
};

export const HOUR_OPTIONS = ["전체", ...HOURS];

export const HEATMAP_LEGEND = [
  { label: "매우 많음", color: "#DC2626" },
  { label: "많음", color: "#EA580C" },
  { label: "보통", color: "#F59E0B" },
  { label: "적음", color: "#84CC16" },
  { label: "매우 적음", color: "#22D3EE" },
];

export default function TransitHeatmapLayer({
  selectedDow,
  selectedHour,
  onStationClick,
}: TransitHeatmapLayerProps) {
  const stations = jinjuTransitUsage as StationUsage[];

  const { stationValues, maxVal } = useMemo(() => {
    const values: { station: StationUsage; value: number }[] = [];
    let max = 0;

    for (const s of stations) {
      if (!s.lat || !s.lng) continue;

      let val = 0;

      if (selectedDow === "전체" && selectedHour === "전체") {
        val = s.totalRide + s.totalGoff;
      } else if (selectedDow === "전체" && selectedHour !== "전체") {
        const h = s.hourly[selectedHour];
        val = h ? h.ride + h.goff : 0;
      } else if (selectedDow !== "전체" && selectedHour === "전체") {
        const dowData = s.byDow[selectedDow];
        if (dowData) {
          val = Object.values(dowData).reduce(
            (sum, d) => sum + d.ride + d.goff,
            0
          );
        }
      } else {
        const dowData = s.byDow[selectedDow];
        if (dowData && dowData[selectedHour]) {
          val = dowData[selectedHour].ride + dowData[selectedHour].goff;
        }
      }

      if (val > 0) {
        values.push({ station: s, value: val });
        if (val > max) max = val;
      }
    }

    return { stationValues: values, maxVal: max };
  }, [stations, selectedDow, selectedHour]);

  return (
    <>
      {stationValues.map(({ station, value }) => {
        const intensity = maxVal > 0 ? value / maxVal : 0;
        const color = getHeatColor(intensity);
        const radius = getRadius(intensity);
        return (
          <CircleMarker
            key={station.sttn_id}
            center={[station.lat!, station.lng!]}
            radius={radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.5 + intensity * 0.3,
              weight: 0.5,
            }}
            eventHandlers={{
              click: () => onStationClick?.(station),
            }}
          >
            <Tooltip>
              <strong>{station.name || station.sttn_id}</strong>
              <br />
              <span style={{ fontSize: "11px", color: "#666" }}>
                {station.dong && `${station.dong} · `}
                승하차 {value.toLocaleString()}명
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
