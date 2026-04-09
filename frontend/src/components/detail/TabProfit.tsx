"use client";

import { useEffect, useState } from "react";
import type { BidItem, MarketPriceResponse } from "@/types";
import { fetchMarketPrice } from "@/api";
import { fmtAmt, fmtKRW } from "@/utils/format";

interface Props {
  item: BidItem;
}

const STORAGE_KEY_PREFIX = "onbid_memo_";

const TIER_LABELS: Record<number, string> = {
  0: "같은 건물 (지번 매칭)",
  1: "같은 읍면동 + 같은 건물 + 유사면적",
  2: "같은 읍면동 + 유사면적",
  3: "같은 시군구 + 유사면적",
};

const STATUS_MSG: Record<string, { icon: string; title: string; desc: string }> = {
  no_mapping:    { icon: "🗺️", title: "법정동코드 매핑 없음",           desc: "해당 지역의 법정동코드를 찾을 수 없습니다." },
  not_supported: { icon: "🏢", title: "미지원 용도",                     desc: "현재 오피스텔과 업무시설만 시세 조회를 지원합니다." },
  no_data:       { icon: "📭", title: "실거래 데이터 없음",             desc: "최근 6개월간 유사 조건의 거래 내역이 없습니다." },
  api_error:     { icon: "⚠️", title: "API 오류",                       desc: "국토교통부 API 호출 중 오류가 발생했습니다." },
};

