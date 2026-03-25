"use client";

import { useState } from "react";
import electionsData from "@/data/jinju-elections.json";
import localElectionsData from "@/data/jinju-local-elections.json";
import districtData from "@/data/jinju-districts.json";
import proportionalData from "@/data/jinju-proportional-results.json";

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

// 동 → 선거구 매핑 (jinju-districts.json 기반)
function buildDongToDistrictMap() {
  const map: Record<string, Record<string, string>> = {};
  const types = (districtData as any).types;
  for (const [typeKey, typeData] of Object.entries(types) as any[]) {
    map[typeKey] = {};
    for (const d of typeData.districts) {
      for (const dong of d.dongs) {
        map[typeKey][dong] = d.name;
      }
    }
  }
  return map;
}

const DONG_DISTRICT_MAP = buildDongToDistrictMap();

// 총선 선거구 매핑
const ASSEMBLY_DONG_MAP: Record<string, string> = {
  "천전동": "진주시갑", "성북동": "진주시갑", "평거동": "진주시갑",
  "신안동": "진주시갑", "이현동": "진주시갑", "판문동": "진주시갑",
  "가호동": "진주시갑", "충무공동": "진주시갑", "문산읍": "진주시갑",
  "내동면": "진주시갑", "정촌면": "진주시갑", "금곡면": "진주시갑",
  "명석면": "진주시갑", "대평면": "진주시갑", "수곡면": "진주시갑",
  "중앙동": "진주시을", "상봉동": "진주시을", "상대동": "진주시을",
  "하대동": "진주시을", "상평동": "진주시을", "초장동": "진주시을",
  "진성면": "진주시을", "일반성면": "진주시을", "이반성면": "진주시을",
  "사봉면": "진주시을", "지수면": "진주시을", "대곡면": "진주시을",
  "금산면": "진주시을", "집현면": "진주시을", "미천면": "진주시을",
};

type ElectionEntry = {
  label: string;
  date: string;
  results: { district: string; voters: number; turnout: number; valid: number; invalid: number; candidates: { name: string; party: string; votes: number }[] }[];
  dongResults?: { dong: string; district: string; voters: number; rates: Record<string, number> }[];
  subType?: string;
};

function getAllElections(): ElectionEntry[] {
  const main = (electionsData as any[]).map((e) => ({
    label: e.label,
    date: e.date,
    results: e.results,
    dongResults: e.dongResults,
  }));
  const local = (localElectionsData as any[]).map((e) => ({
    label: e.label,
    date: e.date,
    results: e.results,
    dongResults: e.dongResults || [],
    subType: e.subType,
  }));
  return [...main, ...local];
}

const ALL_ELECTIONS = getAllElections();

// 선거를 그룹화 (대선/총선은 단독, 지선은 시장/기초/도의원 묶음)
type ElectionGroup = {
  label: string;
  date: string;
  entries: ElectionEntry[];
};

function groupElections(): ElectionGroup[] {
  const groups: ElectionGroup[] = [];
  const localMap: Record<string, ElectionEntry[]> = {};

  for (const e of ALL_ELECTIONS) {
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
        const order = ["시장", "기초의원", "도의원"];
        return order.indexOf(a.subType || "") - order.indexOf(b.subType || "");
      }),
    });
  }

  groups.sort((a, b) => b.date.localeCompare(a.date));
  return groups;
}

const ELECTION_GROUPS = groupElections();

