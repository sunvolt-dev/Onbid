"use client";

import { useState, useCallback } from "react";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsTrends,
  fetchAnalyticsScores,
} from "@/api/analytics";
import type {
  AnalyticsSummary,
  AnalyticsTrends,
  AnalyticsScores,
  TrendPeriod,
  ScoreWeights,
} from "@/types/analytics";

const DEFAULT_WEIGHTS: ScoreWeights = { ratio: 0.4, fail: 0.3, location: 0.3 };

export function useSummary() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAnalyticsSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}

export function useTrends() {
  const [data, setData] = useState<AnalyticsTrends | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TrendPeriod>("30d");

  const load = useCallback(async (p?: TrendPeriod) => {
    const target = p ?? period;
    setLoading(true);
    setError(null);
    setPeriod(target);
    try {
      setData(await fetchAnalyticsTrends(target));
    } catch (e) {
      setError(e instanceof Error ? e.message : "트렌드 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [period]);

  return { data, loading, error, period, load };
}

export function useScores() {
  const [data, setData] = useState<AnalyticsScores | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);

  const load = useCallback(async (w?: ScoreWeights, limit = 50) => {
    const target = w ?? weights;
    setLoading(true);
    setError(null);
    setWeights(target);
    try {
      setData(await fetchAnalyticsScores(target, limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : "점수 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [weights]);

  return { data, loading, error, weights, load };
}
