import { API_BASE } from "@/utils/api";
import type {
  AnalyticsSummary,
  AnalyticsTrends,
  AnalyticsScores,
  TrendPeriod,
  ScoreWeights,
} from "@/types/analytics";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/api/analytics/summary`);
  if (!res.ok) throw new Error("분석 요약 데이터 로드 실패");
  return res.json();
}

export async function fetchAnalyticsTrends(
  period: TrendPeriod = "30d"
): Promise<AnalyticsTrends> {
  const res = await fetch(`${API_BASE}/api/analytics/trends?period=${period}`);
  if (!res.ok) throw new Error("트렌드 데이터 로드 실패");
  return res.json();
}

export async function fetchAnalyticsScores(
  weights?: ScoreWeights,
  limit: number = 50
): Promise<AnalyticsScores> {
  const params = new URLSearchParams();
  if (weights) {
    params.set("w_ratio", String(weights.ratio));
    params.set("w_fail", String(weights.fail));
    params.set("w_location", String(weights.location));
  }
  params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/api/analytics/scores?${params}`);
  if (!res.ok) throw new Error("투자 점수 데이터 로드 실패");
  return res.json();
}
