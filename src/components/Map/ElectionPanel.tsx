"use client";

import electionData from "@/data/jinju-election-results.json";
import provincialData from "@/data/jinju-provincial-results.json";
import mayorData from "@/data/jinju-mayor-result.json";
import proportionalData from "@/data/jinju-proportional-results.json";
import districtData from "@/data/jinju-districts.json";

const PARTY_COLORS: Record<string, string> = {
  "더불어민주당": "#1D6CE0",
  "국민의힘": "#E61E2B",
  "진보당": "#D6001C",
  "정의당": "#FFCC00",
  "기본소득당": "#00BFA5",
  "녹색당": "#45B035",
  "무소속": "#999999",
};

function CandidateBar({ candidates, seats, validVotes }: { candidates: any[]; seats: number; validVotes: number }) {
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const maxVotes = sorted[0]?.votes || 1;
  return (
    <div className="space-y-2">
      {sorted.map((c, i) => {
        const pct = ((c.votes / validVotes) * 100).toFixed(1);
        const barPct = (c.votes / maxVotes) * 100;
        const color = PARTY_COLORS[c.party] || "#999";
        const isElected = i < seats;
        return (
          <div key={i} className={isElected ? "opacity-100" : "opacity-60"}>
            <div className="flex items-center justify-between text-sm">
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
                <strong>{c.name}</strong>
                {isElected && <span className="text-green-600 text-xs ml-1">당선</span>}
                <span className="text-gray-400 ml-1 text-xs">{c.party}</span>
              </span>
              <span className="font-medium">{c.votes.toLocaleString()}표 ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full mt-0.5">
              <div className="h-2 rounded-full" style={{ width: `${barPct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PartyBar({ parties, validVotes }: { parties: any[]; validVotes: number }) {
  const maxVotes = parties[0]?.votes || 1;
  return (
    <div className="space-y-1.5">
      {parties.map((p, i) => {
        const pct = ((p.votes / validVotes) * 100).toFixed(1);
        const barPct = (p.votes / maxVotes) * 100;
        const color = PARTY_COLORS[p.party] || "#999";
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-sm">
              <span>
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: color }} />
                <span>{p.party}</span>
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
  );
}

interface ElectionPanelProps {
  district: string | null;
  electionType: "local" | "provincial" | "mayor";
  onClose: () => void;
}

export default function ElectionPanel({ district, electionType, onClose }: ElectionPanelProps) {
  if (!district) return null;

  const resultsMap: Record<string, any[]> = {
    local: electionData as any[],
    provincial: provincialData as any[],
    mayor: [mayorData],
  };
  const results = resultsMap[electionType] || [];
  const typeData = (districtData as any).types[electionType];
  const data = results.find((d: any) => d.district === district);
  const distInfo = typeData?.districts.find((d: any) => d.name === district);

  if (!distInfo) return null;

  const isUncontested = distInfo.note === "무투표 당선";
  const prData = proportionalData as any;

  return (
    <div className="absolute bottom-4 left-4 z-[1000] w-96 rounded-lg bg-white p-4 shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-800">{district}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
          &times;
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-2">{typeData.label}</p>

      {/* 선거구 구성 정보 */}
      {electionType !== "mayor" && (
        <div className="mb-3 px-2 py-1.5 bg-gray-50 rounded text-sm">
          <p className="text-gray-500">{distInfo.description}</p>
          <p className="text-gray-700 mt-0.5">
            <strong>{distInfo.dongs.join(" · ")}</strong>
            <span className="text-gray-400 ml-1">(정수 {distInfo.seats}명)</span>
          </p>
        </div>
      )}

      {isUncontested ? (
        <p className="text-amber-600 font-medium text-sm">무투표 당선</p>
      ) : data ? (
        <>
          <div className="mb-3 text-sm text-gray-600">
            <p>선거인수: <strong>{data.voters.toLocaleString()}</strong>명</p>
            <p>투표수: <strong>{data.turnout.toLocaleString()}</strong>명 (투표율 <strong>{data.turnoutRate}%</strong>)</p>
            <p className="text-xs text-gray-400">유효 {data.valid.toLocaleString()} / 무효 {data.invalid.toLocaleString()}</p>
          </div>

          <CandidateBar candidates={data.candidates} seats={distInfo.seats} validVotes={data.valid} />
        </>
      ) : (
        <p className="text-sm text-gray-400">개표 데이터 없음</p>
      )}

      {/* 시장 선거에서 비례대표 결과 표시 */}
      {electionType === "mayor" && (
        <>
          {/* 기초의원 비례 */}
          {prData.localPR && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-sm font-bold text-gray-700 mb-2">{prData.localPR.label}</h4>
              <p className="text-xs text-gray-400 mb-2">
                유효 {prData.localPR.valid.toLocaleString()}표
              </p>
              <PartyBar parties={prData.localPR.parties} validVotes={prData.localPR.valid} />
            </div>
          )}

          {/* 광역의원 비례 */}
          {prData.provincialPR && (
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-sm font-bold text-gray-700 mb-2">{prData.provincialPR.label}</h4>
              <p className="text-xs text-gray-400 mb-2">
                유효 {prData.provincialPR.valid.toLocaleString()}표
              </p>
              <PartyBar parties={prData.provincialPR.parties} validVotes={prData.provincialPR.valid} />
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 mt-3">제8회 지방선거 (2022.06.01)</p>
    </div>
  );
}
