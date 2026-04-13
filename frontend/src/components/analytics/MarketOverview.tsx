"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import type { AnalyticsSummary } from "@/types/analytics";

const COLORS = [
  "var(--color-primary)",
  "var(--color-primary-hover)",
  "var(--color-ok-fg)",
  "var(--color-mid-fg)",
  "var(--color-hot-fg)",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#0891b2",
  "#a855f7",
];

interface Props {
  data: AnalyticsSummary;
}

export default function MarketOverview({ data }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">시장 현황</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Region bar chart */}
        <div className="bg-surface shadow-card rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">지역별 물건 수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={data.by_region}
              layout="vertical"
              margin={{ left: 40 }}
            >
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="region"
                width={50}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => [`${value}건`, "물건 수"]}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ratio histogram */}
        <div className="bg-surface shadow-card rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">감정가율 분포</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.ratio_distribution}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${value}건`, "물건 수"]}
              />
              <Bar dataKey="count" fill="var(--color-primary-hover)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usage type donut */}
        <div className="bg-surface shadow-card rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">용도별 비율</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.by_usage_type}
                dataKey="count"
                nameKey="usage_type"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={(props: PieLabelRenderProps) => {
                  const name = (props as PieLabelRenderProps & { usage_type?: string }).usage_type ?? "";
                  const pct = typeof props.percent === "number" ? props.percent : 0;
                  return `${name} ${(pct * 100).toFixed(0)}%`;
                }}
                labelLine={false}
              >
                {data.by_usage_type.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value}건`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
