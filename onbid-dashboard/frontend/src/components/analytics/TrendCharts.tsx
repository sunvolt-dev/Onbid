"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { AnalyticsTrends, TrendPeriod } from "@/types/analytics";

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "90d", label: "90일" },
];

interface Props {
  data: AnalyticsTrends | null;
  period: TrendPeriod;
  loading: boolean;
  onPeriodChange: (p: TrendPeriod) => void;
}

export default function TrendCharts({
  data,
  period,
  loading,
  onPeriodChange,
}: Props) {
  const chartData = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">트렌드</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p.value
                  ? "bg-[#185fa5] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          트렌드 데이터 로딩 중...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          데이터가 아직 충분하지 않습니다. 스냅샷이 쌓이면 트렌드를 볼 수
          있습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total count trend */}
          <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">물건 수 추이</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(d: string) => d}
                  formatter={(value: number) => [`${value}건`, "물건 수"]}
                />
                <Line
                  type="monotone"
                  dataKey="total_count"
                  stroke="#185fa5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg ratio trend */}
          <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">평균 감정가율 추이</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis domain={["auto", "auto"]} unit="%" />
                <Tooltip
                  labelFormatter={(d: string) => d}
                  formatter={(value: number) => [
                    `${value}%`,
                    "평균 감정가율",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avg_ratio"
                  stroke="#e55039"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
