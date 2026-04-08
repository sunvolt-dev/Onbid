"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSummary, useTrends, useScores } from "@/hooks/useAnalytics";
import MarketOverview from "@/components/analytics/MarketOverview";
import TrendCharts from "@/components/analytics/TrendCharts";
import Leaderboard from "@/components/analytics/Leaderboard";
import AnalyticsFilters, {
  type AnalyticsFilterState,
} from "@/components/analytics/AnalyticsFilters";
import type { AnalyticsSummary, TrendPeriod } from "@/types/analytics";

export default function AnalyticsPage() {
  const summary = useSummary();
  const trends = useTrends();
  const scores = useScores();

  const [filter, setFilter] = useState<AnalyticsFilterState>({
    regions: [],
    usageTypes: [],
  });

  useEffect(() => {
    summary.load();
    trends.load();
    scores.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePeriodChange(p: TrendPeriod) {
    trends.load(p);
  }

  const filteredSummary = useMemo((): AnalyticsSummary | null => {
    if (!summary.data) return null;
    const d = summary.data;
    return {
      ...d,
      by_region:
        filter.regions.length > 0
          ? d.by_region.filter((r) => filter.regions.includes(r.region))
          : d.by_region,
      by_usage_type:
        filter.usageTypes.length > 0
          ? d.by_usage_type.filter((u) =>
              filter.usageTypes.includes(u.usage_type)
            )
          : d.by_usage_type,
    };
  }, [summary.data, filter]);

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#d3d1c7] bg-white p-4 space-y-6">
        <Link
          href="/"
          className="text-sm text-[#185fa5] hover:underline block mb-4"
        >
          &larr; 물건 목록
        </Link>
        <AnalyticsFilters filter={filter} onChange={setFilter} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-8 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">분석 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">
            시장 현황, 트렌드, 투자 스코어
          </p>
        </div>

        {summary.error && (
          <div className="text-red-500 text-sm">
            데이터를 불러오지 못했습니다: {summary.error}
          </div>
        )}

        {filteredSummary && <MarketOverview data={filteredSummary} />}

        <TrendCharts
          data={trends.data}
          period={trends.period}
          loading={trends.loading}
          onPeriodChange={handlePeriodChange}
        />

        <Leaderboard
          data={scores.data}
          loading={scores.loading}
          weights={scores.weights}
          onWeightsChange={(w) => scores.load(w)}
        />
      </main>
    </div>
  );
}
