"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BidItem, FilterState } from "@/types";
import { fmtAmt, dLabel, daysLeft } from "@/utils/format";

const PAGE_SIZE = 50;

interface Props {
  items: BidItem[];
  filter: FilterState;
  onSortChange: (sort: FilterState["sort"]) => void;
}

function RatioPill({ ratio }: { ratio: number }) {
  const cls =
    ratio < 60
      ? "bg-hot-bg text-hot-fg"
      : ratio < 70
      ? "bg-mid-bg text-mid-fg"
      : "bg-ok-bg text-ok-fg";
  return (
    <span
      className={`inline-block ${cls} rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums`}
    >
      {ratio.toFixed(1)}%
    </span>
  );
}

function DeadlineLabel({ dt, pvct }: { dt: string; pvct: boolean }) {
  const dl = daysLeft(dt);
  const cls =
    dl < 0 ? "text-text-4" : dl <= 3 ? "text-urgent font-semibold" : "text-text-2";
  return (
    <div className={`text-xs whitespace-nowrap ${cls}`}>
      <div>{dLabel(dt)}</div>
      {pvct && (
        <span className="inline-block mt-0.5 text-[10px] bg-mid-bg text-mid-fg rounded px-1.5 py-0.5 font-semibold">
          수의계약
        </span>
      )}
    </div>
  );
}

function ratioDot(ratio: number): string {
  if (ratio < 60) return "bg-hot-fg";
  if (ratio < 70) return "bg-mid-fg";
  return "bg-transparent";
}

function isNewToday(firstCollected: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return firstCollected.slice(0, 10) === today;
}

export default function ItemTable({ items, filter, onSortChange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const prevSort = useRef(filter.sort);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPage = Number(params.get("page")) || 1;
    if (urlPage === page) return;
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [page, router]);

  useEffect(() => {
    if (prevSort.current !== filter.sort) {
      prevSort.current = filter.sort;
      setPage(1);
    }
  }, [filter.sort]);

  // 마감 지나고 수의계약도 아닌 물건은 숨김
  const visibleItems = items.filter((item) => {
    const dl = daysLeft(item.cltr_bid_end_dt);
    return !(dl < 0 && item.pvct_trgt_yn !== "Y");
  });

  const totalPages = Math.ceil(visibleItems.length / PAGE_SIZE);
  const pageItems = visibleItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortBtn = ({ val, label }: { val: FilterState["sort"]; label: string }) => (
    <button
      onClick={() => onSortChange(val)}
      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
        filter.sort === val
          ? "bg-primary text-primary-fg border-primary"
          : "bg-surface text-text-2 border-border-strong hover:border-primary hover:text-primary"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 정렬 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-3">정렬:</span>
        <SortBtn val="ratio" label="비율 ↑" />
        <SortBtn val="usbd" label="유찰횟수" />
        <SortBtn val="deadline" label="마감일" />
        <span className="ml-auto text-xs text-text-4 tabular-nums">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleItems.length)} / 총 {visibleItems.length}건
        </span>
      </div>

      {/* 빈 상태 */}
      {visibleItems.length === 0 && (
        <div className="bg-surface shadow-card rounded-lg py-12 text-center text-sm text-text-4">
          조건에 맞는 물건이 없습니다
        </div>
      )}

      {/* 데스크톱: 테이블 */}
      {visibleItems.length > 0 && (
        <div className="hidden md:block overflow-x-auto bg-surface shadow-card rounded-xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-border">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">물건번호</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3">소재지</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">용도</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">감정가</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">최저입찰가</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">감정가 대비</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3">회차</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3">유찰</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">마감일</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const dl = daysLeft(item.cltr_bid_end_dt);
                const pvct = dl < 0 && item.pvct_trgt_yn === "Y";
                return (
                  <tr
                    key={item.cltr_mng_no}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      pvct
                        ? "bg-mid-bg/30 hover:bg-mid-bg/50 border-l-2 border-l-mid-fg"
                        : "hover:bg-surface-muted"
                    }`}
                    onClick={() => router.push(`/items/${item.cltr_mng_no}`)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ratioDot(item.ratio_pct)}`} />
                        <span className="text-xs text-text-3 font-mono">{item.cltr_mng_no}</span>
                        {isNewToday(item.first_collected_at) && (
                          <span className="text-[10px] bg-new text-primary-fg rounded-sm px-1.5 py-0.5 font-bold">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm text-text-1 font-medium truncate max-w-[180px]">
                        {item.onbid_cltr_nm}
                      </div>
                      <div className="text-xs text-text-3 mt-0.5">
                        {item.lctn_sd_nm} {item.lctn_sggn_nm}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-text-3">{item.cltr_usg_mcls_nm}</div>
                      <div className="text-xs text-text-4 mt-0.5">{item.cltr_usg_scls_nm}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-text-2 tabular-nums">
                      {fmtAmt(item.apsl_evl_amt)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-primary tabular-nums">
                      {fmtAmt(item.lowst_bid_prc)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <RatioPill ratio={item.ratio_pct} />
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-text-2 tabular-nums">
                      {Number(item.pbct_nsq)}회차
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-text-2">
                      {item.usbd_nft > 0 ? (
                        <span className="bg-mid-bg text-mid-fg rounded px-1.5 py-0.5 text-xs font-semibold">
                          {item.usbd_nft}회
                        </span>
                      ) : (
                        <span className="text-text-4">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <DeadlineLabel dt={item.cltr_bid_end_dt} pvct={pvct} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/items/${item.cltr_mng_no}`);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        상세 →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일: 카드 리스트 */}
      {visibleItems.length > 0 && (
        <div className="md:hidden flex flex-col gap-2">
          {pageItems.map((item) => {
            const dl = daysLeft(item.cltr_bid_end_dt);
            const pvct = dl < 0 && item.pvct_trgt_yn === "Y";
            return (
              <button
                key={item.cltr_mng_no}
                onClick={() => router.push(`/items/${item.cltr_mng_no}`)}
                className={`text-left bg-surface shadow-card rounded-lg p-3 flex flex-col gap-1 ${
                  pvct ? "border-l-2 border-l-mid-fg" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-text-1 truncate flex-1">
                    {item.onbid_cltr_nm}
                  </div>
                  <RatioPill ratio={item.ratio_pct} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-3">
                  <span className="font-mono">{item.cltr_mng_no}</span>
                  {isNewToday(item.first_collected_at) && (
                    <span className="text-[10px] bg-new text-primary-fg rounded-sm px-1.5 py-0.5 font-bold">
                      NEW
                    </span>
                  )}
                  <span>·</span>
                  <span>{item.lctn_sd_nm} {item.lctn_sggn_nm}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    {fmtAmt(item.lowst_bid_prc)}
                  </span>
                  <DeadlineLabel dt={item.cltr_bid_end_dt} pvct={pvct} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 범례 + 페이지네이션 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-1">
        <div className="flex items-center gap-4 text-xs text-text-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-hot-fg" />
            <span>60% 미만</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-mid-fg" />
            <span>60~70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-border-strong" />
            <span>70% 이상</span>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-text-4">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors tabular-nums ${
                      page === p
                        ? "bg-primary text-primary-fg border-primary"
                        : "border-border-strong hover:border-primary hover:text-primary"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
