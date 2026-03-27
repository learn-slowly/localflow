"use client";

import { useState, useMemo } from "react";

const PARTY_COLORS: Record<string, string> = {
  "더불어민주당": "#1D6CE0",
  "국민의힘": "#E61E2B",
  "미래통합당": "#E61E2B",
  "자유한국당": "#E61E2B",
  "새누리당": "#E61E2B",
  "국민의당": "#EA8D2F",
  "개혁신당": "#FF6600",
  "바른정당": "#00BFBF",
  "바른미래당": "#00BFBF",
  "민주평화당": "#007F3E",
  "민중당": "#E8340A",
  "기본소득당": "#82C8B0",
  "녹색당": "#55B54A",
  "정의당": "#FFCC00",
  "민주노동당": "#FFCC00",
  "진보당": "#D6001C",
  "대한애국당": "#004B8E",
  "무소속": "#999999",
};

// dongResults에서 동 → 선거구 매핑 생성
function buildDongToDistrictFromData(elections: any[], localElections: any[]) {
  const map: Record<string, Record<string, string>> = {};

  // 지선: subType → typeKey 매핑
  const subTypeToKey: Record<string, string> = {
    "기초의원": "local", "도의원": "provincial", "시장": "mayor",
    "시도지사": "governor", "교육감": "education",
  };
  for (const e of localElections) {
    if (!e.subType || !e.dongResults?.length) continue;
    const typeKey = subTypeToKey[e.subType] || e.subType;
    if (!map[typeKey]) map[typeKey] = {};
    for (const d of e.dongResults) {
      if (d.dong && !(d.dong in map[typeKey])) {
        map[typeKey][d.dong] = d.district;
      }
    }
  }

  // 총선: dongResults가 있는 선거
  map["assembly"] = {};
  for (const e of elections) {
    if (e.dongResults?.length > 0 && (e.label?.includes("총선") || e.results?.length > 1)) {
      for (const d of e.dongResults) {
        if (d.dong && !(d.dong in map["assembly"])) {
          map["assembly"][d.dong] = d.district;
        }
      }
      break;
    }
  }

  return map;
}

// 시군구 결과 ≠ 실제 당선자인 광역 선거 (경남 공통)
const WIDE_ELECTED_MAP: Record<string, string[]> = {
  "2025 대선 (제21대)": ["이재명"],
  "2022 대선 (제20대)": ["윤석열"],
  "2017 대선 (제19대)": ["문재인"],
  "2022 지선 (제8회) 시도지사": ["박완수"],
  "2022 지선 (제8회) 교육감": ["박종훈"],
  "2018 지선 (제7회) 시도지사": ["김경수"],
  "2018 지선 (제7회) 교육감": ["박종훈"],
};

// 시군구 내 결과로 당선자를 판단할 수 있는 유형
const LOCAL_DISTRICT_TYPES = ["시장", "기초의원", "도의원"];

type ElectionEntry = {
  label: string;
  date: string;
  results: { district: string; voters: number; turnout: number; valid: number; invalid: number; seats?: number; candidates: { name: string; party: string; votes: number }[] }[];
  dongResults?: { dong: string; district: string; voters: number; turnout?: number; rates: Record<string, number>; votes?: Record<string, number> }[];
  subType?: string;
};

// 선거를 그룹화 (대선/총선은 단독, 지선은 시장/기초/도의원 묶음)
type ElectionGroup = {
  label: string;
  date: string;
  entries: ElectionEntry[];
};

function groupElections(allElections: ElectionEntry[]): ElectionGroup[] {
  const groups: ElectionGroup[] = [];
  const localMap: Record<string, ElectionEntry[]> = {};

  for (const e of allElections) {
    if (e.subType) {
      const key = e.date;
      if (!localMap[key]) localMap[key] = [];
      localMap[key].push(e);
    } else {
      groups.push({ label: e.label, date: e.date, entries: [e] });
    }
  }

  for (const [date, entries] of Object.entries(localMap)) {
    const year = date.split(".")[0];
    groups.push({
      label: `${year} 지선`,
      date,
      entries: entries.sort((a, b) => {
        const order = ["시장", "시도지사", "기초의원", "도의원", "교육감", "기초비례", "광역비례"];
        return (order.indexOf(a.subType || "") === -1 ? 99 : order.indexOf(a.subType || "")) - (order.indexOf(b.subType || "") === -1 ? 99 : order.indexOf(b.subType || ""));
      }),
    });
  }

  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}

