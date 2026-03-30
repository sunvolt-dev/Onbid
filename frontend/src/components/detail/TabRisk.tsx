"use client";

import type { BidItem } from "@/types";
import { daysLeft } from "@/utils/format";

interface Props {
  item: BidItem;
}

type Status = "ok" | "warn" | "unknown";

interface RiskItem {
  label: string;
  status: Status;
  description: string;
}

function StatusPill({ status }: { status: Status }) {
  if (status === "ok")
    return (
      <span className="text-[11px] bg-green-100 text-green-700 border border-green-300 rounded-full px-2 py-0.5 font-medium">
        양호
      </span>
    );
  if (status === "warn")
    return (
      <span className="text-[11px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-medium">
        주의
      </span>
    );
  return (
    <span className="text-[11px] bg-gray-100 text-gray-500 border border-gray-300 rounded-full px-2 py-0.5">
      확인 필요
    </span>
  );
}

export default function TabRisk({ item }: Props) {
  const dl = daysLeft(item.cltr_bid_end_dt);

  const risks: RiskItem[] = [
    {
      label: "감정가 대비 비율",
      status: item.ratio_pct < 60 ? "warn" : "ok",
      description:
        item.ratio_pct < 60
          ? `현재 ${item.ratio_pct.toFixed(1)}% — 매우 낮은 비율로 경쟁률 높을 수 있음`
          : `현재 ${item.ratio_pct.toFixed(1)}% — 적정 범위`,
    },
    {
      label: "마감일",
      status: dl < 0 ? "unknown" : dl <= 3 ? "warn" : "ok",
      description:
        dl < 0
          ? "이미 마감된 물건"
          : dl <= 3
          ? `마감 ${dl}일 남음 — 빠른 결정 필요`
          : `마감 ${dl}일 남음`,
    },
    {
      label: "지분물건 여부",
      status: item.alc_yn === "Y" ? "warn" : "ok",
      description:
        item.alc_yn === "Y"
          ? "지분물건 — 공유자 우선매수권 및 명도 복잡성 주의"
          : "단독 물건",
    },
    {
      label: "수의계약 가능",
      status: item.pvct_trgt_yn === "Y" ? "ok" : "unknown",
      description:
        item.pvct_trgt_yn === "Y"
          ? "수의계약 가능 — 낙찰 실패 시 협의 매수 가능"
          : "수의계약 불가",
    },
    {
      label: "정정 이력",
      status: item.crtn_yn === "Y" ? "warn" : "ok",
      description:
        item.crtn_yn === "Y"
          ? "정정 이력 있음 — 공고 내용 변경 여부 확인 필요"
          : "정정 이력 없음",
    },
    {
      label: "일괄입찰",
      status: item.batc_bid_yn === "Y" ? "warn" : "ok",
      description:
        item.batc_bid_yn === "Y"
          ? "일괄입찰 물건 — 여러 물건을 함께 낙찰받아야 함"
          : "단독 입찰",
    },
  ];

  const warnCount = risks.filter((r) => r.status === "warn").length;

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-xl p-4 border ${
        warnCount >= 3
          ? "bg-red-50 border-red-200"
          : warnCount >= 1
          ? "bg-amber-50 border-amber-200"
          : "bg-green-50 border-green-200"
      }`}>
        <p className={`text-sm font-semibold ${
          warnCount >= 3 ? "text-red-700" : warnCount >= 1 ? "text-amber-700" : "text-green-700"
        }`}>
          {warnCount >= 3
            ? `주의 항목 ${warnCount}개 — 신중한 검토 필요`
            : warnCount >= 1
            ? `주의 항목 ${warnCount}개 — 확인 필요`
            : "전체 양호"}
        </p>
      </div>

      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl divide-y divide-[#e8e6df]">
        {risks.map((risk) => (
          <div key={risk.label} className="flex items-center gap-4 px-5 py-3.5">
            <StatusPill status={risk.status} />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1a1a18]">{risk.label}</p>
              <p className="text-xs text-[#73726c] mt-0.5">{risk.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
