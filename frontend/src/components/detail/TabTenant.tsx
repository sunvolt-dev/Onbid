"use client";

import { useEffect, useState } from "react";
import { fetchItemTenant } from "@/api";
import type { TenantInfo } from "@/types";

interface Props {
  id: string;
  prptDivNm: string;
}

function SimpleTable({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-[#9c9a92] py-2">데이터 없음</p>;
  }
  const cols = Object.keys(data[0]);
  return (
    <div className="overflow-x-auto rounded-lg border border-[#e8e6df]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#faf9f7] border-b border-[#e8e6df]">
            {cols.map((c) => (
              <th key={c} className="px-2.5 py-2 text-left text-[#9c9a92] font-normal whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-[#e8e6df] last:border-0">
              {cols.map((c) => (
                <td key={c} className="px-2.5 py-2 text-[#3d3d3a] whitespace-nowrap">
                  {String(row[c] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
      <Section title="임대차 정보" data={tenant.leas_inf} />
      <Section title="점유 관계" data={tenant.ocpy_rel} />
      <Section title="등기사항 주요 정보" data={tenant.rgst_prmr} />
      <Section title="배분요구 사항" data={tenant.dtbt_rqr} />
    </div>
  );
}

function Section({ title, data }: { title: string; data: Record<string, unknown>[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#1a1a18] mb-2">{title}</p>
      <SimpleTable data={data} />
    </div>
  );
}
