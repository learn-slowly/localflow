/**
 * 선거구별 데이터 집계 유틸리티
 */
import { expandToLegalDongs } from "./dong-mapping";

// ── 타입 ──

export interface AgePopulationEntry {
  code: string;
  total: number;
  male: number;
  female: number;
  [key: string]: string | number; // m0, f0, m10, f10, ...
}

export interface DistrictPopulationSummary {
  totalPopulation: number;
  totalMale: number;
  totalFemale: number;
  ageGroups: { label: string; male: number; female: number }[];
  byDong: { dong: string; population: number }[];
}

export interface TransitStation {
  sttn_id: string;
  name: string;
  dong: string;
  totalRide: number;
  totalGoff: number;
  hourly: Record<string, { ride: number; goff: number }>;
  byDow?: Record<string, Record<string, { ride: number; goff: number }>>;
}

export interface DistrictTransitSummary {
  totalRide: number;
  totalGoff: number;
  stationCount: number;
  hourly: Record<string, { ride: number; goff: number }>;
  topStations: { name: string; dong: string; total: number }[];
}

export interface DistrictCommerceSummary {
  totalStores: number;
  byDong: { dong: string; count: number }[];
}

// ── 연령대 라벨 ──

const AGE_LABELS = [
  "0~9세", "10대", "20대", "30대", "40대",
  "50대", "60대", "70대", "80대", "90대+",
];

// ── 집계 함수 ──

/**
 * 선거구 소속 행정동들의 인구 집계
 */
export function aggregatePopulation(
  dongs: string[],
  agePopulation: Record<string, AgePopulationEntry>,
): DistrictPopulationSummary {
  let totalPopulation = 0;
  let totalMale = 0;
  let totalFemale = 0;
  const ageGroups = AGE_LABELS.map((label) => ({ label, male: 0, female: 0 }));
  const byDong: { dong: string; population: number }[] = [];

  for (const dong of dongs) {
    const entry = agePopulation[dong];
    if (!entry) continue;

    totalPopulation += entry.total;
    totalMale += entry.male;
    totalFemale += entry.female;
    byDong.push({ dong, population: entry.total });

    // 연령대 집계 (m0/f0, m10/f10, ..., m90/f90 + m100/f100)
    for (let i = 0; i < 10; i++) {
      const decade = i * 10;
      const mKey = `m${decade}`;
      const fKey = `f${decade}`;
      ageGroups[i].male += (entry[mKey] as number) || 0;
      ageGroups[i].female += (entry[fKey] as number) || 0;
    }
    // 100세+ → 90대+에 합산
    ageGroups[9].male += (entry.m100 as number) || 0;
    ageGroups[9].female += (entry.f100 as number) || 0;
  }

  byDong.sort((a, b) => b.population - a.population);

  return { totalPopulation, totalMale, totalFemale, ageGroups, byDong };
}

/**
 * 선거구 소속 정류장의 교통량 집계
 * 법정동 → 행정동 변환 후 선거구 소속 여부 판단
 */
export function aggregateTransit(
  dongs: string[],
  transitUsage: TransitStation[],
  cityCode: string,
): DistrictTransitSummary {
  // 행정동 → 법정동 확장 (교통 데이터는 법정동 이름 사용)
  const matchDongs = expandToLegalDongs(dongs, cityCode);

  const stations = transitUsage.filter((s) => matchDongs.has(s.dong));

  let totalRide = 0;
  let totalGoff = 0;
  const hourly: Record<string, { ride: number; goff: number }> = {};

  for (const s of stations) {
    totalRide += s.totalRide;
    totalGoff += s.totalGoff;
    for (const [h, v] of Object.entries(s.hourly)) {
      if (!hourly[h]) hourly[h] = { ride: 0, goff: 0 };
      hourly[h].ride += v.ride;
      hourly[h].goff += v.goff;
    }
  }

  const topStations = [...stations]
    .sort((a, b) => (b.totalRide + b.totalGoff) - (a.totalRide + a.totalGoff))
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      dong: s.dong,
      total: s.totalRide + s.totalGoff,
    }));

  return { totalRide, totalGoff, stationCount: stations.length, hourly, topStations };
}

/**
 * 선거구 소속 행정동의 상가 수 집계
 */
export function aggregateCommerce(
  dongs: string[],
  commerceDensity: Record<string, number>,
): DistrictCommerceSummary {
  let totalStores = 0;
  const byDong: { dong: string; count: number }[] = [];

  for (const dong of dongs) {
    const count = commerceDensity[dong] || 0;
    totalStores += count;
    byDong.push({ dong, count });
  }

  byDong.sort((a, b) => b.count - a.count);

  return { totalStores, byDong };
}
