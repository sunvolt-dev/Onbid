export interface AnalyticsSummary {
  total_items: number;
  total_delta: number | null;
  by_region: { region: string; count: number; avg_ratio: number }[];
  by_usage_type: { usage_type: string; count: number; avg_ratio: number }[];
  ratio_distribution: { bucket: string; count: number }[];
  top_scored: {
    cltr_mng_no: string;
    name: string;
    score: number;
    ratio_pct: number;
    region: string;
  }[];
}

export interface TrendDataPoint {
  date: string;
  total_count: number;
  avg_ratio: number | null;
  by_region: {
    region: string;
    usage_type: string;
    count: number;
    avg_ratio: number | null;
  }[];
}

export interface AnalyticsTrends {
  period: string;
  data: TrendDataPoint[];
}

export interface ScoredItem {
  cltr_mng_no: string;
  name: string;
  region: string;
  usage_type: string;
  ratio_pct: number;
  fail_count: number;
  lowst_bid_prc: number;
  apsl_evl_amt: number;
  cltr_bid_end_dt: string;
  score: number;
  score_breakdown: {
    ratio: number;
    fail: number;
    location: number;
  };
}

export interface AnalyticsScores {
  weights: { ratio: number; fail: number; location: number };
  normalization: { ratio_min: number | null; ratio_max: number | null };
  items: ScoredItem[];
}

export type TrendPeriod = "7d" | "30d" | "90d";

export interface ScoreWeights {
  ratio: number;
  fail: number;
  location: number;
}
