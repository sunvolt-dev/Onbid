"use client";

const REGIONS = [
  "서울특별시",
  "경기도",
  "인천광역시",
  "부산광역시",
  "대구광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
];
const USAGE_TYPES = ["상가용및업무용건물", "용도복합용건물"];

export interface AnalyticsFilterState {
  regions: string[];
  usageTypes: string[];
}

interface Props {
  filter: AnalyticsFilterState;
  onChange: (f: AnalyticsFilterState) => void;
}

export default function AnalyticsFilters({ filter, onChange }: Props) {
  function toggleRegion(r: string) {
    const next = filter.regions.includes(r)
      ? filter.regions.filter((x) => x !== r)
      : [...filter.regions, r];
    onChange({ ...filter, regions: next });
  }

  function toggleUsage(u: string) {
    const next = filter.usageTypes.includes(u)
      ? filter.usageTypes.filter((x) => x !== u)
      : [...filter.usageTypes, u];
    onChange({ ...filter, usageTypes: next });
  }

  function clearAll() {
    onChange({ regions: [], usageTypes: [] });
  }

  const hasFilter = filter.regions.length > 0 || filter.usageTypes.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">필터</h3>
        {hasFilter && (
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            초기화
          </button>
        )}
      </div>

      {/* Region multi-select */}
      <div>
        <p className="text-xs text-gray-500 mb-2">지역</p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter.regions.includes(r)
                  ? "bg-[#185fa5] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r.replace(/특별시|광역시|특별자치시|도$/, "")}
            </button>
          ))}
        </div>
      </div>

      {/* Usage type multi-select */}
      <div>
        <p className="text-xs text-gray-500 mb-2">용도</p>
        <div className="flex flex-wrap gap-1.5">
          {USAGE_TYPES.map((u) => (
            <button
              key={u}
              onClick={() => toggleUsage(u)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter.usageTypes.includes(u)
                  ? "bg-[#185fa5] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
