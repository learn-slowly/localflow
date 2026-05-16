"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useSearchParams } from "next/navigation";
import { cities } from "@/config/cities";
import { JINJU } from "@/config/cities/jinju";
import type { GyeongnamDistricts, ElectionType } from "@/lib/district-mapping";
import jinjuAgePopulation from "@/data/jinju-age-population.json";
import jinjuSeniorCenters from "@/data/jinju-senior-centers.json";
import jinjuCommerceDensity from "@/data/jinju-commerce-density.json";
import {
  buildDistrictBriefing,
  type DistrictBriefing,
  type CampaignSpot,
} from "@/lib/district-recommender";
import {
  aggregatePopulation,
  aggregateCommerce,
  type DistrictPopulationSummary,
  type DistrictCommerceSummary,
} from "@/lib/district-aggregator";
import ElectionPanel from "@/components/Map/ElectionPanel";
import jinjuElections from "@/data/jinju-elections.json";
import jinjuLocalElections from "@/data/jinju-local-elections.json";

type TabKey = "overview" | "campaign" | "population" | "election";

export default function DistrictPage({
  params,
}: {
  params: Promise<{ city: string; id: string }>;
}) {
  const { city: cityKey, id } = use(params);

  // 도시 가드
  if (!cities[cityKey]) notFound();

  // 진주 외 도시는 선거구 데이터가 없음 → 안내 화면
  // 도시별로 hook 사용 여부가 달라지지 않도록 내부 컴포넌트로 분리하여 렌더링
  if (cityKey !== "jinju") {
    return <CityNotSupportedView cityKey={cityKey} />;
  }

  return <JinjuDistrictView id={id} cityKey={cityKey} />;
}

// ── 진주 외 도시 안내 화면 ──

function CityNotSupportedView({ cityKey }: { cityKey: string }) {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="text-center px-6">
        <h1 className="text-xl font-bold text-gray-800">선거구 데이터 준비 중</h1>
        <p className="text-sm text-gray-500 mt-2">
          {cities[cityKey].name}의 선거구 상세 정보는 아직 제공되지 않습니다.
        </p>
        <Link
          href={`/${cityKey}`}
          className="inline-block mt-4 text-sm text-blue-600 hover:underline"
        >
          {cities[cityKey].name} 메인으로 돌아가기
        </Link>
      </div>
    </main>
  );
}

// ── 진주 선거구 상세 화면 ──

