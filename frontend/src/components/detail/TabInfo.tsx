"use client";

import { useEffect, useState } from "react";
import { fetchItemInfo } from "@/api";
import type { BidItem, ItemInfo } from "@/types";
import { sqmsToPyeong } from "@/utils/format";

interface Props {
  item: BidItem;
}

const HAS_NAVER_KEY = !!process.env.NEXT_PUBLIC_NAVER_MAP_KEY;

export default function TabInfo({ item }: Props) {
  const [info, setInfo] = useState<ItemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchItemInfo(item.cltr_mng_no)
      .then(setInfo)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [item.cltr_mng_no]);

  const paps = info?.paps_inf;
  const papsNote =
    paps && typeof paps === "object" && "spcl_ntc_ctt" in paps
      ? String(paps.spcl_ntc_ctt ?? "")
      : "";

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex gap-2 py-2 border-b border-[#e8e6df] last:border-0">
      <span className="text-xs text-[#9c9a92] w-28 shrink-0">{label}</span>
      <span className="text-xs text-[#1a1a18] flex-1">{value}</span>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* 좌: 정보 그리드 */}
      <div className="flex-1 bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#1a1a18] mb-3">물건 기본정보</h3>
        <InfoRow label="소재지" value={`${item.lctn_sd_nm} ${item.lctn_sggn_nm} ${item.lctn_emd_nm}`} />
        <InfoRow label="자산구분" value={item.prpt_div_nm} />
        <InfoRow label="건물용도" value={`${item.cltr_usg_mcls_nm} > ${item.cltr_usg_scls_nm}`} />
        <InfoRow label="건물면적" value={sqmsToPyeong(item.bld_sqms)} />
        <InfoRow label="토지면적" value={sqmsToPyeong(item.land_sqms)} />
        <InfoRow label="공고기관" value={item.rqst_org_nm} />
        <InfoRow label="집행기관" value={item.exct_org_nm} />
        <InfoRow
          label="입찰기간"
          value={`${item.cltr_bid_bgng_dt} ~ ${item.cltr_bid_end_dt}`}
        />
        <InfoRow label="수의계약" value={item.pvct_trgt_yn === "Y" ? "가능" : "불가"} />
        <InfoRow label="일괄입찰" value={item.batc_bid_yn === "Y" ? "예" : "아니오"} />
        <InfoRow label="지분물건" value={item.alc_yn === "Y" ? "예" : "아니오"} />

        {loading && (
          <div className="mt-4 text-xs text-[#9c9a92] animate-pulse">상세 정보 로딩 중...</div>
        )}
        {error && (
          <div className="mt-4 text-xs text-red-500">상세 정보를 불러올 수 없습니다.</div>
        )}

        {papsNote && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#3d3d3a] mb-1">명세서 특이사항</p>
            <p className="text-xs text-[#5f5e5a] bg-amber-50 border border-amber-200 rounded p-3 whitespace-pre-wrap">
              {papsNote}
            </p>
          </div>
        )}

        {info && info.sqms.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#3d3d3a] mb-2">면적 정보</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {Object.keys(info.sqms[0]).slice(0, 5).map((k) => (
                      <th key={k} className="px-2 py-1.5 text-left text-[#9c9a92] border border-[#e8e6df] font-normal">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {info.sqms.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).slice(0, 5).map((v, j) => (
                        <td key={j} className="px-2 py-1.5 border border-[#e8e6df] text-[#3d3d3a]">
                          {String(v ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 우: 지도 */}
      <div className="w-72 shrink-0">
        <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5 h-full flex items-center justify-center">
          {HAS_NAVER_KEY ? (
            <div id="naver-map" className="w-full h-60 rounded-lg bg-gray-200" />
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center text-2xl">
                🗺️
              </div>
              <p className="text-xs text-[#9c9a92] font-medium">네이버 지도 API 키 필요</p>
              <p className="text-[11px] text-[#9c9a92] mt-1">
                NEXT_PUBLIC_NAVER_MAP_KEY 환경변수를 설정하세요
              </p>
              <p className="text-[11px] text-[#73726c] mt-2 font-medium">{item.lctn_sd_nm} {item.lctn_sggn_nm}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