function CandidateBar({
  candidates,
  validVotes,
  seats = 1,
}: {
  candidates: { name: string; party: string; votes: number }[];
  validVotes: number;
  seats?: number;
}) {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes || 1;
  return (
    <div className="space-y-1.5">
      {sorted.map((c, i) => {
        const pct = ((c.votes / validVotes) * 100).toFixed(1);
        const barPct = (c.votes / maxVotes) * 100;
        const color = PARTY_COLORS[c.party] || "#999";
        const elected = i < seats;
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
  candidates,
}: {
  dong: { dong: string; voters: number };
  rates: Record<string, number>;
  candidates: { name: string; party: string }[];
}) {
  const candidateParty: Record<string, string> = {};
  candidates.forEach((c) => { candidateParty[c.name] = c.party; });
  const entries = Object.entries(rates).sort(([, a], [, b]) => b - a);

  return (
    <div className="py-2">
      <div className="flex gap-0.5 h-5 rounded overflow-hidden">
        {entries.map(([name, rate]) => {
          const color = PARTY_COLORS[candidateParty[name] || ""] || "#999";
          return (
            <div key={name} className="relative group cursor-default" style={{ width: `${rate}%`, backgroundColor: color }}>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {name} {rate}%
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1">
        {entries.map(([name, rate]) => {
          const color = PARTY_COLORS[candidateParty[name] || ""] || "#999";
          return (
            <span key={name} className="text-xs text-gray-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{ backgroundColor: color }} />
              {name} {rate}%
            </span>
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
}

export default function ElectionPanel({ dongName, onClose }: ElectionPanelProps) {
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [selectedSubIdx, setSelectedSubIdx] = useState(0);

  if (!dongName) return null;

  const group = ELECTION_GROUPS[selectedGroupIdx];
  if (!group) return null;

  // 지선인 경우 하위 탭 (시장/기초의원/도의원)
  const hasSubTypes = group.entries.length > 1;
  const entry = group.entries[Math.min(selectedSubIdx, group.entries.length - 1)];
  if (!entry) return null;

  // 해당 동의 읍면동별 득표율 찾기
  const dongResult = entry.dongResults?.find((d: any) => d.dong === dongName) as
    { dong: string; district: string; voters: number; rates: Record<string, number> } | undefined;

  // 해당 동이 속한 선거구의 결과 찾기
  let districtResult = null;
  let districtSeats = 1;

  if (entry.subType) {
    // 지선: 동 → 선거구 매핑
    const typeKey = entry.subType === "시장" ? "mayor" : entry.subType === "기초의원" ? "local" : "provincial";
    if (typeKey === "mayor") {
      // 시장은 시 전체가 하나의 선거구 — results[0] 사용
      districtResult = entry.results[0];
      districtSeats = 1;
    } else {
      const districtName = DONG_DISTRICT_MAP[typeKey]?.[dongName];
      if (districtName) {
        districtResult = entry.results.find((r) => r.district === districtName);
        const distInfo = (districtData as any).types[typeKey]?.districts.find((d: any) => d.name === districtName);
        districtSeats = distInfo?.seats || 1;
      }
    }
  } else if (entry.results.length > 1) {
    // 총선: 동 → 갑/을
    const assemblyDistrict = ASSEMBLY_DONG_MAP[dongName];
    if (assemblyDistrict) {
      districtResult = entry.results.find((r) => r.district === assemblyDistrict);
    }
  } else {
    // 대선: 진주시 전체
    districtResult = entry.results[0];
  }

  const allCandidates = districtResult?.candidates || entry.results.flatMap((r) => r.candidates);

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
          <p className="text-xs text-gray-400 mb-1">선거인 {dongResult.voters.toLocaleString()}명</p>
          <DongRateBar dong={dongResult} rates={dongResult.rates} candidates={allCandidates} />
        </div>
      )}

      {/* 선거구 결과 */}
      {districtResult && (
        <div className={dongResult ? "pt-3 border-t" : ""}>
          <h4 className="text-sm font-bold text-gray-600 mb-1">
            {districtResult.district}
            {dongResult ? " (선거구 합계)" : ""}
          </h4>
          <div className="text-sm text-gray-500 mb-2">
            선거인 <strong>{districtResult.voters.toLocaleString()}</strong>
            <span className="mx-1">·</span>
            투표 <strong>{districtResult.turnout.toLocaleString()}</strong>
            {" "}({((districtResult.turnout / districtResult.voters) * 100).toFixed(1)}%)
          </div>
          <CandidateBar candidates={districtResult.candidates} validVotes={districtResult.valid} seats={districtSeats} />
        </div>
      )}

      {/* 비례대표 (지선 시장 탭에서 표시) */}
      {entry.subType === "시장" && (
        <>
          {(proportionalData as any)[`localPR_${entry.date}`] && (
            <ProportionalBar
              label="기초의원 비례대표"
              data={(proportionalData as any)[`localPR_${entry.date}`]}
            />
          )}
          {(proportionalData as any)[`provincialPR_${entry.date}`] && (
            <ProportionalBar
              label="도의원 비례대표"
              data={(proportionalData as any)[`provincialPR_${entry.date}`]}
            />
          )}
        </>
      )}

      {!dongResult && !districtResult && (
        <p className="text-sm text-gray-400">이 동의 데이터가 없습니다.</p>
      )}
    </div>
  );
}
