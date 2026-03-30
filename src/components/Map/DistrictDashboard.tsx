"use client";

import { useState, useMemo } from "react";
import { getDistrictInfo } from "@/lib/dong-mapping";
import {
  aggregatePopulation,
  aggregateTransit,
  aggregateCommerce,
  type TransitStation,
  type DistrictPopulationSummary,
  type DistrictTransitSummary,
  type DistrictCommerceSummary,
} from "@/lib/district-aggregator";
import jinjuDistricts from "@/data/jinju-districts.json";
import jinjuAgePopulation from "@/data/jinju-age-population.json";
import jinjuCommerceDensity from "@/data/jinju-commerce-density.json";
import jinjuTransitUsage from "@/data/jinju-transit-usage.json";
import ElectionPanel from "./ElectionPanel";

// ── 타입 ──

interface DistrictDashboardProps {
  districtName: string;
  electionType: string;
  onClose: () => void;
  electionsData: any[];
  localElectionsData: any[];
  cityName: string;
  cityCode: string;
  isJinju: boolean;
}

type TabKey = "population" | "transit" | "commerce" | "election";

// ── 컴포넌트 ──

export default function DistrictDashboard({
  districtName,
  electionType,
  onClose,
  electionsData,
  localElectionsData,
  cityName,
  cityCode,
  isJinju,
}: DistrictDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("population");

  // 선거구 정보
  const districtInfo = useMemo(
    () => getDistrictInfo(districtName, jinjuDistricts, electionType),
    [districtName, electionType],
  );

  const dongs = districtInfo?.dongs || [];

  // 데이터 집계
  const popSummary = useMemo(
    () => aggregatePopulation(dongs, jinjuAgePopulation as any),
    [dongs],
  );

  const transitSummary = useMemo(
    () => isJinju ? aggregateTransit(dongs, jinjuTransitUsage as TransitStation[], cityCode) : null,
    [dongs, isJinju, cityCode],
  );

  const commerceSummary = useMemo(
    () => isJinju ? aggregateCommerce(dongs, jinjuCommerceDensity as Record<string, number>) : null,
    [dongs, isJinju],
  );

  // 탭 목록 (진주가 아니면 교통/상권 숨김)
  const tabs: { key: TabKey; label: string }[] = [
    { key: "population", label: "인구" },
    ...(transitSummary ? [{ key: "transit" as TabKey, label: "교통" }] : []),
    ...(commerceSummary ? [{ key: "commerce" as TabKey, label: "상권" }] : []),
    { key: "election", label: "선거" },
  ];

  // 선거구 이름에서 도시명 제거 (표시용)
  const shortName = districtName.replace(cityName, "");

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg border max-w-[420px] w-[420px] max-h-[calc(100vh-120px)] flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">{shortName}</h3>
            {districtInfo && (
              <p className="text-xs text-gray-500 mt-0.5">
                {districtInfo.description} &middot; {districtInfo.seats}석
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* 소속 행정동 태그 */}
        <div className="flex flex-wrap gap-1 mt-2">
          {dongs.map((d) => (
            <span key={d} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`flex-1 text-sm py-2 ${
              activeTab === tab.key
                ? "border-b-2 border-gray-800 font-bold text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="overflow-y-auto flex-1 p-4">
        {activeTab === "population" && <PopulationSection data={popSummary} />}
        {activeTab === "transit" && transitSummary && <TransitSection data={transitSummary} />}
        {activeTab === "commerce" && commerceSummary && <CommerceSection data={commerceSummary} />}
        {activeTab === "election" && (
          <ElectionSection
            districtName={districtName}
            electionsData={electionsData}
            localElectionsData={localElectionsData}
            cityName={cityName}
          />
        )}
      </div>
    </div>
  );
}

// ── 인구 섹션 ──

function PopulationSection({ data }: { data: DistrictPopulationSummary }) {
  const maleRatio = data.totalPopulation > 0 ? (data.totalMale / data.totalPopulation * 100) : 50;
  const maxPop = Math.max(...data.byDong.map((d) => d.population), 1);
  const maxAge = Math.max(
    ...data.ageGroups.flatMap((g) => [g.male, g.female]),
    1,
  );

  return (
    <div className="space-y-4">
      {/* 총 인구 */}
      <div className="text-center">
        <div className="text-2xl font-bold">{data.totalPopulation.toLocaleString()}<span className="text-sm font-normal text-gray-500 ml-1">명</span></div>
        <div className="flex items-center gap-2 mt-1 justify-center text-xs text-gray-500">
          <span>남 {data.totalMale.toLocaleString()}</span>
          <span>&middot;</span>
          <span>여 {data.totalFemale.toLocaleString()}</span>
        </div>
        {/* 성비 바 */}
        <div className="w-full h-2 bg-pink-200 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-blue-400 rounded-l-full" style={{ width: `${maleRatio}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>남 {maleRatio.toFixed(1)}%</span>
          <span>여 {(100 - maleRatio).toFixed(1)}%</span>
        </div>
      </div>

      {/* 인구 피라미드 */}
      <div>
        <h4 className="text-xs font-bold text-gray-600 mb-2">연령대별 분포</h4>
        <div className="space-y-1">
          {[...data.ageGroups].reverse().map((g) => (
            <div key={g.label} className="flex items-center gap-1 text-[10px]">
              <div className="flex-1 flex justify-end">
                <div
                  className="h-3 bg-blue-400 rounded-l"
                  style={{ width: `${(g.male / maxAge) * 100}%`, minWidth: g.male > 0 ? 2 : 0 }}
                />
              </div>
              <span className="w-12 text-center text-gray-500 flex-shrink-0">{g.label}</span>
              <div className="flex-1">
                <div
                  className="h-3 bg-pink-400 rounded-r"
                  style={{ width: `${(g.female / maxAge) * 100}%`, minWidth: g.female > 0 ? 2 : 0 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 동별 인구 */}
      <div>
        <h4 className="text-xs font-bold text-gray-600 mb-2">행정동별 인구</h4>
        <div className="space-y-1">
          {data.byDong.map((d) => (
            <div key={d.dong} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-gray-600 truncate flex-shrink-0">{d.dong}</span>
              <div className="flex-1 bg-gray-100 rounded overflow-hidden h-4">
                <div
                  className="h-full bg-blue-500 rounded"
                  style={{ width: `${(d.population / maxPop) * 100}%` }}
                />
              </div>
              <span className="w-14 text-right text-gray-500 flex-shrink-0">
                {d.population.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 교통 섹션 ──

function TransitSection({ data }: { data: DistrictTransitSummary }) {
  const hours = Object.keys(data.hourly).sort();
  const maxHourly = Math.max(
    ...Object.values(data.hourly).map((v) => v.ride + v.goff),
    1,
  );

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="text-lg font-bold text-blue-700">{data.totalRide.toLocaleString()}</div>
          <div className="text-[10px] text-blue-500">총 승차</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-2">
          <div className="text-lg font-bold text-orange-700">{data.totalGoff.toLocaleString()}</div>
          <div className="text-[10px] text-orange-500">총 하차</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-lg font-bold text-gray-700">{data.stationCount}</div>
          <div className="text-[10px] text-gray-500">정류장 수</div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400">* 하차 태깅률이 낮아 승차 데이터 위주로 판단 권장 (2024.06 기준)</p>

      {/* 시간대별 바 차트 */}
      <div>
        <h4 className="text-xs font-bold text-gray-600 mb-2">시간대별 승하차</h4>
        <div className="flex items-end gap-[2px] h-24">
          {hours.map((h) => {
            const v = data.hourly[h];
            const total = v.ride + v.goff;
            const heightPct = (total / maxHourly) * 100;
            const rideRatio = total > 0 ? v.ride / total : 0.5;
            return (
              <div
                key={h}
                className="flex-1 rounded-t overflow-hidden"
                style={{ height: `${heightPct}%` }}
              >
                <div className="w-full bg-blue-400" style={{ height: `${rideRatio * 100}%` }} />
                <div className="w-full bg-orange-400" style={{ height: `${(1 - rideRatio) * 100}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-[2px] mt-0.5">
          {hours.map((h) => (
            <div key={h} className="flex-1 text-[8px] text-gray-400 text-center">{h}</div>
          ))}
        </div>
        <div className="flex gap-3 mt-1 justify-center">
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 bg-blue-400 rounded-sm inline-block" /> 승차
          </span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 bg-orange-400 rounded-sm inline-block" /> 하차
          </span>
        </div>
      </div>

      {/* 이용량 상위 정류장 */}
      {data.topStations.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-600 mb-2">이용량 상위 정류장</h4>
          <div className="space-y-1">
            {data.topStations.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-4 text-gray-400 font-bold">{i + 1}</span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-gray-400 text-[10px]">{s.dong}</span>
                <span className="text-gray-600 font-medium">{s.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 상권 섹션 ──

function CommerceSection({ data }: { data: DistrictCommerceSummary }) {
  const maxCount = Math.max(...data.byDong.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* 총 상가 수 */}
      <div className="text-center">
        <div className="text-2xl font-bold">{data.totalStores.toLocaleString()}<span className="text-sm font-normal text-gray-500 ml-1">개소</span></div>
        <div className="text-xs text-gray-400">등록 상가업소 수</div>
      </div>

      {/* 동별 상가 수 */}
      <div>
        <h4 className="text-xs font-bold text-gray-600 mb-2">행정동별 상가 수</h4>
        <div className="space-y-1">
          {data.byDong.map((d) => (
            <div key={d.dong} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-gray-600 truncate flex-shrink-0">{d.dong}</span>
              <div className="flex-1 bg-gray-100 rounded overflow-hidden h-4">
                <div
                  className="h-full bg-emerald-500 rounded"
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-12 text-right text-gray-500 flex-shrink-0">
                {d.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 선거 섹션 (기존 ElectionPanel 임베드) ──

function ElectionSection({
  districtName,
  electionsData,
  localElectionsData,
  cityName,
}: {
  districtName: string;
  electionsData: any[];
  localElectionsData: any[];
  cityName: string;
}) {
  return (
    <div className="-m-4">
      <ElectionPanel
        dongName={districtName}
        onClose={() => {}}
        electionsData={electionsData}
        localElectionsData={localElectionsData}
        cityName={cityName}
        embedded
      />
    </div>
  );
}
