"use client";

import { useEffect, useState } from "react";
import { fetchItemTenant } from "@/api";
import { LabeledTable, type ColDef } from "@/components/LabeledTable";
import type { TenantInfo } from "@/types";

interface Props {
  id: string;
  prptDivNm: string;
}

const fmtAmt = (v: unknown) => {
  if (v == null) return "-";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString("ko-KR") + " 원";
};

const fmtDate = (v: unknown) => {
  if (v == null || v === "") return "-";
  const s = String(v);
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
};

const SECTION_COLS: Record<string, ColDef[]> = {
  leas_inf: [
    { key: "irst_div_nm", label: "구분" },
    { key: "cltr_inpr_nm", label: "임차인" },
    { key: "bid_grtee_amt", label: "보증금", fmt: fmtAmt },
    { key: "mthr_amt", label: "월세", fmt: fmtAmt },
    { key: "conv_grtee_amt", label: "환산보증금", fmt: fmtAmt },
    { key: "cfmtn_ymd", label: "확정일자", fmt: fmtDate },
    { key: "mvin_ymd", label: "전입일자", fmt: fmtDate },
  ],
  ocpy_rel: [
    { key: "ocpy_rel_cd_nm", label: "점유관계" },
    { key: "ocpy_irps_nm", label: "점유자" },
    { key: "ctrt_ymd", label: "계약일자", fmt: fmtDate },
    { key: "mvin_ymd", label: "전입일자", fmt: fmtDate },
    { key: "cfmtn_ymd", label: "확정일자", fmt: fmtDate },
    { key: "acpm_grtee_amt", label: "보증금", fmt: fmtAmt },
    { key: "rnt_amt", label: "차임", fmt: fmtAmt },
    { key: "lsd_part_cont", label: "임차부분" },
  ],
  rgst_prmr: [
    { key: "irst_div_nm", label: "권리종류" },
    { key: "cltr_inpr_nm", label: "권리자" },
    { key: "rgst_ymd", label: "등기설정일", fmt: fmtDate },
    { key: "inpr_stng_amt", label: "설정금액", fmt: fmtAmt },
  ],
  dtbt_rqr: [
    { key: "rgt_rel_cd_nm", label: "권리종류" },
    { key: "acpm_prpt_nm", label: "권리자" },
    { key: "stng_ymd", label: "설정일자", fmt: fmtDate },
    { key: "bond_stng_amt", label: "설정금액", fmt: fmtAmt },
    { key: "dtbt_rqr_yn", label: "배분요구" },
    { key: "dtbt_rqr_ymd", label: "배분요구일", fmt: fmtDate },
    { key: "dtbt_rqr_amt", label: "배분요구액", fmt: fmtAmt },
    { key: "ersr_psbl_yn", label: "말소가능" },
    { key: "etc_cont", label: "기타" },
  ],
};

export default function TabTenant({ id, prptDivNm }: Props) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isArrested = prptDivNm === "압류재산";

  useEffect(() => {
    if (!isArrested) {
      setLoading(false);
      return;
    }
    fetchItemTenant(id)
      .then(setTenant)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, isArrested]);

  if (!isArrested) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-amber-800 mb-1">임차인 정보 미제공</p>
        <p className="text-xs text-amber-700">
          신탁재산 / 기타일반재산은 온비드 API에서 임차인 정보를 제공하지 않습니다.
        </p>
        <p className="text-xs text-amber-600 mt-1">현재 자산 구분: {prptDivNm}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-[#9c9a92] animate-pulse py-8 text-center">로딩 중...</div>;
  }
  if (error || !tenant) {
    return <div className="text-sm text-red-500 py-8 text-center">임차인 정보를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="임대차 정보" sectionKey="leas_inf" data={tenant.leas_inf} />
      <Section title="점유 관계" sectionKey="ocpy_rel" data={tenant.ocpy_rel} />
      <Section title="등기사항 주요 정보" sectionKey="rgst_prmr" data={tenant.rgst_prmr} />
      <Section title="배분요구 사항" sectionKey="dtbt_rqr" data={tenant.dtbt_rqr} />
    </div>
  );
}

function Section({ title, sectionKey, data }: { title: string; sectionKey: string; data: Record<string, unknown>[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#1a1a18] mb-2">{title}</p>
      <LabeledTable data={data} columns={SECTION_COLS[sectionKey] ?? []} />
    </div>
  );
}
