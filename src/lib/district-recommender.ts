/**
 * 선거구별 유세 추천 로직
 * transit-usage + senior-centers + age-population 데이터를 조합하여
 * 시간대별 유세 추천 장소를 생성
 */
import { expandToLegalDongs, toAdminDong } from "./dong-mapping";
import type { TransitStation } from "./district-aggregator";

// ── 타입 ──

export interface SeniorCenter {
  name: string;
  dong: string;
  members: number;
  lat?: number;
  lng?: number;
  address?: string;
}

export interface CampaignSpot {
  name: string;
  dong: string;
  type: "transit" | "senior";
  /** 추천 시간대 (HH 형식, 예: "08") */
  bestHour?: string;
  bestHourLabel?: string;
  /** 해당 시간대 승차량 */
  rideAtBest?: number;
  /** 총 일평균 승차량 */
  dailyRide?: number;
  /** 경로당 회원수 */
  members?: number;
  lat?: number;
  lng?: number;
  reason: string;
}

export interface DistrictBriefing {
  name: string;
  shortName: string;
  seats: number;
  description: string;
  dongs: string[];
  // 인구
  population: number;
  male: number;
  female: number;
  seniorRatio: number; // 65세 이상 비율
  seniorCount: number;
  youthRatio: number; // 20~30대 비율
  // 교통
  stationCount: number;
  dailyRide: number;
  // 시설
  seniorCenterCount: number;
  totalSeniorMembers: number;
  // 유세 추천
  morningSpots: CampaignSpot[]; // 06~09시
  daytimeSpots: CampaignSpot[]; // 09~17시
  eveningSpots: CampaignSpot[]; // 17~21시
  seniorSpots: CampaignSpot[];  // 경로당 회원수 순
}

export interface AgePopEntry {
  total: number;
  male: number;
  female: number;
  [key: string]: string | number;
}

// ── 경로당 dong 매칭 ──

/** 경로당의 복합 dong 필드("신안동,평거동", "가좌.호탄동")를 파싱하여 행정동 반환 */
function parseSeniorCenterDongs(dongField: string): string[] {
  // 콤마 또는 마침표로 분리
  const parts = dongField.split(/[,.·]/);
  const result: string[] = [];
  for (const raw of parts) {
    let p = raw.trim();
    if (!p) continue;
    // "신안" → "신안동", "가좌" → "가좌동" (접미사 없으면 동 추가)
    if (!p.endsWith("동") && !p.endsWith("면") && !p.endsWith("읍")) {
      p += "동";
    }
    result.push(p);
  }
  return result;
}

/** 경로당이 해당 선거구에 속하는지 판단 */
function seniorCenterBelongsToDistrict(
  center: SeniorCenter,
  matchDongs: Set<string>,
  cityCode: string,
): boolean {
  const centerDongs = parseSeniorCenterDongs(center.dong);
  for (const d of centerDongs) {
    // 법정동이면 행정동으로 변환
    const admin = toAdminDong(d, cityCode);
    if (matchDongs.has(d) || matchDongs.has(admin)) return true;
  }
  return false;
}

// ── 시간대 분석 ──

interface HourlyRank {
  hour: string;
  ride: number;
}

function getTopHours(station: TransitStation): HourlyRank[] {
  return Object.entries(station.hourly)
    .map(([h, v]) => ({ hour: h, ride: v.ride }))
    .sort((a, b) => b.ride - a.ride);
}

function hourToLabel(h: string): string {
  const n = parseInt(h);
  return `${n}시~${n + 1}시`;
}

type TimeSlot = "morning" | "daytime" | "evening";

function getTimeSlot(hour: string): TimeSlot {
  const n = parseInt(hour);
  if (n >= 6 && n < 9) return "morning";
  if (n >= 9 && n < 17) return "daytime";
  return "evening";
}

// ── 메인 함수 ──

