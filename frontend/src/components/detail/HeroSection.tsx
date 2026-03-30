"use client";

import Image from "next/image";
import { fmtKRW, fmtAmt, sqmsToPyeong, dLabel, daysLeft } from "@/utils/format";
import type { BidItem } from "@/types";

interface Props {
  item: BidItem;
  onBookmark: () => void;
}

export default function HeroSection({ item, onBookmark }: Props) {
  const dl = daysLeft(item.cltr_bid_end_dt);
  const deadlinePillColor =
    dl < 0 ? "bg-gray-100 text-gray-500" : dl <= 3 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700";

  return (
    <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-6">
      <div className="flex gap-6">
        {/* 썸네일 */}
        <div className="w-52 h-40 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
          {item.thnl_img_url ? (
            <Image
              src={item.thnl_img_url}
              alt={item.onbid_cltr_nm}
              width={208}
              height={160}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <span className="text-[#9c9a92] text-xs">이미지 없음</span>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 flex flex-col gap-3">
          {/* 배지들 */}
          <div className="flex flex-wrap gap-1.5">
            {item.ratio_pct < 60 && (
              <span className="text-[11px] bg-red-100 text-red-700 border border-red-300 rounded-full px-2 py-0.5 font-medium">
                60% 미만 알림
              </span>
            )}
            {item.pvct_trgt_yn === "Y" && (
              <span className="text-[11px] bg-blue-100 text-blue-700 border border-blue-300 rounded-full px-2 py-0.5 font-medium">
                수의계약
              </span>
            )}
            {item.alc_yn === "Y" && (
              <span className="text-[11px] bg-gray-100 text-gray-600 border border-gray-300 rounded-full px-2 py-0.5">
                지분물건
              </span>
            )}
            <span className="text-[11px] bg-gray-100 text-gray-600 border border-gray-300 rounded-full px-2 py-0.5">
              {item.prpt_div_nm}
            </span>
            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${deadlinePillColor}`}>
              {dLabel(item.cltr_bid_end_dt)}
            </span>
          </div>

          {/* 물건명/주소 */}
          <div>
            <p className="text-xs text-[#73726c] font-mono">{item.cltr_mng_no}</p>
            <h1 className="text-lg font-bold text-[#1a1a18] mt-0.5">{item.onbid_cltr_nm}</h1>
            <p className="text-sm text-[#5f5e5a] mt-1">
              {item.lctn_sd_nm} {item.lctn_sggn_nm} {item.lctn_emd_nm}
            </p>
            <p className="text-xs text-[#9c9a92] mt-0.5">
              건물 {sqmsToPyeong(item.bld_sqms)}
              {item.land_sqms != null && ` / 토지 ${sqmsToPyeong(item.land_sqms)}`}
            </p>
          </div>

          {/* 핵심 3수치 */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white border border-[#e8e6df] rounded-lg px-3 py-2 text-center">
              <p className="text-[11px] text-[#9c9a92] mb-1">감정가 대비</p>
              <p
                className={`text-lg font-bold ${
                  item.ratio_pct < 60
                    ? "text-red-700"
                    : item.ratio_pct < 70
                    ? "text-amber-700"
                    : "text-green-700"
                }`}
              >
                {item.ratio_pct.toFixed(1)}%
              </p>
            </div>
            <div className="flex-1 bg-white border border-[#e8e6df] rounded-lg px-3 py-2 text-center">
              <p className="text-[11px] text-[#9c9a92] mb-1">회차</p>
              <p className="text-lg font-bold text-[#1a1a18]">{item.pbct_nsq}회</p>
            </div>
            <div className="flex-1 bg-white border border-[#e8e6df] rounded-lg px-3 py-2 text-center">
              <p className="text-[11px] text-[#9c9a92] mb-1">유찰 횟수</p>
              <p className="text-lg font-bold text-[#1a1a18]">{item.usbd_nft}회</p>
            </div>
          </div>

          {/* 가격 */}
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-[#9c9a92] line-through">{fmtKRW(item.apsl_evl_amt)}</span>
            <span className="text-xl font-bold text-[#185fa5]">{fmtAmt(item.lowst_bid_prc)}</span>
          </div>

          {/* 게이지바 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9c9a92] w-6">0%</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.ratio_pct < 60
                    ? "bg-red-500"
                    : item.ratio_pct < 70
                    ? "bg-amber-500"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(item.ratio_pct, 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-[#9c9a92] w-8">100%</span>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onBookmark}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              item.is_bookmarked
                ? "bg-amber-50 text-amber-700 border-amber-300"
                : "bg-white text-[#3d3d3a] border-[#d3d1c7] hover:border-[#185fa5]"
            }`}
          >
            {item.is_bookmarked ? "★ 관심 해제" : "☆ 관심 등록"}
          </button>
          <a
            href={`https://www.onbid.co.kr/op/cta/cuiAuctRlsInfo/selectCuiAuctRlsInfoDtl.do?cltrMngNo=${item.cltr_mng_no}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#185fa5] text-white hover:bg-[#14508f] transition-colors text-center"
          >
            온비드 →
          </a>
        </div>
      </div>
    </div>
  );
}
