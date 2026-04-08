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

function ratioDot(ratio: number): string {
  if (ratio < 60) return "bg-red-500";
  if (ratio < 70) return "bg-amber-400";
  return "bg-transparent";
}

function ratioBadgeColor(ratio: number): string {
  if (ratio < 60) return "text-red-700 font-bold";
  if (ratio < 70) return "text-amber-700 font-semibold";
  return "text-green-700";
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

  // page 변경 시 URL 동기화
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPage = Number(params.get("page")) || 1;
    if (urlPage === page) return;
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [page, router]);

  // 정렬 변경 시 1페이지로 리셋
  useEffect(() => {
    if (prevSort.current !== filter.sort) {
      prevSort.current = filter.sort;
      setPage(1);
    }
  }, [filter.sort]);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortBtn = ({ val, label }: { val: FilterState["sort"]; label: string }) => (
    <button
      onClick={() => onSortChange(val)}
      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
        filter.sort === val
          ? "bg-[#185fa5] text-white border-[#185fa5]"
          : "bg-white text-[#3d3d3a] border-[#d3d1c7] hover:border-[#185fa5] hover:text-[#185fa5]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 정렬 툴바 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#73726c]">정렬:</span>
        <SortBtn val="ratio" label="비율 ↑" />
        <SortBtn val="usbd" label="유찰횟수" />
        <SortBtn val="deadline" label="마감일" />
        <span className="ml-auto text-xs text-[#9c9a92]">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} / 총 {items.length}건</span>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border border-[#e8e6df]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#faf9f7] border-b border-[#e8e6df]">
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">물건번호</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#5f5e5a]">소재지</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">용도</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">감정가</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">최저입찰가</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">감정가 대비</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#5f5e5a]">회차</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#5f5e5a]">유찰</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#5f5e5a] whitespace-nowrap">마감일</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-12 text-[#9c9a92] text-sm">
                  조건에 맞는 물건이 없습니다
                </td>
              </tr>
            )}
            {pageItems.map((item) => {
              const dl = daysLeft(item.cltr_bid_end_dt);
              const deadlineColor =
                dl < 0 ? "text-gray-400" : dl <= 3 ? "text-red-600 font-semibold" : "text-[#3d3d3a]";

              return (
                <tr
                  key={item.cltr_mng_no}
                  className="border-b border-[#e8e6df] cursor-pointer transition-colors bg-white hover:bg-[#faf9f7]"
                  onClick={() => router.push(`/items/${item.cltr_mng_no}`)}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ratioDot(item.ratio_pct)}`} />
                      <span className="text-xs text-[#5f5e5a] font-mono">{item.cltr_mng_no}</span>
                      {isNewToday(item.first_collected_at) && (
                        <span className="text-[10px] bg-[#185fa5] text-white rounded px-1 py-0.5 font-bold">NEW</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs text-[#1a1a18] font-medium truncate max-w-[180px]">
                      {item.onbid_cltr_nm}
                    </div>
                    <div className="text-[11px] text-[#73726c] mt-0.5">
                      {item.lctn_sd_nm} {item.lctn_sggn_nm}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[11px] text-[#5f5e5a]">{item.cltr_usg_mcls_nm}</div>
                    <div className="text-[11px] text-[#9c9a92] mt-0.5">{item.cltr_usg_scls_nm}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-[#3d3d3a]">
                    {fmtAmt(item.apsl_evl_amt)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium text-[#185fa5]">
                    {fmtAmt(item.lowst_bid_prc)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className={`text-xs ${ratioBadgeColor(item.ratio_pct)}`}>
                      {item.ratio_pct.toFixed(1)}%
                    </div>
                    <div className="mt-1 h-1.5 w-20 bg-gray-200 rounded-full overflow-hidden ml-auto">
                      <div
                        className={`h-full rounded-full ${
                          item.ratio_pct < 60
                            ? "bg-red-500"
                            : item.ratio_pct < 70
                            ? "bg-amber-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(item.ratio_pct, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-[#3d3d3a]">
                    {Number(item.pbct_nsq)}회차
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs text-[#3d3d3a]">
                    {item.usbd_nft > 0 ? (
                      <span className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                        {item.usbd_nft}회
                      </span>
                    ) : (
                      <span className="text-[#9c9a92]">-</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-center text-xs whitespace-nowrap ${deadlineColor}`}>
                    {dLabel(item.cltr_bid_end_dt)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/items/${item.cltr_mng_no}`);
                      }}
                      className="text-xs text-[#185fa5] hover:underline"
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

      {/* 범례 + 페이지네이션 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4 text-[11px] text-[#9c9a92]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>60% 미만</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>60~70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-gray-300" />
            <span>70% 이상</span>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-[#d3d1c7] disabled:opacity-30 hover:border-[#185fa5] hover:text-[#185fa5] disabled:hover:border-[#d3d1c7] disabled:hover:text-inherit transition-colors"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-[#d3d1c7] disabled:opacity-30 hover:border-[#185fa5] hover:text-[#185fa5] disabled:hover:border-[#d3d1c7] disabled:hover:text-inherit transition-colors"
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
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[#9c9a92]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      page === p
                        ? "bg-[#185fa5] text-white border-[#185fa5]"
                        : "border-[#d3d1c7] hover:border-[#185fa5] hover:text-[#185fa5]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-[#d3d1c7] disabled:opacity-30 hover:border-[#185fa5] hover:text-[#185fa5] disabled:hover:border-[#d3d1c7] disabled:hover:text-inherit transition-colors"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-[#d3d1c7] disabled:opacity-30 hover:border-[#185fa5] hover:text-[#185fa5] disabled:hover:border-[#d3d1c7] disabled:hover:text-inherit transition-colors"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
