// frontend/src/components/detail/TabPricing.tsx
"use client";

import { useEffect, useState } from "react";
import { fetchItemHistory } from "@/api";
import { useMarketPrice } from "@/hooks/useMarketPrice";
import type { BidItem, BidQual, MarketPriceResponse } from "@/types";
import { fmtAmt } from "@/utils/format";
import DecisionBanner, { type DecisionStatus } from "./DecisionBanner";

const STORAGE_KEY_PREFIX = "onbid_memo_";

const TIER_LABELS: Record<number, string> = {
  0: "같은 건물 (지번 매칭)",
  1: "같은 읍면동 + 같은 건물 + 유사면적",
  2: "같은 읍면동 + 유사면적",
  3: "같은 시군구 + 유사면적",
};

const STATUS_MSG: Record<string, { icon: string; title: string; desc: string }> = {
  no_mapping:    { icon: "🗺️", title: "법정동코드 매핑 없음",   desc: "해당 지역의 법정동코드를 찾을 수 없습니다." },
  not_supported: { icon: "🏢", title: "미지원 용도",             desc: "현재 오피스텔과 업무시설만 시세 조회를 지원합니다." },
  no_data:       { icon: "📭", title: "실거래 데이터 없음",     desc: "최근 6개월간 유사 조건의 거래 내역이 없습니다." },
  api_error:     { icon: "⚠️", title: "API 오류",               desc: "국토교통부 API 호출 중 오류가 발생했습니다." },
};

interface Props {
  item: BidItem;
}

