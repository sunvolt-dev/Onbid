"use client";

import { useEffect, useState } from "react";
import {
  useSummary,
  useTrends,
  useFlow,
  useDiscountByRegion,
} from "@/hooks/useAnalytics";
import MarketPulseStrip from "@/components/analytics/MarketPulseStrip";
import MarketDynamics from "@/components/analytics/MarketDynamics";
import SegmentExplorer from "@/components/analytics/SegmentExplorer";
import AnalyticsFilters, {
  type AnalyticsFilterState,
} from "@/components/analytics/AnalyticsFilters";
import PageWithSidebar from "@/components/layout/PageWithSidebar";
import type { TrendPeriod } from "@/types/analytics";

export default function AnalyticsPage() {
  const summary = useSummary();
  const trends = useTrends();
  const flow = useFlow();
  const discount = useDiscountByRegion();

  const [filter, setFilter] = useState<AnalyticsFilterState>({
    regions: [],
    usageTypes: [],
  });

  useEffect(() => {
    summary.load();
    trends.load();
    flow.load();
    discount.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePeriodChange(p: TrendPeriod) {
    trends.load(p);
    flow.load(p);
  }

  const anyError = summary.error || trends.error || flow.error || discount.error;

  return (
    <PageWithSidebar sidebar={<AnalyticsFilters filter={filter} onChange={setFilter} />}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-text-1 tracking-tight">
          분석 대시보드
        </h1>
        <p className="text-sm text-text-3 mt-1">시장 현황, 동향, 세부 분포</p>
      </div>

      {anyError && (
        <div className="text-hot-fg text-sm mt-4">
          일부 데이터를 불러오지 못했습니다: {anyError}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8">
        <MarketPulseStrip
          filter={filter}
          summary={summary.data}
          flow={flow.data}
          discount={discount.data}
        />

        <MarketDynamics
          flow={flow.data}
          trends={trends.data}
          period={trends.period}
          flowLoading={flow.loading}
          trendsLoading={trends.loading}
          onPeriodChange={handlePeriodChange}
        />

        <SegmentExplorer
          filter={filter}
          summary={summary.data}
          discount={discount.data}
        />
      </div>
    </PageWithSidebar>
  );
}
