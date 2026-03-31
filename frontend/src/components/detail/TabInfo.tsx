"use client";

import { useEffect, useRef, useState } from "react";
import { fetchItemInfo } from "@/api";
import { LabeledTable, type ColDef } from "@/components/LabeledTable";
import type { BidItem, ItemInfo } from "@/types";
import { sqmsToPyeong } from "@/utils/format";

const fmtSqms = (v: unknown) => {
  if (v == null || v === "") return "-";
  const s = String(v).trim();
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!isNaN(n)) return `${s} (약 ${(n * 0.3025).toFixed(1)}평)`;
  return s;
};

const SQMS_COLS: ColDef[] = [
  { key: "cland_cont", label: "종별(지목)" },
  { key: "sqms_cont", label: "면적", fmt: fmtSqms },
  { key: "purs_alc_cont", label: "지분" },
  { key: "dtl_cltr_nm", label: "비고" },
];

interface Props {
  item: BidItem;
}

declare global {
  interface Window {
    kakao: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

export default function TabInfo({ item }: Props) {
  const [info, setInfo] = useState<ItemInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  useEffect(() => {
    fetchItemInfo(item.cltr_mng_no)
      .then(setInfo)
      .catch(() => setInfoError(true))
      .finally(() => setInfoLoading(false));
  }, [item.cltr_mng_no]);

  // 카카오맵 SDK 스크립트 직접 로드 + 지도 초기화
  useEffect(() => {
    if (!KAKAO_KEY || !mapRef.current || mapInitialized.current) return;

    function initMap() {
      if (!mapRef.current || mapInitialized.current) return;
      mapInitialized.current = true;

      const address = `${item.lctn_sd_nm} ${item.lctn_sggn_nm} ${item.lctn_emd_nm}`;

      window.kakao.maps.load(() => {
        const geocoder = new window.kakao.maps.services.Geocoder();

        geocoder.addressSearch(address, (result: any[], status: string) => {
          if (!mapRef.current) return;

          const coords =
            status === window.kakao.maps.services.Status.OK
              ? new window.kakao.maps.LatLng(parseFloat(result[0].y), parseFloat(result[0].x))
              : new window.kakao.maps.LatLng(37.5665, 126.978);

          const map = new window.kakao.maps.Map(mapRef.current, {
            center: coords,
            level: 4,
          });

          new window.kakao.maps.Marker({ position: coords, map });

          new window.kakao.maps.CustomOverlay({
            position: coords,
            map,
            content: `<div style="
              background:#185fa5;color:#fff;font-size:11px;font-weight:700;
              padding:4px 10px;border-radius:99px;white-space:nowrap;
              box-shadow:0 1px 4px rgba(0,0,0,.25);margin-bottom:42px;
            ">${item.lctn_sggn_nm}</div>`,
            yAnchor: 1,
          });
        });
      });
    }

    // 이미 로드된 경우
    if (window.kakao?.maps?.load) {
      initMap();
      return;
    }

    // 스크립트 삽입
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    script.onload = initMap;
    document.head.appendChild(script);
  }, [item]);

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
          <InfoRow label="입찰기간" value={`${item.cltr_bid_bgng_dt} ~ ${item.cltr_bid_end_dt}`} />
          <InfoRow label="수의계약" value={item.pvct_trgt_yn === "Y" ? "가능" : "불가"} />
          <InfoRow label="일괄입찰" value={item.batc_bid_yn === "Y" ? "예" : "아니오"} />
          <InfoRow label="지분물건" value={item.alc_yn === "Y" ? "예" : "아니오"} />

          {infoLoading && (
            <div className="mt-4 text-xs text-[#9c9a92] animate-pulse">상세 정보 로딩 중...</div>
          )}
          {infoError && (
            <div className="mt-4 text-xs text-red-500">상세 정보를 불러올 수 없습니다.</div>
          )}

          {(item.zadr_nm || item.loc_vnty_pscd_cont || item.utlz_pscd_cont || item.cltr_etc_cont || item.icdl_cdtn_cont) && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-[#1a1a18] mb-3">위치 및 이용현황</h3>
              {item.zadr_nm && <InfoRow label="지번" value={item.zadr_nm} />}
              {item.cltr_radr && <InfoRow label="도로명" value={item.cltr_radr} />}
              {item.loc_vnty_pscd_cont && (
                <div className="py-2 border-b border-[#e8e6df]">
                  <span className="text-xs text-[#9c9a92] block mb-1">위치 및 부근현황</span>
                  <p className="text-xs text-[#1a1a18] whitespace-pre-wrap">{item.loc_vnty_pscd_cont}</p>
                </div>
              )}
              {item.utlz_pscd_cont && (
                <div className="py-2 border-b border-[#e8e6df]">
                  <span className="text-xs text-[#9c9a92] block mb-1">이용현황</span>
                  <p className="text-xs text-[#1a1a18] whitespace-pre-wrap">{item.utlz_pscd_cont}</p>
                </div>
              )}
              {item.icdl_cdtn_cont && (
                <div className="py-2 border-b border-[#e8e6df]">
                  <span className="text-xs text-[#9c9a92] block mb-1">부대조건</span>
                  <p className="text-xs text-[#1a1a18] whitespace-pre-wrap">{item.icdl_cdtn_cont}</p>
                </div>
              )}
              {item.cltr_etc_cont && (
                <div className="py-2">
                  <span className="text-xs text-[#9c9a92] block mb-1">기타사항</span>
                  <p className="text-xs text-[#5f5e5a] bg-gray-50 border border-[#e8e6df] rounded p-3 whitespace-pre-wrap">{item.cltr_etc_cont}</p>
                </div>
              )}
            </div>
          )}

          {info && info.sqms.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-[#3d3d3a] mb-2">면적 정보</p>
              <LabeledTable
                data={info.sqms}
                columns={SQMS_COLS}
              />
            </div>
          )}
        </div>

        {/* 우: 카카오맵 */}
        <div className="w-80 shrink-0">
          <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-[#e8e6df] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#3d3d3a]">소재지 지도</span>
              <span className="text-[10px] bg-[#FEE500] text-[#3C1E1E] px-2 py-0.5 rounded font-bold">kakao</span>
            </div>

            {KAKAO_KEY ? (
              <div ref={mapRef} className="flex-1 min-h-[280px]" />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5 text-center">
                <div className="w-12 h-12 bg-[#FEE500] rounded-full flex items-center justify-center text-xl">🗺️</div>
                <p className="text-xs font-medium text-[#3d3d3a]">카카오맵 API 키 필요</p>
                <p className="text-[11px] text-[#9c9a92] leading-relaxed">
                  <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_KAKAO_MAP_KEY</code><br />
                  환경변수를 설정하세요
                </p>
                <p className="text-[11px] text-[#185fa5] font-medium mt-1">
                  {item.lctn_sd_nm} {item.lctn_sggn_nm} {item.lctn_emd_nm}
                </p>
              </div>
            )}

            {KAKAO_KEY && (
              <div className="px-3 py-2 bg-[#faf9f7] border-t border-[#e8e6df] text-[11px] text-[#73726c]">
                {item.lctn_sd_nm} {item.lctn_sggn_nm} {item.lctn_emd_nm}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
