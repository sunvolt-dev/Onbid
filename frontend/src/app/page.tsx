"use client";

import { useEffect } from "react";
import FilterPanel from "@/components/FilterPanel";

import ItemTable from "@/components/ItemTable";
import { useItems } from "@/hooks/useItems";

export default function HomePage() {
  const { items, loading, error, filter, setFilter, load } = useItems();

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(f: typeof filter) {
    setFilter(f);
    load(f);
  }

  return (
    <div className="flex min-h-screen">
      {/* 좌측 필터 패널 */}
      <FilterPanel filter={filter} onSearch={handleSearch} />

      {/* 우측 콘텐츠 */}
      <main className="flex-1 flex flex-col gap-4 p-6 min-w-0">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a18]">온비드 공매 대시보드</h1>
            <p className="text-xs text-[#9c9a92] mt-0.5">한국자산관리공사 공매 물건 투자 분석</p>
          </div>
        </div>


        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            데이터를 불러오지 못했습니다: {error}
          </div>
        )}

        {/* 로딩 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#185fa5] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#9c9a92]">물건 목록을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <ItemTable
            items={items}
            filter={filter}
            onSortChange={(sort) => setFilter({ ...filter, sort })}
          />
        )}
      </main>
    </div>
  );
}
