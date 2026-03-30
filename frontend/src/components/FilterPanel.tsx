"use client";

import { useState } from "react";
import type { FilterState } from "@/types";

const REGIONS = [
  "서울특별시",
  "경기도",
  "인천광역시",
  "부산광역시",
  "대구광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
];

function ratioLabel(v: number): { text: string; color: string } {
  if (v < 50) return { text: "최우선 검토", color: "text-red-700" };
  if (v < 60) return { text: "우선 검토", color: "text-red-600" };
  if (v < 70) return { text: "적극 검토", color: "text-orange-700" };
  if (v < 80) return { text: "일반 관심", color: "text-orange-600" };
  return { text: "관심 낮음", color: "text-gray-400" };
}

interface Props {
  filter: FilterState;
  onSearch: (f: FilterState) => void;
}

export default function FilterPanel({ filter, onSearch }: Props) {
  const [local, setLocal] = useState<FilterState>(filter);

  const label = ratioLabel(local.ratio_max);

  function reset() {
    const def: FilterState = {
      ratio_max: 100,
      usbd_min: 0,
      sd_nm: "",
      bookmarked: null,
      sort: local.sort,
    };
    setLocal(def);
  }

  return (
    <aside className="w-[230px] shrink-0 bg-[#faf9f7] border-r border-[#e8e6df] p-4 flex flex-col gap-5 min-h-screen">
      <h2 className="text-sm font-semibold text-[#1a1a18] border-b border-[#e8e6df] pb-2">필터</h2>

      {/* 감정가 대비 비율 상한 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#3d3d3a]">감정가 대비 비율 상한</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={local.ratio_max}
            onChange={(e) => setLocal({ ...local, ratio_max: Number(e.target.value) })}
            className="flex-1 accent-[#185fa5]"
          />
          <input
            type="number"
            min={10}
            max={100}
            step={5}
            value={local.ratio_max}
            onChange={(e) => setLocal({ ...local, ratio_max: Number(e.target.value) })}
            className="w-14 text-xs border border-[#d3d1c7] rounded px-1 py-1 text-center"
          />
          <span className="text-xs text-[#5f5e5a]">%</span>
        </div>
        <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
      </div>

      {/* 유찰 횟수 최소 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#3d3d3a]">유찰 횟수 최소</label>
        <select
          value={local.usbd_min}
          onChange={(e) => setLocal({ ...local, usbd_min: Number(e.target.value) })}
          className="text-xs border border-[#d3d1c7] rounded px-2 py-1.5 bg-white"
        >
          <option value={0}>전체</option>
          <option value={1}>1회 이상</option>
          <option value={2}>2회 이상</option>
          <option value={3}>3회 이상</option>
          <option value={5}>5회 이상</option>
        </select>
      </div>

      {/* 지역 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[#3d3d3a]">지역</label>
        <select
          value={local.sd_nm}
          onChange={(e) => setLocal({ ...local, sd_nm: e.target.value })}
          className="text-xs border border-[#d3d1c7] rounded px-2 py-1.5 bg-white"
        >
          <option value="">전체</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* 관심물건만 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="bookmarked"
          checked={local.bookmarked === 1}
          onChange={(e) => setLocal({ ...local, bookmarked: e.target.checked ? 1 : null })}
          className="accent-[#185fa5]"
        />
        <label htmlFor="bookmarked" className="text-xs text-[#3d3d3a] cursor-pointer">
          관심 물건만
        </label>
      </div>

      {/* 버튼 */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={() => onSearch(local)}
          className="w-full bg-[#185fa5] text-white text-sm py-2 rounded font-medium hover:bg-[#14508f] transition-colors"
        >
          검색
        </button>
        <button
          onClick={reset}
          className="w-full bg-white border border-[#d3d1c7] text-[#3d3d3a] text-sm py-2 rounded hover:bg-[#f3f2ee] transition-colors"
        >
          초기화
        </button>
      </div>
    </aside>
  );
}