export function buildDistrictBriefing(
  district: { name: string; seats: number; description: string; dongs: string[] },
  agePopulation: Record<string, AgePopEntry>,
  transitUsage: TransitStation[],
  seniorCenters: SeniorCenter[],
  cityCode: string,
  cityName: string,
): DistrictBriefing {
  const { name, seats, description, dongs } = district;
  const shortName = name.replace(cityName, "");

  // 법정동 확장 (교통 데이터 매칭용)
  const matchDongs = expandToLegalDongs(dongs, cityCode);

  // ── 인구 집계 ──
  let population = 0, male = 0, female = 0;
  let senior = 0, youth = 0;

  for (const dong of dongs) {
    const e = agePopulation[dong];
    if (!e) continue;
    population += e.total;
    male += e.male;
    female += e.female;

    // 65세 이상 = 60대 후반 + 70대 + 80대 + 90대+ + 100세+
    // 간이 계산: 60대의 절반 + 70대 + 80대 + 90대 + 100세
    const s60m = (e.m60 as number) || 0;
    const s60f = (e.f60 as number) || 0;
    const s70 = ((e.m70 as number) || 0) + ((e.f70 as number) || 0);
    const s80 = ((e.m80 as number) || 0) + ((e.f80 as number) || 0);
    const s90 = ((e.m90 as number) || 0) + ((e.f90 as number) || 0);
    const s100 = ((e.m100 as number) || 0) + ((e.f100 as number) || 0);
    senior += Math.round((s60m + s60f) * 0.5) + s70 + s80 + s90 + s100;

    // 20~30대
    youth += ((e.m20 as number) || 0) + ((e.f20 as number) || 0)
           + ((e.m30 as number) || 0) + ((e.f30 as number) || 0);
  }

  const seniorRatio = population > 0 ? senior / population : 0;
  const youthRatio = population > 0 ? youth / population : 0;

  // ── 교통 집계 ──
  const stations = transitUsage.filter((s) => matchDongs.has(s.dong));
  const dailyRide = stations.reduce((sum, s) => sum + s.totalRide, 0);

  // ── 경로당 집계 ──
  const districtCenters = seniorCenters.filter((c) =>
    seniorCenterBelongsToDistrict(c, matchDongs, cityCode),
  );
  const totalSeniorMembers = districtCenters.reduce((sum, c) => sum + (c.members || 0), 0);

  // ── 유세 추천: 정류장 시간대별 ──
  const morning: CampaignSpot[] = [];
  const daytime: CampaignSpot[] = [];
  const evening: CampaignSpot[] = [];

  for (const station of stations) {
    const topHours = getTopHours(station);
    if (topHours.length === 0) continue;

    const best = topHours[0];
    if (best.ride < 10) continue; // 너무 적으면 제외

    const spot: CampaignSpot = {
      name: station.name,
      dong: toAdminDong(station.dong, cityCode),
      type: "transit",
      bestHour: best.hour,
      bestHourLabel: hourToLabel(best.hour),
      rideAtBest: best.ride,
      dailyRide: station.totalRide,
      reason: `${hourToLabel(best.hour)} 승차 ${best.ride.toLocaleString()}명`,
    };

    const slot = getTimeSlot(best.hour);
    if (slot === "morning") morning.push(spot);
    else if (slot === "daytime") daytime.push(spot);
    else evening.push(spot);
  }

  // 각 시간대별 상위 5개
  morning.sort((a, b) => (b.rideAtBest || 0) - (a.rideAtBest || 0));
  daytime.sort((a, b) => (b.rideAtBest || 0) - (a.rideAtBest || 0));
  evening.sort((a, b) => (b.rideAtBest || 0) - (a.rideAtBest || 0));

  // ── 경로당 추천 ──
  const seniorSpots: CampaignSpot[] = districtCenters
    .filter((c) => c.members > 0)
    .sort((a, b) => b.members - a.members)
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      dong: parseSeniorCenterDongs(c.dong)[0] || c.dong,
      type: "senior" as const,
      members: c.members,
      lat: c.lat,
      lng: c.lng,
      reason: `회원 ${c.members}명`,
    }));

  return {
    name,
    shortName,
    seats,
    description,
    dongs,
    population,
    male,
    female,
    seniorRatio,
    seniorCount: senior,
    youthRatio,
    stationCount: stations.length,
    dailyRide,
    seniorCenterCount: districtCenters.length,
    totalSeniorMembers,
    morningSpots: morning.slice(0, 5),
    daytimeSpots: daytime.slice(0, 5),
    eveningSpots: evening.slice(0, 5),
    seniorSpots,
  };
}

/**
 * 모든 선거구의 브리핑을 한 번에 생성
 */
export function buildAllBriefings(
  districtsData: any,
  electionType: string,
  agePopulation: Record<string, AgePopEntry>,
  transitUsage: TransitStation[],
  seniorCenters: SeniorCenter[],
  cityCode: string,
  cityName: string,
): DistrictBriefing[] {
  const typeConfig = districtsData?.types?.[electionType];
  if (!typeConfig?.districts) return [];

  return typeConfig.districts.map((d: any) =>
    buildDistrictBriefing(d, agePopulation, transitUsage, seniorCenters, cityCode, cityName),
  );
}