export default function TabProfit({ item }: Props) {
  const storageKey = `${STORAGE_KEY_PREFIX}${item.cltr_mng_no}`;
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);
  const [market, setMarket] = useState<MarketPriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setMemo(stored);
  }, [storageKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMarketPrice(item.cltr_mng_no)
      .then(setMarket)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [item.cltr_mng_no]);

  function saveMemo() {
    localStorage.setItem(storageKey, memo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 시세 비교 섹션 */}
      {loading ? (
        <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-8 text-center">
          <div className="animate-pulse text-sm text-[#9c9a92]">국토부 실거래가 조회 중...</div>
        </div>
      ) : error ? (
        <StatusBanner icon="⚠️" title="조회 실패" desc={error} />
      ) : market && market.status === "ok" ? (
        <MarketSection market={market} item={item} />
      ) : market && STATUS_MSG[market.status] ? (
        <StatusBanner {...STATUS_MSG[market.status]} extra={market.message} />
      ) : null}

      {/* 기준 정보 */}
      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#1a1a18] mb-3">현재 물건 기준값</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-[11px] text-[#9c9a92]">감정평가액</p>
            <p className="text-base font-bold text-[#1a1a18] mt-0.5">{fmtAmt(item.apsl_evl_amt)}</p>
            <p className="text-[11px] text-[#9c9a92] mt-0.5">{fmtKRW(item.apsl_evl_amt)}</p>
          </div>
          <div className="text-center border-x border-[#e8e6df]">
            <p className="text-[11px] text-[#9c9a92]">최저입찰가</p>
            <p className="text-base font-bold text-[#185fa5] mt-0.5">{fmtAmt(item.lowst_bid_prc)}</p>
            <p className="text-[11px] text-[#9c9a92] mt-0.5">{fmtKRW(item.lowst_bid_prc)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-[#9c9a92]">감정가 대비</p>
            <p
              className={`text-base font-bold mt-0.5 ${
                item.ratio_pct < 60 ? "text-red-600" : item.ratio_pct < 70 ? "text-amber-600" : "text-green-600"
              }`}
            >
              {item.ratio_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#1a1a18] mb-2">수익성 분석 메모</p>
        <p className="text-xs text-[#9c9a92] mb-3">인근 시세, 예상 임대수익 등 투자 판단 메모를 기록하세요 (로컬 저장)</p>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예) 인근 오피스텔 시세 약 ○억, 월세 ○만원 예상, 수익률 약 ○%..."
          rows={6}
          className="w-full text-xs border border-[#d3d1c7] rounded-lg p-3 resize-none focus:outline-none focus:border-[#185fa5]"
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          {saved && <span className="text-xs text-green-600">저장됨</span>}
          <button
            onClick={saveMemo}
            className="text-xs bg-[#185fa5] text-white px-3 py-1.5 rounded font-medium hover:bg-[#14508f]"
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
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">{title}</p>
          <p className="text-xs text-amber-700 mt-1">{desc}</p>
          {extra && <p className="text-xs text-amber-600 mt-1">{extra}</p>}
        </div>
      </div>
    </div>
  );
}


function MarketSection({ market, item }: { market: MarketPriceResponse; item: BidItem }) {
  const { summary, comparison, transactions, match_tier, match_count } = market;

  return (
    <>
      {/* 시세 비교 요약 카드 */}
      <div className="bg-white border border-[#185fa5]/20 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#1a1a18]">실거래가 기반 시세 비교</p>
          <span className="text-[10px] text-[#9c9a92] bg-[#f5f4f0] px-2 py-0.5 rounded-full">
            {TIER_LABELS[match_tier ?? 0] ?? ""} / {match_count}건
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* 추정 시세 */}
          <div className="text-center">
            <p className="text-[11px] text-[#9c9a92]">추정 시세</p>
            <p className="text-base font-bold text-[#1a1a18] mt-0.5">
              {fmtAmt(summary?.estimated_market_price_won)}
            </p>
            <p className="text-[10px] text-[#9c9a92] mt-0.5">
              {summary?.avg_unit_price ? `${summary.avg_unit_price.toFixed(1)}만/㎡` : "-"}
            </p>
          </div>

          {/* 최저입찰가 */}
          <div className="text-center border-x border-[#e8e6df]">
            <p className="text-[11px] text-[#9c9a92]">최저입찰가</p>
            <p className="text-base font-bold text-[#185fa5] mt-0.5">
              {fmtAmt(item.lowst_bid_prc)}
            </p>
          </div>

          {/* 시세 대비 할인율 */}
          <div className="text-center">
            <p className="text-[11px] text-[#9c9a92]">시세 대비</p>
            {comparison ? (
              <>
                <p className={`text-base font-bold mt-0.5 ${
                  comparison.discount_from_market_pct > 30
                    ? "text-red-600"
                    : comparison.discount_from_market_pct > 15
                    ? "text-amber-600"
                    : "text-green-600"
                }`}>
                  -{comparison.discount_from_market_pct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-[#9c9a92] mt-0.5">
                  시세의 {comparison.market_vs_bid_pct.toFixed(1)}%
                </p>
              </>
            ) : (
              <p className="text-base font-bold text-[#9c9a92] mt-0.5">-</p>
            )}
          </div>
        </div>

        {summary?.latest_deal && (
          <p className="text-[10px] text-[#9c9a92] text-right">
            최근 거래: {summary.latest_deal}
          </p>
        )}
      </div>

      {/* 실거래 내역 테이블 */}
      {transactions.length > 0 && (
        <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5">
          <p className="text-sm font-semibold text-[#1a1a18] mb-3">
            인근 실거래 내역
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#9c9a92] border-b border-[#e8e6df]">
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
                  <tr key={i} className="border-b border-[#f0efe9] last:border-0">
                    <td className="py-2 text-[#6b6960]">{tx.deal_date}</td>
                    <td className="py-2 text-[#1a1a18] max-w-[120px] truncate">{tx.bldg_nm || "-"}</td>
                    <td className="py-2 text-right text-[#6b6960]">
                      {tx.exclu_use_ar ? `${tx.exclu_use_ar.toFixed(1)}㎡` : "-"}
                    </td>
                    <td className="py-2 text-right font-medium text-[#1a1a18]">
                      {tx.deal_amount ? `${tx.deal_amount.toLocaleString()}만` : "-"}
                    </td>
                    <td className="py-2 text-right text-[#6b6960]">{tx.floor || "-"}</td>
                    <td className="py-2 text-right text-[#9c9a92]">
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
