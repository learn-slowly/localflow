/**
 * 법정동 → 행정동 매핑 (진주시)
 * 교통 데이터의 dong 필드는 법정동 이름으로 내려오므로 행정동으로 변환 필요
 */

// 진주시 법정동 이름 → 행정동 이름
const JINJU_LEGAL_TO_ADMIN: Record<string, string> = {
  // 천전동 소속
  "망경동": "천전동",
  "주약동": "천전동",
  "강남동": "천전동",
  "칠암동": "천전동",
  // 성북동 소속
  "본성동": "성북동",
  "동성동": "성북동",
  "남성동": "성북동",
  "인사동": "성북동",
  "봉곡동": "성북동",
  // 중앙동 소속
  "대안동": "중앙동",
  "평안동": "중앙동",
  "중안동": "중앙동",
  "계동": "중앙동",
  "봉래동": "중앙동",
  "수정동": "중앙동",
  "장대동": "중앙동",
  "옥봉동": "중앙동",
  // 초장동 소속
  "초전동": "초장동",
  "장재동": "초장동",
  // 이현동 소속
  "하촌동": "이현동",
  "유곡동": "이현동",
  // 판문동 소속
  "귀곡동": "판문동",
  // 가호동 소속
  "가좌동": "가호동",
  "호탄동": "가호동",
};

// 도시코드별 매핑 (확장용)
const LEGAL_TO_ADMIN_BY_CITY: Record<string, Record<string, string>> = {
  "48170": JINJU_LEGAL_TO_ADMIN,
};

/**
 * 행정동 목록에 대응하는 법정동 목록 반환 (행정동 자신 포함)
 * 교통 데이터가 법정동 이름으로 되어있으므로, 선거구의 행정동 목록을
 * 법정동 목록으로 확장하여 교통 데이터를 필터링할 때 사용
 */
export function expandToLegalDongs(adminDongs: string[], cityCode: string): Set<string> {
  const mapping = LEGAL_TO_ADMIN_BY_CITY[cityCode];
  const result = new Set(adminDongs); // 행정동 자체도 포함 (읍면은 이름 동일)

  if (mapping) {
    for (const [legal, admin] of Object.entries(mapping)) {
      if (adminDongs.includes(admin)) {
        result.add(legal);
      }
    }
  }

  return result;
}

/**
 * 법정동 이름을 행정동 이름으로 변환
 * 이미 행정동이거나 매핑이 없으면 원본 반환
 */
export function toAdminDong(legalDongName: string, cityCode: string): string {
  const mapping = LEGAL_TO_ADMIN_BY_CITY[cityCode];
  if (!mapping) return legalDongName;
  return mapping[legalDongName] || legalDongName;
}

/**
 * 선거구 정의에서 동 목록 가져오기
 */
export function getDistrictDongs(
  districtName: string,
  districtsData: any,
  electionType: string,
): string[] {
  const typeConfig = districtsData?.types?.[electionType];
  if (!typeConfig?.districts) return [];

  const district = typeConfig.districts.find(
    (d: any) => d.name === districtName,
  );
  return district?.dongs || [];
}

/**
 * 선거구 설명 가져오기
 */
export function getDistrictInfo(
  districtName: string,
  districtsData: any,
  electionType: string,
): { seats: number; description: string; dongs: string[] } | null {
  const typeConfig = districtsData?.types?.[electionType];
  if (!typeConfig?.districts) return null;

  const district = typeConfig.districts.find(
    (d: any) => d.name === districtName,
  );
  if (!district) return null;

  return {
    seats: district.seats || 0,
    description: district.description || "",
    dongs: district.dongs || [],
  };
}
