// 클라이언트에서 직접 stcis.go.kr API 호출 (서버에서 차단되므로)
const TRANSIT_KEY = process.env.NEXT_PUBLIC_TRANSIT_API_KEY || "";
const BASE = "https://stcis.go.kr/openapi";

export interface AreaCode {
  sdCd: string;
  sdNm?: string;
  sggCd: string;
  sggNm?: string;
  emdCd: string;
  emdNm?: string;
}

export interface QuarterODItem {
  opratDate: string;
  stgEmdCd: string;
  stgEmdNm: string;
  arrEmdCd: string;
  arrEmdNm: string;
  tzon: string;
  quater: string;
  useStf: string; // 이용인원수
  useTm: string;  // 평균통행시간
}

// 읍면동 코드 조회
export async function fetchEmdCodes(sggCd: string): Promise<AreaCode[]> {
  const res = await fetch(`${BASE}/areacode.json?apikey=${TRANSIT_KEY}&sggCd=${sggCd}`);
  const data = await res.json();
  if (data.status !== "OK") return [];
  return data.result || [];
}

// 15분단위 OD 조회 (특정 출발지 → 모든 도착지)
export async function fetchOD(params: {
  opratDate: string;
  stgEmdCd: string;
  arrEmdCd: string;
}): Promise<QuarterODItem[]> {
  const res = await fetch(
    `${BASE}/quarterod.json?apikey=${TRANSIT_KEY}&opratDate=${params.opratDate}&stgEmdCd=${params.stgEmdCd}&arrEmdCd=${params.arrEmdCd}`
  );
  const data = await res.json();
  if (data.status !== "OK") return [];
  return data.result || [];
}

// 읍면동별 유동인구 집계 (특정 날짜, 특정 동의 유입/유출)
export async function fetchDongTraffic(params: {
  opratDate: string;
  targetEmdCd: string;
  allEmdCds: string[];
}): Promise<{ inbound: number; outbound: number; byHour: Record<string, { in: number; out: number }> }> {
  const { opratDate, targetEmdCd, allEmdCds } = params;

  let inbound = 0;
  let outbound = 0;
  const byHour: Record<string, { in: number; out: number }> = {};

  // 유입: 다른 동 → 이 동
  // 유출: 이 동 → 다른 동
  const promises = allEmdCds
    .filter((c) => c !== targetEmdCd)
    .flatMap((otherCd) => [
      fetchOD({ opratDate, stgEmdCd: otherCd, arrEmdCd: targetEmdCd }).then((items) => {
        for (const item of items) {
          const count = parseInt(item.useStf) || 0;
          inbound += count;
          const hour = item.tzon;
          if (!byHour[hour]) byHour[hour] = { in: 0, out: 0 };
          byHour[hour].in += count;
        }
      }),
      fetchOD({ opratDate, stgEmdCd: targetEmdCd, arrEmdCd: otherCd }).then((items) => {
        for (const item of items) {
          const count = parseInt(item.useStf) || 0;
          outbound += count;
          const hour = item.tzon;
          if (!byHour[hour]) byHour[hour] = { in: 0, out: 0 };
          byHour[hour].out += count;
        }
      }),
    ]);

  await Promise.all(promises);

  return { inbound, outbound, byHour };
}