function JinjuDistrictView({ id, cityKey }: { id: string; cityKey: string }) {
  const districtName = decodeURIComponent(id);
  const searchParams = useSearchParams();
  const electionType = searchParams.get("type") || "local";
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // 경남 선거구 매핑 (fetch)
  const [gyeongnamDistricts, setGyeongnamDistricts] =
    useState<GyeongnamDistricts | null>(null);

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

  const jinjuDistrictsData = gyeongnamDistricts?.jinju ?? null;

  // 선거구 찾기
  const districtDef = useMemo(() => {
    const typeConfig = jinjuDistrictsData?.types?.[electionType as ElectionType];
    if (!typeConfig?.districts) return null;
    return typeConfig.districts.find((d: any) => d.name === districtName) || null;
  }, [districtName, electionType, jinjuDistrictsData]);

  // 교통이용량 데이터 (5MB, dev 메모리 부담 회피 위해 fetch)
  const [transitData, setTransitData] = useState<unknown[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/jinju-transit-usage.json")
      .then((r) => r.json())
      .then((data: unknown[]) => {
        if (!cancelled) setTransitData(data);
      })
      .catch((e) => console.error("교통이용량 로드 실패:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  // 브리핑 생성
  const briefing = useMemo(() => {
    if (!districtDef || !transitData) return null;
    return buildDistrictBriefing(
      districtDef as any,
      jinjuAgePopulation as any,
      transitData as any,
      jinjuSeniorCenters as any,
      JINJU.code,
      JINJU.name,
    );
  }, [districtDef, transitData]);

  // 인구 피라미드 데이터
  const popSummary = useMemo(() => {
    if (!districtDef) return null;
    return aggregatePopulation(districtDef.dongs, jinjuAgePopulation as any);
  }, [districtDef]);

  // 상권 데이터
  const commerceSummary = useMemo(() => {
    if (!districtDef) return null;
    return aggregateCommerce(districtDef.dongs, jinjuCommerceDensity as Record<string, number>);
  }, [districtDef]);

  if (!briefing || !districtDef) {
    return (
      <main className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">선거구를 찾을 수 없습니다</p>
          <Link href={`/${cityKey}`} className="text-blue-600 hover:underline">돌아가기</Link>
        </div>
      </main>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "요약" },
    { key: "campaign", label: "유세 추천" },
    { key: "population", label: "인구" },
    { key: "election", label: "선거 이력" },
  ];

  return (
    <main className="min-h-dvh bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/${cityKey}`}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              &larr;
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{briefing.shortName}</h1>
              <p className="text-xs text-gray-500">{briefing.description} · {briefing.seats}석</p>
            </div>
            <Link
              href={`/${cityKey}`}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
            >
              지도
            </Link>
          </div>

          {/* 소속 동 */}
          <div className="flex flex-wrap gap-1 mt-2">
            {briefing.dongs.map((d) => (
              <span key={d} className="text-[11px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {d}
              </span>
            ))}
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mt-3 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`text-sm px-3 py-2 rounded-t-lg transition-colors ${
                  activeTab === tab.key
                    ? "bg-gray-50 text-gray-900 font-bold border border-b-0 border-gray-200"
                    : "text-gray-400 hover:text-gray-600"
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {activeTab === "overview" && <OverviewTab briefing={briefing} commerceSummary={commerceSummary} />}
        {activeTab === "campaign" && <CampaignTab briefing={briefing} />}
        {activeTab === "population" && popSummary && <PopulationTab data={popSummary} briefing={briefing} />}
        {activeTab === "election" && <ElectionTab districtName={districtName} />}
      </div>
    </main>
  );
}

// ── 요약 탭 ──

function OverviewTab({ briefing: b, commerceSummary }: { briefing: DistrictBriefing; commerceSummary: DistrictCommerceSummary | null }) {
  const maleRatio = b.population > 0 ? (b.male / b.population * 100) : 50;

  return (
    <div className="space-y-6">
      {/* 핵심 수치 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="총 인구" value={b.population.toLocaleString()} unit="명" />
        <StatCard label="65세 이상" value={`${(b.seniorRatio * 100).toFixed(1)}%`} sub={`${b.seniorCount.toLocaleString()}명`} accent />
        <StatCard label="20~30대" value={`${(b.youthRatio * 100).toFixed(1)}%`} />
        <StatCard label="정류장" value={String(b.stationCount)} unit="개" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="일평균 승차" value={b.dailyRide.toLocaleString()} unit="명" />
        <StatCard label="경로당" value={String(b.seniorCenterCount)} unit="개" sub={`회원 ${b.totalSeniorMembers}명`} />
        <StatCard label="남녀비" value={`${maleRatio.toFixed(0)}:${(100 - maleRatio).toFixed(0)}`} />
        {commerceSummary && <StatCard label="상가업소" value={commerceSummary.totalStores.toLocaleString()} unit="개" />}
      </div>

      {/* 성비 바 */}
      <div className="bg-white rounded-xl p-4 border">
        <p className="text-xs text-gray-500 mb-2">성비</p>
        <div className="w-full h-3 bg-pink-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-l-full" style={{ width: `${maleRatio}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>남 {b.male.toLocaleString()} ({maleRatio.toFixed(1)}%)</span>
          <span>여 {b.female.toLocaleString()} ({(100 - maleRatio).toFixed(1)}%)</span>
        </div>
      </div>

      {/* 빠른 유세 추천 미리보기 */}
      <div className="bg-white rounded-xl p-4 border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">유세 추천 하이라이트</h3>
          <span className="text-[10px] text-gray-400">자세히 → 유세 추천 탭</span>
        </div>
        <div className="space-y-2">
          {b.morningSpots.slice(0, 2).map((s) => (
            <SpotRow key={s.name} spot={s} timeLabel="오전" color="bg-orange-100 text-orange-700" />
          ))}
          {b.daytimeSpots.slice(0, 1).map((s) => (
            <SpotRow key={s.name} spot={s} timeLabel="낮" color="bg-yellow-100 text-yellow-700" />
          ))}
          {b.eveningSpots.slice(0, 2).map((s) => (
            <SpotRow key={s.name} spot={s} timeLabel="저녁" color="bg-indigo-100 text-indigo-700" />
          ))}
          {b.seniorSpots.slice(0, 2).map((s) => (
            <SpotRow key={s.name} spot={s} timeLabel="경로당" color="bg-amber-100 text-amber-700" />
          ))}
        </div>
      </div>

      {/* 동별 인구 */}
      <div className="bg-white rounded-xl p-4 border">
        <h3 className="text-sm font-bold text-gray-800 mb-3">행정동별 인구</h3>
        <div className="space-y-1.5">
          {b.dongs
            .map((d) => {
              const pop = (jinjuAgePopulation as any)[d];
              return { dong: d, population: pop?.total || 0 };
            })
            .sort((a, b) => b.population - a.population)
            .map((d) => {
              const maxPop = Math.max(...b.dongs.map((dd) => (jinjuAgePopulation as any)[dd]?.total || 0), 1);
              return (
                <div key={d.dong} className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-gray-600 truncate shrink-0">{d.dong}</span>
                  <div className="flex-1 bg-gray-100 rounded overflow-hidden h-5">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{ width: `${(d.population / maxPop) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-gray-500 text-xs shrink-0">
                    {d.population.toLocaleString()}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ── 유세 추천 탭 ──

function CampaignTab({ briefing: b }: { briefing: DistrictBriefing }) {
  return (
    <div className="space-y-6">
      {/* 오전 */}
      <TimeSection
        title="오전 유세 (06~09시)"
        subtitle="출근·등교 시간, 정류장 승차 집중"
        spots={b.morningSpots}
        color="bg-orange-100 text-orange-700"
        emptyMsg="이 시간대 주요 거점이 없습니다"
      />

      {/* 낮 */}
      <TimeSection
        title="낮 유세 (09~17시)"
        subtitle="시장·상가·관공서 인근"
        spots={b.daytimeSpots}
        color="bg-yellow-100 text-yellow-700"
        emptyMsg="이 시간대 주요 거점이 없습니다"
      />

      {/* 저녁 */}
      <TimeSection
        title="저녁 유세 (17~21시)"
        subtitle="퇴근 시간, 하차 집중"
        spots={b.eveningSpots}
        color="bg-indigo-100 text-indigo-700"
        emptyMsg="이 시간대 주요 거점이 없습니다"
      />

      {/* 경로당 */}
      <div className="bg-white rounded-xl p-4 border">
        <h3 className="text-sm font-bold text-gray-800">경로당 방문 우선순위</h3>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">회원수 기준 상위 {b.seniorSpots.length}곳</p>
        {b.seniorSpots.length === 0 ? (
          <p className="text-xs text-gray-400">해당 선거구에 경로당 데이터가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {b.seniorSpots.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{s.dong}</span>
                </div>
                <span className="text-sm font-bold text-amber-600 shrink-0">{s.members}명</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 요약 팁 */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="text-sm font-bold text-blue-800 mb-2">전략 요약</h3>
        <ul className="space-y-1 text-xs text-blue-700">
          {b.seniorRatio > 0.25 && (
            <li>· 고령 인구 {(b.seniorRatio * 100).toFixed(0)}% — 경로당·전통시장 중심 유세 효과적</li>
          )}
          {b.youthRatio > 0.25 && (
            <li>· 청년 인구 {(b.youthRatio * 100).toFixed(0)}% — SNS·온라인 캠페인 병행 권장</li>
          )}
          {b.morningSpots.length > 0 && (
            <li>· 오전 피크: {b.morningSpots[0].name} ({b.morningSpots[0].bestHourLabel})</li>
          )}
          {b.eveningSpots.length > 0 && (
            <li>· 저녁 피크: {b.eveningSpots[0].name} ({b.eveningSpots[0].bestHourLabel})</li>
          )}
          {b.seniorSpots.length > 0 && (
            <li>· 최대 경로당: {b.seniorSpots[0].name} (회원 {b.seniorSpots[0].members}명)</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TimeSection({
  title,
  subtitle,
  spots,
  color,
  emptyMsg,
}: {
  title: string;
  subtitle: string;
  spots: CampaignSpot[];
  color: string;
  emptyMsg: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{subtitle}</p>
      {spots.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {spots.map((s, i) => (
            <div key={s.name} className="flex items-center gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-800">{s.name}</span>
                <span className="text-xs text-gray-400 ml-2">{s.dong}</span>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${color}`}>
                {s.bestHourLabel}
              </span>
              <span className="text-xs text-gray-500 shrink-0 w-16 text-right">
                {s.rideAtBest?.toLocaleString()}명
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 인구 탭 ──

function PopulationTab({ data, briefing }: { data: DistrictPopulationSummary; briefing: DistrictBriefing }) {
  const maxAge = Math.max(...data.ageGroups.flatMap((g) => [g.male, g.female]), 1);

  return (
    <div className="space-y-6">
      {/* 총 인구 */}
      <div className="bg-white rounded-xl p-4 border text-center">
        <div className="text-3xl font-bold text-gray-900">
          {data.totalPopulation.toLocaleString()}
          <span className="text-sm font-normal text-gray-400 ml-1">명</span>
        </div>
        <div className="flex items-center gap-3 mt-1 justify-center text-sm text-gray-500">
          <span>남 {data.totalMale.toLocaleString()}</span>
          <span>·</span>
          <span>여 {data.totalFemale.toLocaleString()}</span>
        </div>
      </div>

      {/* 인구 피라미드 */}
      <div className="bg-white rounded-xl p-4 border">
        <h3 className="text-sm font-bold text-gray-800 mb-4">연령대별 인구 피라미드</h3>
        <div className="space-y-1">
          {[...data.ageGroups].reverse().map((g) => (
            <div key={g.label} className="flex items-center gap-1">
              <div className="flex-1 flex justify-end">
                <div className="flex items-center gap-1 w-full justify-end">
                  <span className="text-[10px] text-gray-400 w-10 text-right">{g.male.toLocaleString()}</span>
                  <div className="w-24 sm:w-40 flex justify-end">
                    <div
                      className="h-4 bg-blue-400 rounded-l"
                      style={{ width: `${(g.male / maxAge) * 100}%`, minWidth: g.male > 0 ? 2 : 0 }}
                    />
                  </div>
                </div>
              </div>
              <span className="w-14 text-center text-xs text-gray-600 font-medium shrink-0">{g.label}</span>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <div className="w-24 sm:w-40">
                    <div
                      className="h-4 bg-pink-400 rounded-r"
                      style={{ width: `${(g.female / maxAge) * 100}%`, minWidth: g.female > 0 ? 2 : 0 }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-10">{g.female.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm" /> 남</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-400 rounded-sm" /> 여</span>
        </div>
      </div>

      {/* 특성 분석 */}
      <div className="bg-white rounded-xl p-4 border">
        <h3 className="text-sm font-bold text-gray-800 mb-3">인구 특성</h3>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="65세 이상" value={`${(briefing.seniorRatio * 100).toFixed(1)}%`} sub={`${briefing.seniorCount.toLocaleString()}명`} />
          <MiniStat label="20~30대" value={`${(briefing.youthRatio * 100).toFixed(1)}%`} />
          <MiniStat label="세대수" value="-" sub="데이터 추가 예정" />
          <MiniStat label="인구 증감" value="-" sub="데이터 추가 예정" />
        </div>
      </div>
    </div>
  );
}

// ── 선거 이력 탭 ──

function ElectionTab({ districtName }: { districtName: string }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <ElectionPanel
        dongName={districtName}
        onClose={() => {}}
        electionsData={jinjuElections}
        localElectionsData={jinjuLocalElections}
        cityName={JINJU.name}
        embedded
      />
    </div>
  );
}

// ── 공통 컴포넌트 ──

function StatCard({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? "bg-red-50 border-red-100" : "bg-white"}`}>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-xl font-bold leading-tight ${accent ? "text-red-600" : "text-gray-900"}`}>
        {value}
        {unit && <span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center p-2 bg-gray-50 rounded-lg">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function SpotRow({ spot, timeLabel, color }: { spot: CampaignSpot; timeLabel: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${color}`}>{timeLabel}</span>
      <span className="font-medium text-gray-800 truncate">{spot.name}</span>
      <span className="text-xs text-gray-400 ml-auto shrink-0">{spot.reason}</span>
    </div>
  );
}
