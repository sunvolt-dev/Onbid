"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchItem, toggleBookmark, refreshItem, checkItem } from "@/api";
import type { BidItem } from "@/types";
import { dLabel, daysLeft } from "@/utils/format";
import HeroSection from "@/components/detail/HeroSection";
import TabInfo from "@/components/detail/TabInfo";
import TabHistory from "@/components/detail/TabHistory";
import TabProfit from "@/components/detail/TabProfit";
import TabTenant from "@/components/detail/TabTenant";
import TabRisk from "@/components/detail/TabRisk";
import TabChecklist from "@/components/detail/TabChecklist";

type TabKey = "info" | "history" | "profit" | "tenant" | "risk" | "checklist";

const TABS: { key: TabKey; label: string }[] = [
  { key: "info", label: "📋 기본정보" },
  { key: "history", label: "📉 유찰내역" },
  { key: "profit", label: "📈 수익성 분석" },
  { key: "tenant", label: "🏠 임차인 정보" },
  { key: "risk", label: "⚠️ 리스크 지표" },
  { key: "checklist", label: "✅ 점검 체크리스트" },
];

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<BidItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [refreshing, setRefreshing] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    fetchItem(id)
      .then((data) => {
        setItem(data);
        // 상세 진입 시 온비드에 아직 유효한지 백그라운드 체크
        checkItem(id)
          .then((res) => {
            if (!res.alive) setClosed(true);
          })
          .catch(() => {});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleBookmark() {
    if (!item) return;
    try {
      const res = await toggleBookmark(item.cltr_mng_no);
      setItem({ ...item, is_bookmarked: res.is_bookmarked });
    } catch {
      // ignore
    }
  }

  async function handleRefresh() {
    if (!item || refreshing) return;
    setRefreshing(true);
    try {
      const res = await refreshItem(item.cltr_mng_no);
      setItem(res.item);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#185fa5] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#9c9a92]">물건 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg font-semibold text-[#1a1a18] mb-2">물건을 찾을 수 없습니다</p>
          <Link href="/" className="text-sm text-[#185fa5] underline">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const dl = daysLeft(item.cltr_bid_end_dt);
  const deadlinePillColor =
    dl < 0 ? "bg-gray-100 text-gray-500" : dl <= 3 ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700";

  return (
    <div className="min-h-screen bg-[#f3f2ee]">
      {/* 네비바 */}
      <nav className="sticky top-0 z-10 bg-[#faf9f7] border-b border-[#e8e6df] px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-sm text-[#185fa5] hover:underline flex items-center gap-1"
        >
          ← 목록
        </button>
        <span className="text-[#d3d1c7]">/</span>
        <span className="text-sm text-[#5f5e5a] truncate max-w-xs">{item.onbid_cltr_nm}</span>
        <span className={`ml-auto text-xs rounded-full px-2.5 py-1 font-medium ${deadlinePillColor}`}>
          {dLabel(item.cltr_bid_end_dt)}
        </span>
        <button
          onClick={handleBookmark}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
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
          className="text-xs bg-[#185fa5] text-white px-3 py-1.5 rounded hover:bg-[#14508f] transition-colors"
        >
          온비드 바로가기 →
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">
        {/* 종료 배너 */}
        {closed && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-3 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-red-700">이 물건은 종료되었습니다</p>
              <p className="text-xs text-red-500 mt-0.5">온비드에서 낙찰·취소 처리되어 더 이상 입찰할 수 없습니다.</p>
            </div>
          </div>
        )}

        {/* Hero */}
        <HeroSection item={item} onBookmark={handleBookmark} onRefresh={handleRefresh} refreshing={refreshing} />

        {/* 탭 */}
        <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl overflow-hidden">
          {/* 탭바 */}
          <div className="flex border-b border-[#e8e6df] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-[#185fa5] text-[#185fa5] font-medium bg-white"
                    : "text-[#73726c] hover:text-[#1a1a18] hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="p-6">
            {activeTab === "info" && <TabInfo item={item} />}
            {activeTab === "history" && (
              <TabHistory id={item.cltr_mng_no} apslEvlAmt={item.apsl_evl_amt} />
            )}
            {activeTab === "profit" && <TabProfit item={item} />}
            {activeTab === "tenant" && (
              <TabTenant id={item.cltr_mng_no} prptDivNm={item.prpt_div_nm} />
            )}
            {activeTab === "risk" && <TabRisk item={item} />}
            {activeTab === "checklist" && <TabChecklist id={item.cltr_mng_no} />}
          </div>
        </div>
      </div>
    </div>
  );
}
