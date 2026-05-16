"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { JINJU } from "@/config/cities/jinju";
import jinjuDistricts from "@/data/jinju-districts.json";
import jinjuAgePopulation from "@/data/jinju-age-population.json";
import jinjuTransitUsage from "@/data/jinju-transit-usage.json";
import jinjuSeniorCenters from "@/data/jinju-senior-centers.json";
import { buildAllBriefings, type DistrictBriefing } from "@/lib/district-recommender";

const ELECTION_TYPES = [
  { key: "local", label: "기초의원" },
  { key: "provincial", label: "도의원" },
  { key: "assembly", label: "국회의원" },
  { key: "mayor", label: "시장" },
] as const;

const CARD_COLORS = [
  "from-blue-500 to-blue-600",
  "from-red-500 to-red-600",
  "from-emerald-500 to-emerald-600",
  "from-amber-500 to-amber-600",
  "from-purple-500 to-purple-600",
  "from-orange-500 to-orange-600",
  "from-cyan-500 to-cyan-600",
  "from-pink-500 to-pink-600",
];

export default function Home() {
  const [electionType, setElectionType] = useState<string>("local");

  const briefings = useMemo(
    () =>
      buildAllBriefings(
        jinjuDistricts,
        electionType,
        jinjuAgePopulation as any,
        jinjuTransitUsage as any,
        jinjuSeniorCenters as any,
        JINJU.code,
        JINJU.name,
      ),
    [electionType],
  );

  // 전체 요약
  const totalPop = briefings.reduce((s, b) => s + b.population, 0);
  const totalRide = briefings.reduce((s, b) => s + b.dailyRide, 0);
  const totalCenters = briefings.reduce((s, b) => s + b.seniorCenterCount, 0);

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {JINJU.name} 선거구 브리핑
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                인구 {totalPop.toLocaleString()}명 · 일평균 승차 {totalRide.toLocaleString()}명 · 경로당 {totalCenters}개
              </p>
            </div>
            <Link
              href="/map"
              className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
            >
              지도 분석
            </Link>
          </div>

          {/* 선거 유형 탭 */}
          <div className="flex gap-1 mt-3">
            {ELECTION_TYPES.map(({ key, label }) => (
              <button
                key={key}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  electionType === key
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
                onClick={() => setElectionType(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 카드 그리드 */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {briefings.map((b, i) => (
            <DistrictCard key={b.name} briefing={b} colorIdx={i} electionType={electionType} />
          ))}
        </div>
      </div>
    </main>
  );
}

function DistrictCard({
  briefing: b,
  colorIdx,
  electionType,
}: {
  briefing: DistrictBriefing;
  colorIdx: number;
  electionType: string;
}) {
  const topSpot = b.morningSpots[0] || b.daytimeSpots[0] || b.eveningSpots[0];
  const topSenior = b.seniorSpots[0];
  const color = CARD_COLORS[colorIdx % CARD_COLORS.length];

  return (
    <Link
      href={`/district/${encodeURIComponent(b.name)}?type=${electionType}`}
      className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden"
    >
      {/* 상단 색상 바 */}
      <div className={`bg-gradient-to-r ${color} px-4 py-3`}>
        <h2 className="text-lg font-bold text-white">{b.shortName}</h2>
        <p className="text-xs text-white/80 mt-0.5">{b.description}</p>
      </div>

      {/* 핵심 수치 */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="인구" value={b.population.toLocaleString()} unit="명" />
          <Stat
            label="65세+"
            value={`${(b.seniorRatio * 100).toFixed(0)}%`}
            sub={`${b.seniorCount.toLocaleString()}명`}
          />
          <Stat label="정류장" value={String(b.stationCount)} unit="개" />
          <Stat label="경로당" value={String(b.seniorCenterCount)} unit="개" sub={`회원 ${b.totalSeniorMembers}명`} />
        </div>

        {/* 빠른 인사이트 */}
        <div className="mt-3 pt-3 border-t space-y-1.5">
          {topSpot && (
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0 w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">B</span>
              <span className="text-gray-600">
                <span className="font-medium text-gray-800">{topSpot.name}</span>
                {" "}{topSpot.reason}
              </span>
            </div>
          )}
          {topSenior && (
            <div className="flex items-start gap-2 text-xs">
              <span className="shrink-0 w-5 h-5 rounded bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-bold">S</span>
              <span className="text-gray-600">
                <span className="font-medium text-gray-800">{topSenior.name}</span>
                {" "}경로당 {topSenior.reason}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 leading-tight">
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
