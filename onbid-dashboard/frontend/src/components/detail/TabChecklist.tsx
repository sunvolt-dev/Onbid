"use client";

import { useEffect, useState } from "react";

interface CheckItem {
  id: string;
  level: "HIGH" | "MID" | "LOW";
  label: string;
  checked: boolean;
}

const DEFAULT_ITEMS: Omit<CheckItem, "checked">[] = [
  { id: "1", level: "HIGH", label: "등기부등본 확인" },
  { id: "2", level: "HIGH", label: "명도 가능 여부 확인" },
  { id: "3", level: "HIGH", label: "임차인 보증금 규모 확인" },
  { id: "4", level: "MID", label: "실거래가 조회" },
  { id: "5", level: "MID", label: "대출 가능 여부 확인" },
  { id: "6", level: "LOW", label: "관리비 연체 여부 확인" },
  { id: "7", level: "LOW", label: "주변 시세 조사" },
];

const LEVEL_STYLE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-300",
  MID: "bg-amber-100 text-amber-700 border-amber-300",
  LOW: "bg-gray-100 text-gray-500 border-gray-300",
};

function storageKey(id: string) {
  return `onbid_checklist_${id}`;
}

interface Props {
  id: string;
}

export default function TabChecklist({ id }: Props) {
  const [items, setItems] = useState<CheckItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newLevel, setNewLevel] = useState<"HIGH" | "MID" | "LOW">("MID");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey(id));
    if (stored) {
      setItems(JSON.parse(stored));
    } else {
      setItems(DEFAULT_ITEMS.map((d) => ({ ...d, checked: false })));
    }
  }, [id]);

  function save(next: CheckItem[]) {
    setItems(next);
    localStorage.setItem(storageKey(id), JSON.stringify(next));
  }

  function toggle(itemId: string) {
    save(items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)));
  }

  function addItem() {
    if (!newLabel.trim()) return;
    const next: CheckItem = {
      id: String(Date.now()),
      level: newLevel,
      label: newLabel.trim(),
      checked: false,
    };
    save([...items, next]);
    setNewLabel("");
  }

  function removeItem(itemId: string) {
    save(items.filter((i) => i.id !== itemId));
  }

  const done = items.filter((i) => i.checked).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 진행률 */}
      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#1a1a18]">점검 진행률</p>
          <p className="text-sm text-[#185fa5] font-bold">
            {done}/{items.length}
          </p>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#185fa5] rounded-full transition-all"
            style={{ width: items.length > 0 ? `${(done / items.length) * 100}%` : "0%" }}
          />
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl divide-y divide-[#e8e6df]">
        {["HIGH", "MID", "LOW"].map((level) => {
          const levelItems = items.filter((i) => i.level === level);
          if (levelItems.length === 0) return null;
          return (
            <div key={level} className="px-5 py-3">
              <p className="text-[11px] font-semibold text-[#9c9a92] mb-2">
                {level === "HIGH" ? "필수 확인" : level === "MID" ? "권장 확인" : "추가 확인"}
              </p>
              <div className="flex flex-col gap-2">
                {levelItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggle(item.id)}
                      className="accent-[#185fa5] w-4 h-4 shrink-0"
                    />
                    <span
                      className={`text-[11px] border rounded-full px-2 py-0.5 font-medium ${LEVEL_STYLE[item.level]}`}
                    >
                      {item.level}
                    </span>
                    <span
                      className={`text-sm flex-1 ${
                        item.checked ? "line-through text-[#9c9a92]" : "text-[#1a1a18]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {!DEFAULT_ITEMS.find((d) => d.id === item.id) && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[#9c9a92] hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 항목 추가 */}
      <div className="bg-[#faf9f7] border border-[#e8e6df] rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-[#3d3d3a] mb-3">항목 추가</p>
        <div className="flex gap-2">
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as "HIGH" | "MID" | "LOW")}
            className="text-xs border border-[#d3d1c7] rounded px-2 py-1.5 bg-white shrink-0"
          >
            <option value="HIGH">HIGH</option>
            <option value="MID">MID</option>
            <option value="LOW">LOW</option>
          </select>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="새 점검 항목 입력..."
            className="flex-1 text-xs border border-[#d3d1c7] rounded px-3 py-1.5 focus:outline-none focus:border-[#185fa5]"
          />
          <button
            onClick={addItem}
            className="text-xs bg-[#185fa5] text-white px-3 py-1.5 rounded font-medium hover:bg-[#14508f] shrink-0"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