export default function TabPricing({ item }: Props) {
  const [quals, setQuals] = useState<BidQual[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histError, setHistError] = useState(false);

  const { market, loading: marketLoading, error: marketError } = useMarketPrice(item.cltr_mng_no);

  const storageKey = `${STORAGE_KEY_PREFIX}${item.cltr_mng_no}`;
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchItemHistory(item.cltr_mng_no)
      .then(setQuals)
      .catch(() => setHistError(true))
      .finally(() => setHistLoading(false));
  }, [item.cltr_mng_no]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setMemo(stored);
  }, [storageKey]);

  function saveMemo() {
    localStorage.setItem(storageKey, memo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const firstMin = quals.length > 0 ? Math.max(...quals.map((q) => q.min_bd_prc)) : null;
  const lastMin = quals.length > 0 ? quals[quals.length - 1].min_bd_prc : null;
  const dropPct = firstMin && lastMin ? ((firstMin - lastMin) / firstMin) * 100 : null;

  // DecisionBanner status 결정
  const discount = market?.comparison?.discount_from_market_pct ?? null;
  let status: DecisionStatus = "ok";
  let bannerText = `감정가의 ${item.ratio_pct.toFixed(1)}%`;
  if (discount !== null) {
    bannerText += ` · 시세 대비 ${discount > 0 ? "-" : "+"}${Math.abs(discount).toFixed(1)}% ${discount > 0 ? "저렴" : "비쌈"}`;
    if (discount > 30) status = "ok";
    else if (discount > 15) status = "warn";
    else status = "danger";
  } else if (item.ratio_pct < 60) {
    status = "ok";
  } else if (item.ratio_pct < 70) {
    status = "warn";
  } else {
    status = "danger";
  }
  if (dropPct !== null && dropPct > 0) {
    bannerText = `${quals.length}회차 유찰 후 ${bannerText}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <DecisionBanner status={status}>{bannerText}</DecisionBanner>

      {/* === 1. 유찰 회차 테이블 + 가격 추이 === */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-1 mb-3">유찰 회차 내역</p>
          {histLoading ? (
            <div className="text-sm text-text-4 animate-pulse py-8 text-center">로딩 중...</div>
          ) : histError ? (
            <div className="text-sm text-hot-fg py-8 text-center">입찰 이력을 불러올 수 없습니다.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg bg-surface shadow-card">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-muted border-b border-border">
                    <th className="text-left px-3 py-2.5 text-text-3 font-semibold">회차</th>
                    <th className="text-left px-3 py-2.5 text-text-3 font-semibold">입찰기간</th>
                    <th className="text-right px-3 py-2.5 text-text-3 font-semibold">최저가</th>
                    <th className="text-right px-3 py-2.5 text-text-3 font-semibold">보증금</th>
                    <th className="text-center px-3 py-2.5 text-text-3 font-semibold">결과</th>
                  </tr>
                </thead>
                <tbody>
                  {quals.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-text-4">
                        입찰 회차 정보가 없습니다
                      </td>
                    </tr>
                  )}
                  {quals.map((q) => {
                    const totalFail = q.hist.reduce((acc, h) => acc + h.prv_bid_fail_cnt, 0);
                    const result = totalFail > 0 ? `유찰 ${totalFail}회` : "-";
                    return (
                      <tr key={q.id} className="border-b border-border hover:bg-surface-muted">
                        <td className="px-3 py-2 text-text-1 font-medium">{q.bid_seq}회차</td>
                        <td className="px-3 py-2 text-text-3 whitespace-nowrap">
                          {q.bid_strt_dttm} ~ {q.bid_end_dttm}
                        </td>
                        <td className="px-3 py-2 text-right text-primary font-medium tabular-nums">
                          {fmtAmt(q.min_bd_prc)}
                        </td>
                        <td className="px-3 py-2 text-right text-text-3 tabular-nums">
                          {fmtAmt(q.bid_grnt_prc)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {totalFail > 0 ? (
                            <span className="bg-mid-bg text-mid-fg rounded px-2 py-0.5">{result}</span>
                          ) : (
                            <span className="text-text-4">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="md:w-56 shrink-0 flex flex-col gap-3">
          <div className="bg-surface shadow-card rounded-xl p-4">
            <p className="text-xs font-semibold text-text-2 mb-3">가격 추이 요약</p>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[11px] text-text-4">감정평가액</p>
                <p className="text-sm font-semibold text-text-1 tabular-nums">{fmtAmt(item.apsl_evl_amt)}</p>
              </div>
              {firstMin && (
                <div>
                  <p className="text-[11px] text-text-4">최초 최저입찰가</p>
                  <p className="text-sm font-semibold text-text-1 tabular-nums">{fmtAmt(firstMin)}</p>
                </div>
              )}
              {lastMin && (
                <div>
                  <p className="text-[11px] text-text-4">현재 최저입찰가</p>
                  <p className="text-sm font-semibold text-primary tabular-nums">{fmtAmt(lastMin)}</p>
                </div>
              )}
              {dropPct !== null && dropPct > 0 && (
                <div className="mt-1 pt-2 border-t border-border">
                  <p className="text-[11px] text-text-4">하락률</p>
                  <p className="text-base font-bold text-hot-fg tabular-nums">-{dropPct.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === 2. 국토부 실거래가 시세 비교 === */}
      {marketLoading ? (
        <div className="bg-surface shadow-card rounded-xl p-8 text-center">
          <div className="animate-pulse text-sm text-text-4">국토부 실거래가 조회 중...</div>
        </div>
      ) : marketError ? (
        <StatusBanner icon="⚠️" title="조회 실패" desc={marketError} />
      ) : market && market.status === "ok" ? (
        <MarketSection market={market} item={item} />
      ) : market && STATUS_MSG[market.status] ? (
        <StatusBanner {...STATUS_MSG[market.status]} extra={market.message} />
      ) : null}

      {/* === 3. 수익성 메모 === */}
      <div className="bg-surface shadow-card rounded-xl p-5">
        <p className="text-sm font-semibold text-text-1 mb-2">수익성 분석 메모</p>
        <p className="text-xs text-text-4 mb-3">인근 시세, 예상 임대수익 등 투자 판단 메모를 기록하세요 (로컬 저장)</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예) 인근 오피스텔 시세 약 ○억, 월세 ○만원 예상, 수익률 약 ○%..."
          rows={6}
          className="w-full text-xs border border-border-strong rounded-lg p-3 resize-none focus:outline-none focus:border-primary"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          {saved && <span className="text-xs text-ok-fg">저장됨</span>}
          <button
            onClick={saveMemo}
            className="text-xs bg-primary text-primary-fg px-3 py-1.5 rounded font-medium hover:bg-primary-hover"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ icon, title, desc, extra }: { icon: string; title: string; desc: string; extra?: string }) {
  return (
    <div className="bg-mid-bg rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-mid-fg">{title}</p>
          <p className="text-xs text-mid-fg/90 mt-1">{desc}</p>
          {extra && <p className="text-xs text-mid-fg/70 mt-1">{extra}</p>}
        </div>
      </div>
    </div>
  );
}

function MarketSection({ market, item }: { market: MarketPriceResponse; item: BidItem }) {
  const { summary, comparison, transactions, match_tier, match_count } = market;

  return (
    <>
      <div className="bg-surface shadow-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-text-1">실거래가 기반 시세 비교</p>
          <span className="text-[10px] text-text-4 bg-surface-muted px-2 py-0.5 rounded-full">
            {TIER_LABELS[match_tier ?? 0] ?? ""} / {match_count}건
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-[11px] text-text-4">추정 시세</p>
            <p className="text-base font-bold text-text-1 mt-0.5 tabular-nums">
              {fmtAmt(summary?.estimated_market_price_won)}
            </p>
            <p className="text-[10px] text-text-4 mt-0.5">
              {summary?.avg_unit_price ? `${summary.avg_unit_price.toFixed(1)}만/㎡` : "-"}
            </p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-[11px] text-text-4">최저입찰가</p>
            <p className="text-base font-bold text-primary mt-0.5 tabular-nums">
              {fmtAmt(item.lowst_bid_prc)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-text-4">시세 대비</p>
            {comparison ? (
              <>
                <p className={`text-base font-bold mt-0.5 tabular-nums ${
                  comparison.discount_from_market_pct > 30
                    ? "text-hot-fg"
                    : comparison.discount_from_market_pct > 15
                    ? "text-mid-fg"
                    : "text-ok-fg"
                }`}>
                  -{comparison.discount_from_market_pct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-text-4 mt-0.5">
                  시세의 {comparison.market_vs_bid_pct.toFixed(1)}%
                </p>
              </>
            ) : (
              <p className="text-base font-bold text-text-4 mt-0.5">-</p>
            )}
          </div>
        </div>

        {summary?.latest_deal && (
          <p className="text-[10px] text-text-4 text-right">최근 거래: {summary.latest_deal}</p>
        )}
      </div>

      {transactions.length > 0 && (
        <div className="bg-surface shadow-card rounded-xl p-5">
          <p className="text-sm font-semibold text-text-1 mb-3">인근 실거래 내역</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-4 border-b border-border">
                  <th className="text-left py-2 font-medium">계약일</th>
                  <th className="text-left py-2 font-medium">건물명</th>
                  <th className="text-right py-2 font-medium">전용면적</th>
                  <th className="text-right py-2 font-medium">거래금액</th>
                  <th className="text-right py-2 font-medium">층</th>
                  <th className="text-right py-2 font-medium">단가</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 text-text-3">{tx.deal_date}</td>
                    <td className="py-2 text-text-1 max-w-[120px] truncate">{tx.bldg_nm || "-"}</td>
                    <td className="py-2 text-right text-text-3 tabular-nums">
                      {tx.exclu_use_ar ? `${tx.exclu_use_ar.toFixed(1)}㎡` : "-"}
                    </td>
                    <td className="py-2 text-right font-medium text-text-1 tabular-nums">
                      {tx.deal_amount ? `${tx.deal_amount.toLocaleString()}만` : "-"}
                    </td>
                    <td className="py-2 text-right text-text-3 tabular-nums">{tx.floor || "-"}</td>
                    <td className="py-2 text-right text-text-4 tabular-nums">
                      {tx.unit_price ? `${tx.unit_price.toFixed(1)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
