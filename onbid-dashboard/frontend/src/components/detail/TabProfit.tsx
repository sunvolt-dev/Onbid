"use client";

import { useEffect, useState } from "react";
import type { BidItem } from "@/types";
import { fmtAmt, fmtKRW } from "@/utils/format";

interface Props {
  item: BidItem;
}

const STORAGE_KEY_PREFIX = "onbid_memo_";

export default function TabProfit({ item }: Props) {
  const storageKey = `${STORAGE_KEY_PREFIX}${item.cltr_mng_no}`;
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) setMemo(stored);
  }, [storageKey]);

  function saveMemo() {
    localStorage.setItem(storageKey, memo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 국토부 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📈</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">국토부 실거래가 연동 예정</p>
            <p className="text-xs text-amber-700 mt-1">
              국토교통부 실거래가 공개시스템 API와 연동하여 인근 실거래가 데이터를 자동으로 제공할 예정입니다.
              현재는 수동으로 조회 후 메모를 활용하세요.
            </p>
            <a
              href="https://rt.molit.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-amber-700 underline"
            >
              국토부 실거래가 조회 →
            </a>
          </div>
        </div>
      </div>

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
