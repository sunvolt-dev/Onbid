"use client";

import { useState } from "react";
import FilterDrawer from "./FilterDrawer";

interface Props {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function PageWithSidebar({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex">
      <aside className="hidden md:block w-60 shrink-0 border-r border-border bg-surface min-h-[calc(100vh-48px)]">
        {sidebar}
      </aside>
      <FilterDrawer open={open} onClose={() => setOpen(false)}>
        {sidebar}
      </FilterDrawer>
      <main className="flex-1 min-w-0 p-4 md:p-6">
        <button
          onClick={() => setOpen(true)}
          className="md:hidden mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-surface shadow-card rounded-md text-text-2"
          aria-label="필터 열기"
        >
          <span aria-hidden>☰</span> 필터
        </button>
        {children}
      </main>
    </div>
  );
}
