// 경남 22개 시·군 선거구→행정동 매핑 헬퍼.
// 데이터 출처: public/data/gyeongnam-districts.json (빌드 스크립트로 생성)

export type ElectionType = "local" | "provincial" | "assembly" | "mayor";

export interface DistrictEntry {
  name: string;
  dongs: string[];
}

export interface ElectionTypeConfig {
  election: string;
  districts: DistrictEntry[];
}

export interface CityDistricts {
  name: string;
  code: string;
  types: Partial<Record<ElectionType, ElectionTypeConfig>>;
}

export type GyeongnamDistricts = Record<string, CityDistricts>;

// 진주 GyeongnamMap.tsx의 DISTRICT_COLORS와 동일 팔레트.
// 시·군 내 selectedElectionType 기준 idx 순환.
export const DISTRICT_COLORS = [
  "#2563EB", "#DC2626", "#16A34A", "#CA8A04",
  "#9333EA", "#EA580C", "#0891B2", "#BE185D",
];

/**
 * 시·군 단위로 (동 → {선거구명, 색}) 맵을 한 번에 생성.
 * 진주 GyeongnamMap의 jinjuDongDistrictMap 일반화.
 */
export function buildDongDistrictMap(
  data: GyeongnamDistricts,
  cityKey: string,
  electionType: ElectionType,
): Record<string, { districtName: string; color: string }> {
  const result: Record<string, { districtName: string; color: string }> = {};
  const config = data[cityKey]?.types[electionType];
  if (!config) return result;
  config.districts.forEach((d, idx) => {
    const color = DISTRICT_COLORS[idx % DISTRICT_COLORS.length];
    for (const dong of d.dongs) {
      result[dong] = { districtName: d.name, color };
    }
  });
  return result;
}
