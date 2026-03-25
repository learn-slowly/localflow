"use client";

import ageDataRaw from "@/data/jinju-age-population.json";

const ageData = ageDataRaw as Record<string, AgeEntry>;

interface AgeEntry {
  code: string;
  total: number;
  male: number;
  female: number;
  m0: number; m10: number; m20: number; m30: number; m40: number;
  m50: number; m60: number; m70: number; m80: number; m90: number; m100: number;
  f0: number; f10: number; f20: number; f30: number; f40: number;
  f50: number; f60: number; f70: number; f80: number; f90: number; f100: number;
}

const AGE_GROUPS = [
  { label: "0-9", m: "m0", f: "f0" },
  { label: "10대", m: "m10", f: "f10" },
  { label: "20대", m: "m20", f: "f20" },
  { label: "30대", m: "m30", f: "f30" },
  { label: "40대", m: "m40", f: "f40" },
  { label: "50대", m: "m50", f: "f50" },
  { label: "60대", m: "m60", f: "f60" },
  { label: "70대", m: "m70", f: "f70" },
  { label: "80대", m: "m80", f: "f80" },
  { label: "90+", m: "m90", f: "f90" },
];

interface PopulationPanelProps {
  data: {
    name: string;
    population: number;
    households: number;
    male: number;
    female: number;
  } | null;
  onClose: () => void;
}

export default function PopulationPanel({ data, onClose }: PopulationPanelProps) {
  if (!data) return null;

  const age = ageData[data.name];
  const maleRatio = ((data.male / data.population) * 100).toFixed(1);
  const femaleRatio = ((data.female / data.population) * 100).toFixed(1);
  const perHousehold = (data.population / data.households).toFixed(1);

  // Find max for pyramid scaling
  let maxPop = 0;
  if (age) {
    for (const group of AGE_GROUPS) {
      const m = age[group.m as keyof AgeEntry] as number;
      const f = age[group.f as keyof AgeEntry] as number;
      maxPop = Math.max(maxPop, m, f);
    }
  }

  return (
    <div className="absolute bottom-4 left-4 z-[1000] w-96 rounded-lg bg-white p-4 shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">{data.name}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          &times;
        </button>
      </div>

      {/* 총인구 */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-gray-900">
          {data.population.toLocaleString()}
          <span className="text-sm font-normal text-gray-500 ml-1">명</span>
        </p>
        <p className="text-sm text-gray-500">
          {data.households.toLocaleString()}세대 (세대당 {perHousehold}명)
        </p>
      </div>

      {/* 성별 바 */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">성별 구성</p>
        <div className="flex h-6 rounded-full overflow-hidden">
          <div
            className="bg-blue-500 flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${maleRatio}%` }}
          >
            남 {maleRatio}%
          </div>
          <div
            className="bg-rose-400 flex items-center justify-center text-xs text-white font-medium"
            style={{ width: `${femaleRatio}%` }}
          >
            여 {femaleRatio}%
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{data.male.toLocaleString()}명</span>
          <span>{data.female.toLocaleString()}명</span>
        </div>
      </div>

      {/* 인구 피라미드 */}
      {age && (
        <div>
          <p className="text-xs text-gray-500 mb-2">연령별 인구 피라미드 (2025.01)</p>
          <div className="flex text-xs text-gray-500 mb-1 justify-between px-1">
            <span className="text-blue-500">남자</span>
            <span>연령</span>
            <span className="text-rose-400">여자</span>
          </div>
          {AGE_GROUPS.slice().reverse().map((group) => {
            const m = age[group.m as keyof AgeEntry] as number;
            const f = age[group.f as keyof AgeEntry] as number;
            const mPct = maxPop > 0 ? (m / maxPop) * 100 : 0;
            const fPct = maxPop > 0 ? (f / maxPop) * 100 : 0;
            return (
              <div key={group.label} className="flex items-center h-5">
                {/* Male side */}
                <div className="w-10 text-[10px] text-gray-400 text-right pr-1 flex-shrink-0">
                  {m.toLocaleString()}
                </div>
                <div className="w-[100px] flex-shrink-0 flex justify-end">
                  <div
                    className="bg-blue-500 h-3.5 rounded-sm"
                    style={{ width: `${mPct}%`, minWidth: mPct > 0 ? "2px" : "0" }}
                  />
                </div>
                {/* Label */}
                <div className="w-10 text-[10px] text-gray-500 text-center flex-shrink-0">
                  {group.label}
                </div>
                {/* Female side */}
                <div className="w-[100px] flex-shrink-0">
                  <div
                    className="bg-rose-400 h-3.5 rounded-sm"
                    style={{ width: `${fPct}%`, minWidth: fPct > 0 ? "2px" : "0" }}
                  />
                </div>
                <div className="w-10 text-[10px] text-gray-400 pl-1 flex-shrink-0">
                  {f.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
