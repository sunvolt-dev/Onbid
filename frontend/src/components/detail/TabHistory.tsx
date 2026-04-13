"use client";

import { useEffect, useState } from "react";
import { fetchItemHistory } from "@/api";
import type { BidQual } from "@/types";
import { fmtAmt } from "@/utils/format";

interface Props {
  id: string;
  apslEvlAmt: number;
}

export default function TabHistory({ id, apslEvlAmt }: Props) {
  const [quals, setQuals] = useState<BidQual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchItemHistory(id)
      .then(setQuals)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="text-sm text-text-4 animate-pulse py-8 text-center">로딩 중...</div>;
  }
  if (error) {
    return <div className="text-sm text-hot-fg py-8 text-center">입찰 이력을 불러올 수 없습니다.</div>;
  }

  const firstMin = quals.length > 0 ? Math.max(...quals.map((q) => q.min_bd_prc)) : null;
  const lastMin = quals.length > 0 ? quals[quals.length - 1].min_bd_prc : null;
  const dropPct = firstMin && lastMin ? (((firstMin - lastMin) / firstMin) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* 회차 테이블 */}
      <div className="flex-1">
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
                        <span className="bg-mid-bg text-mid-fg rounded px-2 py-0.5">
                          {result}
                        </span>
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
      </div>

      {/* 요약 카드 */}
      <div className="md:w-56 shrink-0 flex flex-col gap-3">
        <div className="bg-surface shadow-card rounded-xl p-4">
          <p className="text-xs font-semibold text-text-2 mb-3">가격 추이 요약</p>
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-[11px] text-text-4">감정평가액</p>
              <p className="text-sm font-semibold text-text-1 tabular-nums">{fmtAmt(apslEvlAmt)}</p>
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
            {dropPct && (
              <div className="mt-1 pt-2 border-t border-border">
                <p className="text-[11px] text-text-4">하락률</p>
                <p className="text-base font-bold text-hot-fg tabular-nums">-{dropPct}%</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