function CandidateBar({
  candidates,
  validVotes,
  seats = 1,
  electedNames,
}: {
  candidates: { name: string; party: string; votes: number }[];
  validVotes: number;
  seats?: number;
  electedNames?: string[];
}) {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes || 1;
  return (
    <div className="space-y-1.5">
      {sorted.map((c, i) => {
        const pct = ((c.votes / validVotes) * 100).toFixed(1);
        const barPct = (c.votes / maxVotes) * 100;
        const color = PARTY_COLORS[c.party] || "#999";
        const elected = electedNames
          ? electedNames.includes(c.name)
          : i < seats;
        return (
          <div key={i} className={elected ? "" : "opacity-50"}>
            <div className="flex items-center justify-between text-sm">
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
                <strong>{c.name}</strong>
                {elected && <span className="text-green-600 text-xs ml-1">당선</span>}
                <span className="text-gray-400 ml-1 text-xs">{c.party}</span>
              </span>
              <span className="font-medium">{c.votes.toLocaleString()}표 ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full mt-0.5">
              <div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DongRateBar({
  dong,
  rates,
  votes,
  candidates,
}: {
  dong: { dong: string; voters: number; turnout?: number };
  rates: Record<string, number>;
  votes?: Record<string, number>;
  candidates: { name: string; party: string }[];
}) {
  const candidateParty: Record<string, string> = {};
  candidates.forEach((c) => { candidateParty[c.name] = c.party; });
  const entries = Object.entries(rates).sort(([, a], [, b]) => b - a);
  const maxVotes = votes ? Math.max(...Object.values(votes)) : 0;

  return (
    <div className="py-2">
      <div className="flex gap-0.5 h-5 rounded overflow-hidden">
        {entries.map(([name, rate]) => {
          const color = PARTY_COLORS[candidateParty[name] || ""] || "#999";
          return (
            <div key={name} className="relative group cursor-default" style={{ width: `${rate}%`, backgroundColor: color }}>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {name} {votes?.[name]?.toLocaleString()}표 ({rate}%)
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-1 mt-2">
        {entries.map(([name, rate]) => {
          const color = PARTY_COLORS[candidateParty[name] || ""] || "#999";
          const v = votes?.[name] || 0;
          const barPct = maxVotes > 0 ? (v / maxVotes) * 100 : rate;
          return (
            <div key={name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: color }} />
                  {name}
                </span>
                <span className="text-gray-500 font-medium">
                  {v > 0 ? `${v.toLocaleString()}표` : ""} ({rate}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-0.5">
                <div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProportionalBar({
  label,
  data,
}: {
  label: string;
  data: { voters: number; turnout: number; valid: number; parties: { party: string; votes: number }[] };
}) {
  const sorted = [...data.parties].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes || 1;
  return (
    <div className="mt-3 pt-3 border-t">
      <h4 className="text-sm font-bold text-gray-600 mb-1">{label}</h4>
      <div className="text-sm text-gray-500 mb-2">
        유효 <strong>{data.valid.toLocaleString()}</strong>표
      </div>
      <div className="space-y-1.5">
        {sorted.map((p, i) => {
          const pct = ((p.votes / data.valid) * 100).toFixed(1);
          const barPct = (p.votes / maxVotes) * 100;
          const color = PARTY_COLORS[p.party] || "#999";
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
                  <strong>{p.party}</strong>
                </span>
                <span className="font-medium">{p.votes.toLocaleString()}표 ({pct}%)</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full mt-0.5">
                <div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ElectionPanelProps {
  dongName: string | null;
  onClose: () => void;
  electionsData: any[];
  localElectionsData: any[];
  cityName: string;
}

export default function ElectionPanel({ dongName, onClose, electionsData, localElectionsData, cityName }: ElectionPanelProps) {
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [selectedSubIdx, setSelectedSubIdx] = useState(0);

  const DONG_DISTRICT_MAP = useMemo(
    () => buildDongToDistrictFromData(electionsData, localElectionsData),
    [electionsData, localElectionsData],
  );

  const ELECTION_GROUPS = useMemo(() => {
    const allElections: ElectionEntry[] = [
      ...electionsData.map((e: any) => ({
        label: e.label, date: e.date, results: e.results || [], dongResults: e.dongResults,
      })),
      ...localElectionsData.map((e: any) => ({
        label: e.label, date: e.date, results: e.results || [], dongResults: e.dongResults || [], subType: e.subType,
      })),
    ];
    return groupElections(allElections);
  }, [electionsData, localElectionsData]);

  if (!dongName) return null;

  const group = ELECTION_GROUPS[Math.min(selectedGroupIdx, ELECTION_GROUPS.length - 1)];
  if (!group) return null;

  // 지선인 경우 하위 탭 (시장/기초의원/도의원)
  const hasSubTypes = group.entries.length > 1;
  const entry = group.entries[Math.min(selectedSubIdx, group.entries.length - 1)];
  if (!entry) return null;

  // 해당 동의 읍면동별 득표율 찾기
  const dongResult = entry.dongResults?.find((d: any) => d.dong === dongName) as
    { dong: string; district: string; voters: number; turnout?: number; rates: Record<string, number>; votes?: Record<string, number> } | undefined;

  // 해당 동이 속한 선거구의 결과 찾기
  let districtResult = null;
  let districtSeats = 1;

  if (entry.subType) {
    // 지선: 동 → 선거구 매핑
    const singleDistrictTypes = ["시장", "시도지사", "교육감", "광역비례", "기초비례"];
    if (singleDistrictTypes.includes(entry.subType)) {
      // 시/도/전체 단위 선거 — results[0] 사용
      districtResult = entry.results[0];
      districtSeats = 1;
    } else {
      // 기초의원/도의원: dongResult의 district를 직접 사용 (연도별 선거구 차이 대응)
      const districtName = dongResult?.district
        || DONG_DISTRICT_MAP[entry.subType === "기초의원" ? "local" : "provincial"]?.[dongName];
      if (districtName) {
        districtResult = entry.results.find((r) => r.district === districtName);
        districtSeats = districtResult?.seats || 1;
      }
    }
  } else if (entry.label?.includes("총선")) {
    // 총선: dongResult의 district 직접 사용
    const assemblyDistrict = dongResult?.district || DONG_DISTRICT_MAP["assembly"]?.[dongName];
    if (assemblyDistrict) {
      districtResult = entry.results.find((r) => r.district === assemblyDistrict);
    }
    if (!districtResult) {
      districtResult = entry.results[0];
    }
  } else {
    // 대선
    districtResult = entry.results[0];
  }

  const allCandidates = districtResult?.candidates || entry.results.flatMap((r) => r.candidates);

  // 당선자 판단
  const isLocalScope = entry.subType
    ? LOCAL_DISTRICT_TYPES.includes(entry.subType)
    : false;
  const isAssembly = !entry.subType && entry.label?.includes("총선");
  const isPresidential = !entry.subType && !isAssembly;

  let electedNames: string[] | undefined;
  if (isLocalScope) {
    electedNames = undefined; // 득표순으로 당선 판단 (seats 기반)
  } else if (isAssembly) {
    // 총선: 득표 1위 당선
    electedNames = undefined;
    districtSeats = 1;
  } else {
    electedNames = WIDE_ELECTED_MAP[entry.label] || undefined;
  }

  // 시군구 내 결과만 표시됨을 알릴지 여부
  const isPartialResult = isPresidential || isAssembly || (!isLocalScope && !!entry.subType);

  return (
    <div className="absolute bottom-4 left-4 z-[1000] w-[400px] rounded-lg bg-white p-4 shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-800">{dongName}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      {/* 선거 선택 탭 */}
      <div className="flex gap-1 flex-wrap mb-2">
        {ELECTION_GROUPS.map((g, i) => (
          <button
            key={g.label + g.date}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              selectedGroupIdx === i ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => { setSelectedGroupIdx(i); setSelectedSubIdx(0); }}
          >
            {g.label.replace(/\s*\(.*\)/, "")}
          </button>
        ))}
      </div>

      {/* 지선 하위 탭 */}
      {hasSubTypes && (
        <div className="flex gap-1 mb-2">
          {group.entries.map((e, i) => (
            <button
              key={e.subType}
              className={`text-xs px-2 py-0.5 rounded ${
                selectedSubIdx === i ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"
              }`}
              onClick={() => setSelectedSubIdx(i)}
            >
              {e.subType}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">{entry.date}</p>

      {/* 읍면동별 득표율 (있는 경우) */}
      {dongResult && (
        <div className="mb-3">
          <h4 className="text-sm font-bold text-gray-600 mb-1">{dongName} 득표율</h4>
          <p className="text-xs text-gray-400 mb-1">
            선거인 {dongResult.voters.toLocaleString()}명
            {dongResult.turnout ? ` · 투표 ${dongResult.turnout.toLocaleString()}명` : ""}
          </p>
          <DongRateBar dong={dongResult} rates={dongResult.rates} votes={dongResult.votes} candidates={allCandidates} />
        </div>
      )}

      {/* 선거구 결과 */}
      {districtResult && (
        <div className={dongResult ? "pt-3 border-t" : ""}>
          <h4 className="text-sm font-bold text-gray-600 mb-1">
            {districtResult.district}
            {dongResult ? " (선거구 합계)" : ""}
          </h4>
          {isPartialResult && (
            <p className="text-xs text-amber-600 mb-1">
              * {cityName} 내 결과만 표시 (선거구가 더 넓음)
            </p>
          )}
          <div className="text-sm text-gray-500 mb-2">
            선거인 <strong>{districtResult.voters.toLocaleString()}</strong>
            <span className="mx-1">·</span>
            투표 <strong>{districtResult.turnout.toLocaleString()}</strong>
            {" "}({((districtResult.turnout / districtResult.voters) * 100).toFixed(1)}%)
          </div>
          <CandidateBar
            candidates={districtResult.candidates}
            validVotes={districtResult.valid}
            seats={districtSeats}
            electedNames={electedNames}
          />
        </div>
      )}

      {/* 비례대표 — 미구현 (확장 예정) */}

      {!dongResult && !districtResult && (
        <p className="text-sm text-gray-400">이 동의 데이터가 없습니다.</p>
      )}
    </div>
  );
}
