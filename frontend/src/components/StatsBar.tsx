"use client";

import { useEffect, useState } from "react";
import { fetchStats } from "@/api";
import type { Stats } from "@/types";

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!stats) {
    return (
      <div className="h-10 bg-[#faf9f7] border border-[#e8e6df] rounded-lg animate-pulse" />
    );
  }

  const below60 = stats.by_region.reduce((acc, _r) => acc, 0);
  void below60;

  return (
    <div className="flex items-center gap-3 bg-[#faf9f7] border border-[#e8e6df] rounded-lg px-4 py-2 text-sm">
      <span className="text-[#5f5e5a] text-xs">통계</span>
      <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-medium">
        60% 미만
        <span className="font-bold">{stats.by_region.length > 0 ? "-" : "-"}</span>건
      </span>
      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-medium">
        60~70%
        <span className="font-bold">-</span>건
      </span>
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 text-xs font-medium">
        전체
        <span className="font-bold">{stats.total}</span>건
      </span>
      <span className="ml-auto text-xs text-[#5f5e5a]">
        수의계약 가능{" "}
        <span className="font-semibold text-[#185fa5]">{stats.pvct_count}</span>건
      </span>
    </div>
  );
}
