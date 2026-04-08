"use client";

import { useState } from "react";
import Link from "next/link";
import type { AnalyticsScores, ScoreWeights } from "@/types/analytics";

interface Props {
  data: AnalyticsScores | null;
  loading: boolean;
  weights: ScoreWeights;
  onWeightsChange: (w: ScoreWeights) => void;
}

function ScoreBar({
  breakdown,
}: {
  breakdown: { ratio: number; fail: number; location: number };
}) {
  const total = breakdown.ratio + breakdown.fail + breakdown.location;
  if (total === 0) return null;

  return (
    <div
      className="flex h-4 w-24 rounded overflow-hidden"
      title={`감정가율: ${breakdown.ratio} | 유찰: ${breakdown.fail} | 입지: ${breakdown.location}`}
    >
      <div
        style={{ width: `${(breakdown.ratio / total) * 100}%` }}
        className="bg-blue-500"
      />
      <div
        style={{ width: `${(breakdown.fail / total) * 100}%` }}
        className="bg-orange-400"
      />
      <div
        style={{ width: `${(breakdown.location / total) * 100}%` }}
        className="bg-green-500"
      />
    </div>
  );
}

export default function Leaderboard({
  data,
  loading,
  weights,
  onWeightsChange,
}: Props) {
  const [showWeights, setShowWeights] = useState(false);
  const [local, setLocal] = useState(weights);

  function handleSlider(key: keyof ScoreWeights, val: number) {
    const updated = { ...local, [key]: val };
    const others = (Object.keys(updated) as (keyof ScoreWeights)[]).filter(
      (k) => k !== key
    );
    const othersSum = others.reduce((s, k) => s + updated[k], 0);
    if (othersSum > 0) {
      const scale = (1 - val) / othersSum;
      for (const k of others) {
        updated[k] = Math.round(updated[k] * scale * 100) / 100;
      }
    }
    setLocal(updated);
  }

  function applyWeights() {
    onWeightsChange(local);
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">투자 스코어보드</h2>
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="text-sm text-[#185fa5] hover:underline"
        >
          {showWeights ? "가중치 닫기" : "커스텀 가중치"}
        </button>
      </div>

      {showWeights && (
        <div className="bg-gray-50 border border-[#d3d1c7] rounded-lg p-4 space-y-3">
          {[
            {
              key: "ratio" as const,
              label: "감정가율",
              color: "bg-blue-500",
            },
            {
              key: "fail" as const,
              label: "유찰 횟수",
              color: "bg-orange-400",
            },
            {
              key: "location" as const,
              label: "입지 프리미엄",
              color: "bg-green-500",
            },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm w-24">{label}</span>
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={local[key]}
                onChange={(e) =>
                  handleSlider(key, parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <span className="text-sm w-12 text-right">
                {(local[key] * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          <button
            onClick={applyWeights}
            className="px-4 py-1.5 text-sm bg-[#185fa5] text-white rounded-md hover:bg-[#134d88] transition-colors"
          >
            적용
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          스코어 계산 중...
        </div>
      ) : (
        <div className="bg-white border border-[#d3d1c7] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-[#d3d1c7]">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">물건명</th>
                <th className="px-3 py-2 text-left">지역</th>
                <th className="px-3 py-2 text-left">용도</th>
                <th className="px-3 py-2 text-right">감정가율</th>
                <th className="px-3 py-2 text-right">유찰</th>
                <th className="px-3 py-2 text-right">점수</th>
                <th className="px-3 py-2 text-center">구성</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.cltr_mng_no}
                  className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/items/${item.cltr_mng_no}`}
                      className="text-[#185fa5] hover:underline line-clamp-1"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.region}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {item.usage_type}
                  </td>
                  <td className="px-3 py-2 text-right">{item.ratio_pct}%</td>
                  <td className="px-3 py-2 text-right">
                    {item.fail_count}회
                  </td>
                  <td className="px-3 py-2 text-right font-bold">
                    {item.score}
                  </td>
                  <td className="px-3 py-2 flex justify-center">
                    <ScoreBar breakdown={item.score_breakdown} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          감정가율
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
          유찰 횟수
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          입지
        </span>
      </div>
    </div>
  );
}
