"use client";

import { useEffect, useState, useMemo } from "react";
import { useSummary, useTrends, useScores } from "@/hooks/useAnalytics";
import MarketOverview from "@/components/analytics/MarketOverview";
import TrendCharts from "@/components/analytics/TrendCharts";
import Leaderboard from "@/components/analytics/Leaderboard";
import AnalyticsFilters, {
  type AnalyticsFilterState,
} from "@/components/analytics/AnalyticsFilters";
import PageWithSidebar from "@/components/layout/PageWithSidebar";
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
    <PageWithSidebar sidebar={<AnalyticsFilters filter={filter} onChange={setFilter} />}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-text-1 tracking-tight">분석 대시보드</h1>
        <p className="text-sm text-text-3 mt-1">시장 현황, 트렌드, 투자 스코어</p>
      </div>

      {summary.error && (
        <div className="text-hot-fg text-sm mt-4">
          데이터를 불러오지 못했습니다: {summary.error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8">
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
      </div>
    </PageWithSidebar>
  );
}
