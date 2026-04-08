"use client";

import { useState } from "react";
import type { FilterState } from "@/types";

const USG_TREE: Record<string, string[]> = {
  "상가용및업무용건물": ["업무시설"],
  "용도복합용건물":     ["오피스텔", "주/상용건물"],
};

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
      ratio_min: 0,
      ratio_max: 100,
      price_min: null,
      price_max: null,
      usbd_min: 0,
      sd_nm: "",
      usg_mcls: "",
      usg_scls: "",
      bookmarked: null,
      pvct: null,
      sort: local.sort,
    };
    setLocal(def);
  }

  const sclsOptions = local.usg_mcls ? USG_TREE[local.usg_mcls] ?? [] : [];

  return (
    <aside className="w-[230px] shrink-0 bg-[#faf9f7] border-r border-[#e8e6df] p-4 flex flex-col gap-5 min-h-screen">
      <h2 className="text-sm font-semibold text-[#1a1a18] border-b border-[#e8e6df] pb-2">필터</h2>

      {/* 감정가 대비 비율 범위 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#3d3d3a]">감정가 대비 비율</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={local.ratio_min}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocal({ ...local, ratio_min: Math.min(v, local.ratio_max) });
            }}
            className="w-14 text-xs border border-[#d3d1c7] rounded px-1 py-1 text-center"
          />
          <span className="text-xs text-[#5f5e5a]">~</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={local.ratio_max}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocal({ ...local, ratio_max: Math.max(v, local.ratio_min) });
            }}
            className="w-14 text-xs border border-[#d3d1c7] rounded px-1 py-1 text-center"
          />
          <span className="text-xs text-[#5f5e5a]">%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={local.ratio_max}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocal({ ...local, ratio_max: Math.max(v, local.ratio_min) });
          }}
          className="w-full accent-[#185fa5]"
        />
        <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
      </div>

      {/* 최저입찰가 범위 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-[#3d3d3a]">최저입찰가</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={1000}
            placeholder="하한"
            value={local.price_min != null ? local.price_min / 10000 : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setLocal({ ...local, price_min: raw === "" ? null : Number(raw) * 10000 });
            }}
            className="w-[72px] text-xs border border-[#d3d1c7] rounded px-1.5 py-1 text-right"
          />
          <span className="text-xs text-[#5f5e5a]">~</span>
          <input
            type="number"
            min={0}
            step={1000}
            placeholder="상한"
            value={local.price_max != null ? local.price_max / 10000 : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setLocal({ ...local, price_max: raw === "" ? null : Number(raw) * 10000 });
            }}
            className="w-[72px] text-xs border border-[#d3d1c7] rounded px-1.5 py-1 text-right"
          />
          <span className="text-xs text-[#5f5e5a] shrink-0">만원</span>
        </div>
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

      {/* 용도 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#3d3d3a]">용도</label>
        <select
          value={local.usg_mcls}
          onChange={(e) => setLocal({ ...local, usg_mcls: e.target.value, usg_scls: "" })}
          className="text-xs border border-[#d3d1c7] rounded px-2 py-1.5 bg-white"
        >
          <option value="">중분류 전체</option>
          {Object.keys(USG_TREE).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={local.usg_scls}
          onChange={(e) => setLocal({ ...local, usg_scls: e.target.value })}
          disabled={!local.usg_mcls}
          className="text-xs border border-[#d3d1c7] rounded px-2 py-1.5 bg-white disabled:opacity-40"
        >
          <option value="">소분류 전체</option>
          {sclsOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
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

      {/* 수의계약 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[#3d3d3a]">수의계약</label>
        <div className="flex gap-2">
          {([null, "Y", "N"] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => setLocal({ ...local, pvct: val })}
              className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                local.pvct === val
                  ? "bg-[#185fa5] text-white border-[#185fa5]"
                  : "bg-white text-[#3d3d3a] border-[#d3d1c7] hover:border-[#185fa5] hover:text-[#185fa5]"
              }`}
            >
              {val === null ? "전체" : val === "Y" ? "가능" : "불가능"}
            </button>
          ))}
        </div>
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
      <div className="flex flex-col gap-2 mt-2">
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
