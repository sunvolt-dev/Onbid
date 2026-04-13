# Frontend Phase 1: Restyle + Responsive Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온비드 공매 대시보드 프론트엔드를 Modern SaaS Light 스타일로 리스킨하고, 모바일(< 768px)에서도 사용 가능하도록 반응형 셸을 구축한다.

**Architecture:** 데이터/훅/API 레이어는 건드리지 않고 순수 프레젠테이션 레이어만 교체. Tailwind 4 `@theme` 디자인 토큰을 먼저 정의한 뒤, 레이아웃 셸(TopNav + PageWithSidebar + FilterDrawer) 신규 작성, 그 위에서 컴포넌트를 하나씩 토큰 기반으로 마이그레이션한다.

**Tech Stack:** Next.js 16 (App Router, React 19), TypeScript, Tailwind 4 (@theme), recharts 3

---

## ⚠️ 사전 확인 (모든 Task 전에 1회)

- [ ] **Pre-step A: Next.js 16 변경사항 스캔**

`frontend/AGENTS.md`는 "이 프로젝트는 당신이 알던 Next.js가 아니다 — `node_modules/next/dist/docs/` 확인하라"고 경고한다. 최소한 App Router 관련 변경사항을 아래 명령으로 훑어본다.

```bash
cd /Users/seonminkim/Desktop/글로벌비전_프로젝트/온비드/Onbid/onbid-dashboard/frontend
ls node_modules/next/dist/docs/01-app/
cat node_modules/next/dist/docs/01-app/index.md 2>/dev/null | head -80
```

기대: `client-components`, `layouts`, `link-component`, `route-handlers` 등 문서 존재. 기존 코드가 쓰는 `"use client"`, `usePathname`, `Link`, `params: Promise<{id: string}>` 패턴이 현재 문서와 일치하는지 확인.

- [ ] **Pre-step B: 기준 체크 — 현재 앱이 정상 동작하는지**

```bash
cd frontend && npm run dev
```

브라우저 http://localhost:3000 으로 접속 → 홈/분석/상세 페이지 열림, 콘솔 에러 0. 기준선이 확보돼야 이후 회귀를 감지할 수 있다.

- [ ] **Pre-step C: 작업 브랜치 생성**

```bash
git checkout dev
git checkout -b feat/phase1-restyle
```

---

## Task 1: Design Tokens (foundation)

**Files:**
- Modify: `frontend/src/app/globals.css` (전체)

- [ ] **Step 1.1: globals.css 교체**

현재 파일(23줄)을 아래 내용으로 완전히 교체한다:

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-bg: #fafbfc;
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;

  /* Borders */
  --color-border: #f1f5f9;
  --color-border-strong: #e2e8f0;

  /* Text (slate scale) */
  --color-text-1: #0f172a;
  --color-text-2: #334155;
  --color-text-3: #64748b;
  --color-text-4: #94a3b8;

  /* Brand (Indigo) */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-subtle: #eef2ff;
  --color-primary-fg: #ffffff;

  /* Semantic — ratio states */
  --color-hot-bg: #fee2e2;
  --color-hot-fg: #b91c1c;
  --color-mid-bg: #fef3c7;
  --color-mid-fg: #b45309;
  --color-ok-bg: #dcfce7;
  --color-ok-fg: #166534;

  /* Semantic — urgency */
  --color-urgent: #ef4444;
  --color-new: #6366f1;

  /* Shadows */
  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04);
  --shadow-card-hover: 0 4px 8px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.06);
  --shadow-drawer: 2px 0 16px rgba(15, 23, 42, 0.12);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-1);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-variant-numeric: tabular-nums;
}
```

**주의**: 기존 `--color-text1` (하이픈 없음) → `--color-text-1` (하이픈)으로 이름이 바뀐다. 기존에 `text-text1`을 쓰던 코드는 Tailwind 빌드 시 해당 유틸리티를 찾지 못해 스타일이 날아가지만, 애초에 이 프로젝트에서는 대부분 하드코딩 `text-[#1a1a18]` 형태를 쓰고 있어 영향 범위가 작다. 이후 Step 3~8에서 컴포넌트를 옮길 때 정리된다.

- [ ] **Step 1.2: 개발 서버 재시작해서 빌드 확인**

```bash
cd frontend
# dev 서버가 떠 있으면 Ctrl-C 후 재시작 (Tailwind 4 @theme 변경은 풀 리빌드 필요)
npm run dev
```

기대: 콘솔 에러 없음. 브라우저 홈 접속 시 **배경색이 크림 → 오프화이트로** 미세하게 바뀐다(보통 인지됨). 나머지 컴포넌트는 아직 하드코딩 색이라 크게 바뀌지 않는다.

- [ ] **Step 1.3: 커밋**

```bash
cd /Users/seonminkim/Desktop/글로벌비전_프로젝트/온비드/Onbid/onbid-dashboard
git add frontend/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(frontend): redefine Tailwind 4 @theme tokens for Phase 1 restyle

오프화이트 배경, Indigo 액센트, slate 텍스트 스케일, 카드 그림자,
radius 스케일, ratio/urgency 시맨틱 토큰을 정의. 이후 단계에서
하드코딩 hex들을 이 토큰들로 교체한다.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Layout Shell + Root Layout & Home Integration

**Files:**
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/TopNav.tsx`
- Create: `frontend/src/components/layout/FilterDrawer.tsx`
- Create: `frontend/src/components/layout/PageWithSidebar.tsx`
- Modify: `frontend/src/app/layout.tsx` (전체)
- Modify: `frontend/src/app/page.tsx` (최상위 구조)

- [ ] **Step 2.1: `components/layout/` 디렉터리 생성 후 TopNav 작성**

```bash
mkdir -p frontend/src/components/layout
```

`frontend/src/components/layout/TopNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={
        active
          ? "text-primary font-semibold"
          : "text-text-3 hover:text-text-1 transition-colors"
      }
    >
      {children}
    </Link>
  );
}

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-30 bg-surface border-b border-border h-12 px-4 md:px-6 flex items-center gap-6">
      <Link href="/" className="text-sm font-bold text-primary tracking-tight">
        Onbid
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <NavLink href="/">Overview</NavLink>
        <NavLink href="/analytics">Analytics</NavLink>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2.2: AppShell 작성**

`frontend/src/components/layout/AppShell.tsx`:

```tsx
import TopNav from "./TopNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
```

- [ ] **Step 2.3: FilterDrawer 작성**

`frontend/src/components/layout/FilterDrawer.tsx`:

```tsx
"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function FilterDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={`md:hidden fixed inset-0 z-40 bg-text-1/50 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface shadow-drawer p-4 transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-1">필터</h2>
          <button
            onClick={onClose}
            className="text-text-3 hover:text-text-1 text-lg"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-4rem)]">
          {children}
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2.4: PageWithSidebar 작성**

`frontend/src/components/layout/PageWithSidebar.tsx`:

```tsx
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
```

- [ ] **Step 2.5: `app/layout.tsx` 교체**

현재 파일 전체를 아래로 교체:

```tsx
import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "온비드 공매 대시보드",
  description: "한국자산관리공사 온비드 공매 물건 투자 분석 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-bg">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 2.6: `app/page.tsx` 최상위 구조 교체**

현재 `app/page.tsx` 22~65줄의 `return ( <div className="flex min-h-screen"> ... </div> )` 전체를 아래처럼 교체한다. 내부 JSX(헤더, SummaryStrip, 에러, 로딩, ItemTable)는 색상 클래스는 이후 단계에서 건드리므로 **지금은 구조만** 바꾼다.

기존 22~65줄을 통째로 아래로 대체:

```tsx
  return (
    <PageWithSidebar
      sidebar={<FilterPanel filter={filter} onSearch={handleSearch} />}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[#1a1a18]">온비드 공매 대시보드</h1>
          <p className="text-xs text-[#9c9a92] mt-0.5">한국자산관리공사 공매 물건 투자 분석</p>
        </div>
      </div>

      <SummaryStrip />

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
        <Suspense>
          <ItemTable
            items={items}
            filter={filter}
            onSortChange={(sort) => setFilter({ ...filter, sort })}
          />
        </Suspense>
      )}
    </PageWithSidebar>
  );
```

`app/page.tsx` 상단 import에 다음 줄을 추가:

```tsx
import PageWithSidebar from "@/components/layout/PageWithSidebar";
```

- [ ] **Step 2.7: 빌드/린트 확인**

```bash
cd frontend
npm run lint
```

기대: pass (기존 코드 잔여 경고가 있을 수 있지만 **신규/수정 파일에서 추가된 경고가 없어야 함**).

- [ ] **Step 2.8: 브라우저 검증 (데스크톱)**

dev 서버 http://localhost:3000:
- 상단에 sticky TopNav 노출, 로고 "Onbid" + "Overview"/"Analytics" 탭
- "/" 에서 "Overview" 탭이 primary 색상으로 활성 표시
- 좌측 `w-60` 사이드바에 FilterPanel 렌더
- 기존 모든 기능(필터, 검색, 정렬, 페이지네이션, 행 클릭) 동작
- 브라우저 `/analytics` 접속 시 "Analytics" 탭 활성, **다만** analytics 페이지는 아직 자체 사이드바를 가지고 있어 네브가 중복돼 보일 것이다 (Task 8에서 정리)

- [ ] **Step 2.9: 브라우저 검증 (모바일 — DevTools 375×667)**

DevTools → Device Toolbar → iPhone SE (375×667):
- TopNav는 `md:px-6` → `px-4`로 줄어들고 여전히 보임
- 사이드바(`hidden md:block`) 숨겨짐, 대신 콘텐츠 상단에 "☰ 필터" 버튼 노출
- 버튼 클릭 → 좌측에서 드로어 슬라이드 인, 오버레이(반투명 검정) 깔림
- 드로어 내부에서 필터 입력 가능(기능이 아직 PC 레이아웃이라 숫자 인풋 2단이 깨질 수 있음 — Task 5에서 해결)
- 오버레이 클릭 → 드로어 닫힘
- ESC 키 → 드로어 닫힘
- 드로어 열린 상태에서 body 스크롤 잠김

- [ ] **Step 2.10: 커밋**

```bash
git add frontend/src/components/layout/ frontend/src/app/layout.tsx frontend/src/app/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): add responsive layout shell with mobile filter drawer

AppShell, TopNav, PageWithSidebar, FilterDrawer 4개 레이아웃 컴포넌트
신규 작성. 데스크톱에서는 좌측 사이드바, 모바일(< 768px)에서는
햄버거 트리거로 여는 드로어로 동일한 FilterPanel을 재사용.
루트 레이아웃에서 AppShell 한 번 래핑, 홈 페이지에서
PageWithSidebar로 콘텐츠 감싸 레이아웃 이관.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: SummaryStrip 리스킨

**Files:**
- Modify: `frontend/src/components/SummaryStrip.tsx`

- [ ] **Step 3.1: SummaryStrip 전체 리라이트**

현재 파일 전체(91줄)를 아래로 교체:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSummary } from "@/hooks/useAnalytics";

export default function SummaryStrip() {
  const { data, loading, load } = useSummary();

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-border-strong rounded-lg" />
        ))}
      </div>
    );
  }

  const topRegion = data.by_region[0];
  const topScored = data.top_scored[0];

  const avgRatio =
    data.by_region.length > 0
      ? (
          data.by_region.reduce((s, r) => s + r.avg_ratio * r.count, 0) /
          data.by_region.reduce((s, r) => s + r.count, 0)
        ).toFixed(1)
      : "-";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div className="bg-surface shadow-card rounded-lg p-4">
        <p className="text-xs text-text-3 mb-1">전체 물건</p>
        <p className="text-2xl font-bold text-text-1 tracking-tight tabular-nums">
          {data.total_items.toLocaleString()}
          {data.total_delta != null && (
            <span
              className={`text-sm ml-2 font-semibold ${
                data.total_delta >= 0 ? "text-urgent" : "text-primary"
              }`}
            >
              {data.total_delta >= 0 ? "▲" : "▼"}
              {Math.abs(data.total_delta)}
            </span>
          )}
        </p>
      </div>

      <div className="bg-surface shadow-card rounded-lg p-4">
        <p className="text-xs text-text-3 mb-1">평균 감정가율</p>
        <p className="text-2xl font-bold text-text-1 tracking-tight tabular-nums">
          {avgRatio}%
        </p>
      </div>

      <div className="bg-surface shadow-card rounded-lg p-4">
        <p className="text-xs text-text-3 mb-1">최다 지역</p>
        <p className="text-lg font-bold text-text-1">
          {topRegion ? topRegion.region : "-"}
        </p>
        {topRegion && (
          <p className="text-xs text-text-4 mt-0.5">{topRegion.count}건</p>
        )}
      </div>

      <div className="bg-surface shadow-card rounded-lg p-4">
        <p className="text-xs text-text-3 mb-1">투자 1순위</p>
        {topScored ? (
          <Link
            href={`/items/${topScored.cltr_mng_no}`}
            className="text-sm font-bold text-primary hover:underline line-clamp-1"
          >
            {topScored.name}
          </Link>
        ) : (
          <p className="text-lg font-bold text-text-4">-</p>
        )}
        {topScored && (
          <p className="text-xs text-text-4 mt-0.5">
            점수 {topScored.score} · {topScored.ratio_pct}%
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: 브라우저 검증**

홈 페이지에서:
- KPI 카드 4개 모두 정상 렌더, `border` 없이 부드러운 `shadow-card`
- 숫자는 굵고 tabular-nums로 자릿수 정렬
- 라벨은 slate-500(`text-text-3`)
- "투자 1순위" 이름 클릭 시 상세 이동
- 모바일(375px)에서 `grid-cols-2` 2×2 배치, 스크롤 없음
- 로딩 중 스켈레톤(4개 박스) 펄스 애니메이션

- [ ] **Step 3.3: 커밋**

```bash
git add frontend/src/components/SummaryStrip.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): restyle SummaryStrip to token-based SaaS cards

border + hardcoded hex → shadow-card + token 색상. 숫자 tabular-nums,
델타는 urgent/primary 토큰, 1순위 링크는 primary.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: ItemTable 리스킨 + 모바일 카드 리스트

**Files:**
- Modify: `frontend/src/components/ItemTable.tsx` (전체)

가장 큰 단계. 데스크톱 테이블과 모바일 카드 리스트를 동시에 제공.

- [ ] **Step 4.1: ItemTable 전체 리라이트**

현재 파일 전체(287줄)를 아래로 교체:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { BidItem, FilterState } from "@/types";
import { fmtAmt, dLabel, daysLeft } from "@/utils/format";

const PAGE_SIZE = 50;

interface Props {
  items: BidItem[];
  filter: FilterState;
  onSortChange: (sort: FilterState["sort"]) => void;
}

function RatioPill({ ratio }: { ratio: number }) {
  const cls =
    ratio < 60
      ? "bg-hot-bg text-hot-fg"
      : ratio < 70
      ? "bg-mid-bg text-mid-fg"
      : "bg-ok-bg text-ok-fg";
  return (
    <span
      className={`inline-block ${cls} rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums`}
    >
      {ratio.toFixed(1)}%
    </span>
  );
}

function DeadlineLabel({ dt, pvct }: { dt: string; pvct: boolean }) {
  const dl = daysLeft(dt);
  const cls =
    dl < 0 ? "text-text-4" : dl <= 3 ? "text-urgent font-semibold" : "text-text-2";
  return (
    <div className={`text-xs whitespace-nowrap ${cls}`}>
      <div>{dLabel(dt)}</div>
      {pvct && (
        <span className="inline-block mt-0.5 text-[10px] bg-mid-bg text-mid-fg rounded px-1.5 py-0.5 font-semibold">
          수의계약
        </span>
      )}
    </div>
  );
}

function ratioDot(ratio: number): string {
  if (ratio < 60) return "bg-hot-fg";
  if (ratio < 70) return "bg-mid-fg";
  return "bg-transparent";
}

function isNewToday(firstCollected: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return firstCollected.slice(0, 10) === today;
}

export default function ItemTable({ items, filter, onSortChange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const prevSort = useRef(filter.sort);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPage = Number(params.get("page")) || 1;
    if (urlPage === page) return;
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  }, [page, router]);

  useEffect(() => {
    if (prevSort.current !== filter.sort) {
      prevSort.current = filter.sort;
      setPage(1);
    }
  }, [filter.sort]);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortBtn = ({ val, label }: { val: FilterState["sort"]; label: string }) => (
    <button
      onClick={() => onSortChange(val)}
      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
        filter.sort === val
          ? "bg-primary text-primary-fg border-primary"
          : "bg-surface text-text-2 border-border-strong hover:border-primary hover:text-primary"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* 정렬 툴바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-3">정렬:</span>
        <SortBtn val="ratio" label="비율 ↑" />
        <SortBtn val="usbd" label="유찰횟수" />
        <SortBtn val="deadline" label="마감일" />
        <span className="ml-auto text-xs text-text-4 tabular-nums">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} / 총 {items.length}건
        </span>
      </div>

      {/* 빈 상태 */}
      {items.length === 0 && (
        <div className="bg-surface shadow-card rounded-lg py-12 text-center text-sm text-text-4">
          조건에 맞는 물건이 없습니다
        </div>
      )}

      {/* 데스크톱: 테이블 */}
      {items.length > 0 && (
        <div className="hidden md:block overflow-x-auto bg-surface shadow-card rounded-xl">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-muted border-b border-border">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">물건번호</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3">소재지</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">용도</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">감정가</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">최저입찰가</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">감정가 대비</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3">회차</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3">유찰</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-text-3 whitespace-nowrap">마감일</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const dl = daysLeft(item.cltr_bid_end_dt);
                const expired = dl < 0 && item.pvct_trgt_yn !== "Y";
                const pvct = dl < 0 && item.pvct_trgt_yn === "Y";
                return (
                  <tr
                    key={item.cltr_mng_no}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      expired
                        ? "opacity-50 hover:opacity-70"
                        : pvct
                        ? "bg-mid-bg/30 hover:bg-mid-bg/50 border-l-2 border-l-mid-fg"
                        : "hover:bg-surface-muted"
                    }`}
                    onClick={() => router.push(`/items/${item.cltr_mng_no}`)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ratioDot(item.ratio_pct)}`} />
                        <span className="text-xs text-text-3 font-mono">{item.cltr_mng_no}</span>
                        {isNewToday(item.first_collected_at) && (
                          <span className="text-[10px] bg-new text-primary-fg rounded-sm px-1.5 py-0.5 font-bold">
                            NEW
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm text-text-1 font-medium truncate max-w-[180px]">
                        {item.onbid_cltr_nm}
                      </div>
                      <div className="text-xs text-text-3 mt-0.5">
                        {item.lctn_sd_nm} {item.lctn_sggn_nm}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs text-text-3">{item.cltr_usg_mcls_nm}</div>
                      <div className="text-xs text-text-4 mt-0.5">{item.cltr_usg_scls_nm}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm text-text-2 tabular-nums">
                      {fmtAmt(item.apsl_evl_amt)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-medium text-primary tabular-nums">
                      {fmtAmt(item.lowst_bid_prc)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <RatioPill ratio={item.ratio_pct} />
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-text-2 tabular-nums">
                      {Number(item.pbct_nsq)}회차
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-text-2">
                      {item.usbd_nft > 0 ? (
                        <span className="bg-mid-bg text-mid-fg rounded px-1.5 py-0.5 text-xs font-semibold">
                          {item.usbd_nft}회
                        </span>
                      ) : (
                        <span className="text-text-4">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <DeadlineLabel dt={item.cltr_bid_end_dt} pvct={pvct} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/items/${item.cltr_mng_no}`);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        상세 →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 모바일: 카드 리스트 */}
      {items.length > 0 && (
        <div className="md:hidden flex flex-col gap-2">
          {pageItems.map((item) => {
            const dl = daysLeft(item.cltr_bid_end_dt);
            const expired = dl < 0 && item.pvct_trgt_yn !== "Y";
            const pvct = dl < 0 && item.pvct_trgt_yn === "Y";
            return (
              <button
                key={item.cltr_mng_no}
                onClick={() => router.push(`/items/${item.cltr_mng_no}`)}
                className={`text-left bg-surface shadow-card rounded-lg p-3 flex flex-col gap-1 transition-opacity ${
                  expired ? "opacity-50" : ""
                } ${pvct ? "border-l-2 border-l-mid-fg" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-text-1 truncate flex-1">
                    {item.onbid_cltr_nm}
                  </div>
                  <RatioPill ratio={item.ratio_pct} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-3">
                  <span className="font-mono">{item.cltr_mng_no}</span>
                  {isNewToday(item.first_collected_at) && (
                    <span className="text-[10px] bg-new text-primary-fg rounded-sm px-1.5 py-0.5 font-bold">
                      NEW
                    </span>
                  )}
                  <span>·</span>
                  <span>{item.lctn_sd_nm} {item.lctn_sggn_nm}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-semibold text-primary tabular-nums">
                    {fmtAmt(item.lowst_bid_prc)}
                  </span>
                  <DeadlineLabel dt={item.cltr_bid_end_dt} pvct={pvct} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 범례 + 페이지네이션 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-1">
        <div className="flex items-center gap-4 text-xs text-text-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-hot-fg" />
            <span>60% 미만</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-mid-fg" />
            <span>60~70%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-border-strong" />
            <span>70% 이상</span>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-text-4">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors tabular-nums ${
                      page === p
                        ? "bg-primary text-primary-fg border-primary"
                        : "border-border-strong hover:border-primary hover:text-primary"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-md border border-border-strong disabled:opacity-30 hover:border-primary hover:text-primary transition-colors"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**주요 변경 요약**:
- `border`/하드코딩 hex 전부 제거, 토큰 유틸리티로
- 감정가 대비: 평문 + 진행바 → `RatioPill` 컴포넌트
- NEW 배지: `bg-[#185fa5]` → `bg-new`
- 유찰/수의계약 강조: `bg-amber-*` → `bg-mid-*` 토큰
- 만료 행: `opacity-40` → `opacity-50`
- 수의계약 행: `border-l-amber-400 bg-amber-50` → `border-l-mid-fg bg-mid-bg/30`
- 모바일 카드 리스트 (`md:hidden`) 신규

- [ ] **Step 4.2: 타입체크/린트**

```bash
cd frontend && npm run lint
```

- [ ] **Step 4.3: 브라우저 검증 (데스크톱 1280px)**

홈 페이지에서:
- 테이블이 `shadow-card`로 부드럽게 감싸짐, 테두리 border 없음
- 감정가 대비 열: 색상 pill 형태 (빨강/호박/초록)
- 유찰 수: 1회 이상이면 `mid` 톤 배지
- NEW 뱃지: indigo primary 색
- 수의계약(과거 마감 + Y) 행: 왼쪽 2px 호박 바 + 연한 호박 배경
- 만료 행: opacity 50%
- 정렬 3개 버튼 클릭, 페이지네이션 이동, 행 클릭 → 상세 이동 모두 동작
- 하단 범례 점 색상이 hot/mid 토큰과 일치

- [ ] **Step 4.4: 브라우저 검증 (모바일 375×667)**

홈 페이지에서:
- 테이블 대신 카드 리스트 노출 (`md:hidden` / `hidden md:block` 전환 확인)
- 각 카드: 물건명 + RatioPill, 물건번호 + NEW + 지역, 하단에 가격 + 마감일
- 카드 탭 → 상세 이동
- 수의계약 카드는 왼쪽 바 강조
- 가로 스크롤 없음
- 페이지네이션이 카드 리스트 아래 세로 스택으로 정상 표시

- [ ] **Step 4.5: 커밋**

```bash
git add frontend/src/components/ItemTable.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): restyle ItemTable with pills, tokens, mobile card list

감정가 대비 열을 RatioPill(3-bucket hot/mid/ok)로 치환, 진행바 제거.
테이블 컨테이너는 shadow-card로. 모바일(md 미만)에서는 카드 리스트로
자동 전환. 정렬 툴바·페이지네이션 모두 토큰 기반으로 교체.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FilterPanel 리스킨 + 드로어 내 레이아웃 polish

**Files:**
- Modify: `frontend/src/components/FilterPanel.tsx`

- [ ] **Step 5.1: FilterPanel 전체 리라이트**

현재 파일 전체(251줄)를 아래로 교체:

```tsx
"use client";

import { useState } from "react";
import type { FilterState } from "@/types";

const USG_TREE: Record<string, string[]> = {
  "상가용및업무용건물": ["업무시설"],
  "용도복합용건물": ["오피스텔", "주/상용건물"],
};

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

function ratioLabel(v: number): { text: string; color: string } {
  if (v < 50) return { text: "최우선 검토", color: "text-hot-fg" };
  if (v < 60) return { text: "우선 검토", color: "text-hot-fg" };
  if (v < 70) return { text: "적극 검토", color: "text-mid-fg" };
  if (v < 80) return { text: "일반 관심", color: "text-mid-fg" };
  return { text: "관심 낮음", color: "text-text-4" };
}

interface Props {
  filter: FilterState;
  onSearch: (f: FilterState) => void;
}

export default function FilterPanel({ filter, onSearch }: Props) {
  const [local, setLocal] = useState<FilterState>(filter);

  const label = ratioLabel(local.ratio_max);

  function reset() {
    const def: FilterState = {
      ratio_min: 0,
      ratio_max: 100,
      price_min: null,
      price_max: null,
      usbd_min: 0,
      sd_nm: "",
      usg_mcls: "",
      usg_scls: "",
      bookmarked: null,
      pvct: null,
      sort: local.sort,
    };
    setLocal(def);
  }

  const sclsOptions = local.usg_mcls ? USG_TREE[local.usg_mcls] ?? [] : [];

  const numInput =
    "text-xs border border-border-strong rounded-md px-2 py-1 bg-surface text-text-1 focus:outline-none focus:border-primary";
  const selInput =
    "text-xs border border-border-strong rounded-md px-2 py-1.5 bg-surface text-text-1 focus:outline-none focus:border-primary disabled:opacity-40";

  return (
    <div className="p-4 flex flex-col gap-5">
      <h2 className="hidden md:block text-sm font-semibold text-text-1 border-b border-border pb-2">
        필터
      </h2>

      {/* 감정가 대비 비율 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-2">감정가 대비 비율</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={local.ratio_min}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocal({ ...local, ratio_min: Math.min(v, local.ratio_max) });
            }}
            className={`${numInput} w-16 text-center`}
          />
          <span className="text-xs text-text-3">~</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={local.ratio_max}
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocal({ ...local, ratio_max: Math.max(v, local.ratio_min) });
            }}
            className={`${numInput} w-16 text-center`}
          />
          <span className="text-xs text-text-3">%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={local.ratio_max}
          onChange={(e) => {
            const v = Number(e.target.value);
            setLocal({ ...local, ratio_max: Math.max(v, local.ratio_min) });
          }}
          className="w-full accent-primary"
        />
        <span className={`text-xs font-medium ${label.color}`}>{label.text}</span>
      </div>

      {/* 최저입찰가 범위 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-text-2">최저입찰가</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="number"
            min={0}
            step={1000}
            placeholder="하한"
            value={local.price_min != null ? local.price_min / 10000 : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setLocal({ ...local, price_min: raw === "" ? null : Number(raw) * 10000 });
            }}
            className={`${numInput} w-[84px] text-right`}
          />
          <span className="text-xs text-text-3">~</span>
          <input
            type="number"
            min={0}
            step={1000}
            placeholder="상한"
            value={local.price_max != null ? local.price_max / 10000 : ""}
            onChange={(e) => {
              const raw = e.target.value;
              setLocal({ ...local, price_max: raw === "" ? null : Number(raw) * 10000 });
            }}
            className={`${numInput} w-[84px] text-right`}
          />
          <span className="text-xs text-text-3 shrink-0">만원</span>
        </div>
      </div>

      {/* 유찰 횟수 최소 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-2">유찰 횟수 최소</label>
        <select
          value={local.usbd_min}
          onChange={(e) => setLocal({ ...local, usbd_min: Number(e.target.value) })}
          className={selInput}
        >
          <option value={0}>전체</option>
          <option value={1}>1회 이상</option>
          <option value={2}>2회 이상</option>
          <option value={3}>3회 이상</option>
          <option value={5}>5회 이상</option>
        </select>
      </div>

      {/* 용도 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-2">용도</label>
        <select
          value={local.usg_mcls}
          onChange={(e) => setLocal({ ...local, usg_mcls: e.target.value, usg_scls: "" })}
          className={selInput}
        >
          <option value="">중분류 전체</option>
          {Object.keys(USG_TREE).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={local.usg_scls}
          onChange={(e) => setLocal({ ...local, usg_scls: e.target.value })}
          disabled={!local.usg_mcls}
          className={selInput}
        >
          <option value="">소분류 전체</option>
          {sclsOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* 지역 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-2">지역</label>
        <select
          value={local.sd_nm}
          onChange={(e) => setLocal({ ...local, sd_nm: e.target.value })}
          className={selInput}
        >
          <option value="">전체</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* 수의계약 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-2">수의계약</label>
        <div className="flex gap-2">
          {([null, "Y", "N"] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => setLocal({ ...local, pvct: val })}
              className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                local.pvct === val
                  ? "bg-primary text-primary-fg border-primary"
                  : "bg-surface text-text-2 border-border-strong hover:border-primary hover:text-primary"
              }`}
            >
              {val === null ? "전체" : val === "Y" ? "가능" : "불가능"}
            </button>
          ))}
        </div>
      </div>

      {/* 관심물건만 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="bookmarked"
          checked={local.bookmarked === 1}
          onChange={(e) => setLocal({ ...local, bookmarked: e.target.checked ? 1 : null })}
          className="accent-primary"
        />
        <label htmlFor="bookmarked" className="text-xs text-text-2 cursor-pointer">
          관심 물건만
        </label>
      </div>

      {/* 버튼 */}
      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={() => onSearch(local)}
          className="w-full bg-primary text-primary-fg text-sm py-2 rounded-md font-medium hover:bg-primary-hover transition-colors"
        >
          검색
        </button>
        <button
          onClick={reset}
          className="w-full bg-surface border border-border-strong text-text-2 text-sm py-2 rounded-md hover:bg-surface-muted transition-colors"
        >
          초기화
        </button>
      </div>
    </div>
  );
}
```

**변경 요약**:
- 최상위 `<aside className="w-[230px] ... min-h-screen">` 제거 → `<div className="p-4 flex flex-col gap-5">` (너비·높이·배경은 상위 `PageWithSidebar`와 `FilterDrawer`가 담당)
- 필터 바깥 래퍼에 있던 `<h2>필터</h2>`는 드로어에 이미 헤더가 있으므로 데스크톱에서만 표시 (`hidden md:block`)
- 인풋/셀렉트 공통 스타일 상수화(`numInput`, `selInput`)
- 폭이 좁은 드로어(288px)에서 숫자 인풋 2개가 줄바꿈되도록 `flex-wrap` 추가

- [ ] **Step 5.2: 브라우저 검증 (데스크톱)**

홈 페이지 좌측 사이드바:
- 모든 필드 정상, 색상이 surface/border-strong/text-2 토큰
- "필터" 제목 노출
- 감정가 대비 슬라이더 라벨이 hot/mid/text-4 토큰
- 검색 버튼 primary, 초기화 버튼 surface
- 수의계약 3-way 토글: 선택 시 primary 배경
- 관심물건 체크박스 accent가 primary

- [ ] **Step 5.3: 브라우저 검증 (모바일)**

- 햄버거 버튼 → 드로어 오픈
- 드로어 내부에 필터 전체 필드 렌더, 드로어 자체 헤더("필터" + ✕)가 한 번만 노출 (FilterPanel 자체 `<h2>`는 `hidden md:block`이라 안 나옴)
- 288px 좁은 폭에서 숫자 인풋 2개가 줄바꿈되어 2단으로 배치됨 (겹치지 않음)
- 모든 셀렉트가 풀폭으로 확장
- 필터 변경 → 검색 클릭 시 반영 (단, **드로어는 자동으로 닫히지 않음** — 사용자가 ✕/오버레이로 직접 닫음. 이는 의도된 동작)

- [ ] **Step 5.4: 커밋**

```bash
git add frontend/src/components/FilterPanel.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): restyle FilterPanel with tokens, drop layout wrapper

필터 UI에서 aside/width/bg를 제거해서 사이드바와 드로어 양쪽에서
깔끔하게 주입되도록 순화. 숫자 입력 flex-wrap으로 좁은 폭 대응.
모든 border/bg/text를 토큰으로.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Detail Hero + 상세 페이지 셸

**Files:**
- Modify: `frontend/src/components/detail/HeroSection.tsx`
- Modify: `frontend/src/app/items/[id]/page.tsx` (nav/탭바/배너 영역)

- [ ] **Step 6.1: HeroSection 리라이트**

현재 파일 전체(172줄)를 아래로 교체:

```tsx
"use client";

import { fmtKRW, fmtAmt, sqmsToPyeong, dLabel, daysLeft } from "@/utils/format";
import type { BidItem } from "@/types";

interface Props {
  item: BidItem;
  onBookmark: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

function DeadlinePill({ dt }: { dt: string }) {
  const dl = daysLeft(dt);
  const cls =
    dl < 0
      ? "bg-border text-text-4"
      : dl <= 3
      ? "bg-hot-bg text-hot-fg"
      : "bg-primary-subtle text-primary";
  return (
    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${cls}`}>
      {dLabel(dt)}
    </span>
  );
}

function RatioText({ r }: { r: number }) {
  const cls = r < 60 ? "text-hot-fg" : r < 70 ? "text-mid-fg" : "text-ok-fg";
  return <span className={`text-base font-bold ${cls} tabular-nums`}>{r.toFixed(1)}%</span>;
}

export default function HeroSection({ item, onBookmark, onRefresh, refreshing }: Props) {
  return (
    <div className="bg-surface shadow-card rounded-xl p-5 md:p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* 썸네일 */}
        <div className="w-full md:w-52 h-40 shrink-0 rounded-lg overflow-hidden bg-surface-muted flex items-center justify-center text-center">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-3xl">🏢</span>
            <span className="text-xs text-text-4">{item.cltr_usg_scls_nm}</span>
          </div>
        </div>

        {/* 정보 */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* 배지 */}
          <div className="flex flex-wrap gap-1.5">
            {item.ratio_pct < 60 && (
              <span className="text-xs bg-hot-bg text-hot-fg rounded-full px-2 py-0.5 font-medium">
                60% 미만 알림
              </span>
            )}
            {item.pvct_trgt_yn === "Y" && (
              <span className="text-xs bg-primary-subtle text-primary rounded-full px-2 py-0.5 font-medium">
                수의계약
              </span>
            )}
            {item.alc_yn === "Y" && (
              <span className="text-xs bg-border text-text-3 rounded-full px-2 py-0.5">
                지분물건
              </span>
            )}
            <span className="text-xs bg-border text-text-3 rounded-full px-2 py-0.5">
              {item.prpt_div_nm}
            </span>
            <DeadlinePill dt={item.cltr_bid_end_dt} />
          </div>

          {/* 물건명/주소 */}
          <div>
            <p className="text-xs text-text-3 font-mono">{item.cltr_mng_no}</p>
            <h1 className="text-xl md:text-2xl font-bold text-text-1 tracking-tight mt-0.5">
              {item.onbid_cltr_nm}
            </h1>
            <p className="text-sm text-text-2 mt-1">
              {item.lctn_sd_nm} {item.lctn_sggn_nm} {item.lctn_emd_nm}
            </p>
            <p className="text-xs text-text-4 mt-0.5">
              건물 {sqmsToPyeong(item.bld_sqms)}
              {item.land_sqms != null && ` / 토지 ${sqmsToPyeong(item.land_sqms)}`}
            </p>
          </div>

          {/* 핵심 4수치 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-surface-muted rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-text-4 mb-1">감정가 대비</p>
              <RatioText r={item.ratio_pct} />
            </div>
            <div className="bg-surface-muted rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-text-4 mb-1">회차</p>
              <p className="text-base font-bold text-text-1 tabular-nums">{Number(item.pbct_nsq)}회</p>
            </div>
            <div className="bg-surface-muted rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-text-4 mb-1">유찰 횟수</p>
              <p className="text-base font-bold text-text-1 tabular-nums">{item.usbd_nft}회</p>
            </div>
            <div className="bg-primary-subtle rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-primary mb-1">AI 점수</p>
              {item.score != null ? (
                <>
                  <p
                    className={`text-base font-bold tabular-nums ${
                      item.score >= 70 ? "text-primary-hover" : item.score >= 50 ? "text-primary" : "text-text-4"
                    }`}
                  >
                    {item.score}점
                  </p>
                  {item.score_breakdown && (
                    <div className="flex justify-center gap-1.5 mt-1">
                      <span className="text-[10px] text-primary">비율 {item.score_breakdown.ratio}</span>
                      <span className="text-[10px] text-primary">유찰 {item.score_breakdown.fail}</span>
                      <span className="text-[10px] text-primary">입지 {item.score_breakdown.location}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-base text-text-4">-</p>
              )}
            </div>
          </div>

          {/* 가격 */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-sm text-text-4 line-through tabular-nums">{fmtKRW(item.apsl_evl_amt)}</span>
            <span className="text-2xl font-bold text-primary tabular-nums tracking-tight">
              {fmtKRW(item.lowst_bid_prc)}
            </span>
          </div>

          {/* 게이지바 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-4 w-6">0%</span>
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.ratio_pct < 60 ? "bg-hot-fg" : item.ratio_pct < 70 ? "bg-mid-fg" : "bg-ok-fg"
                }`}
                style={{ width: `${Math.min(item.ratio_pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-text-4 w-8">100%</span>
          </div>
        </div>

        {/* 액션 */}
        <div className="flex md:flex-col gap-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium border border-ok-fg/30 bg-ok-bg text-ok-fg hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {refreshing ? "갱신 중..." : "↻ 새로고침"}
          </button>
          <button
            onClick={onBookmark}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              item.is_bookmarked
                ? "bg-mid-bg text-mid-fg border-mid-fg/30"
                : "bg-surface text-text-2 border-border-strong hover:border-primary"
            }`}
          >
            {item.is_bookmarked ? "★ 관심 해제" : "☆ 관심 등록"}
          </button>
          <a
            href={`https://www.onbid.co.kr/op/cta/cuiAuctRlsInfo/selectCuiAuctRlsInfoDtl.do?cltrMngNo=${item.cltr_mng_no}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-fg hover:bg-primary-hover transition-colors text-center"
          >
            온비드 →
          </a>
        </div>
      </div>
    </div>
  );
}
```

**변경 요약**:
- 외곽 배경 `bg-[#faf9f7] border-...` → `bg-surface shadow-card`
- 모바일: `flex-col`로 썸네일/정보/액션 세로 스택, 4수치는 `grid-cols-2`
- 모든 색상 토큰화, AI 점수 카드는 `bg-gradient-to-br`에서 `bg-primary-subtle`로 단순화

- [ ] **Step 6.2: `app/items/[id]/page.tsx` 상단 셸 교체**

`app/items/[id]/page.tsx`의 108~141줄(현재 nav 부분) + 143줄 `<div className="max-w-5xl ...">` + 167~184줄(탭바)을 아래처럼 교체한다.

기존 108~202줄(전체 return 블록)을 다음으로 대체:

```tsx
  const dl = daysLeft(item.cltr_bid_end_dt);

  return (
    <div className="bg-bg">
      {/* 상세 서브 네브 (루트 TopNav 아래) */}
      <div className="sticky top-12 z-20 bg-surface border-b border-border px-4 md:px-6 h-10 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          ← 목록
        </button>
        <span className="text-border-strong">/</span>
        <span className="text-sm text-text-3 truncate flex-1 min-w-0">{item.onbid_cltr_nm}</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col gap-4 md:gap-6">
        {/* 종료 / 수의계약 배너 */}
        {closed && item.pvct_trgt_yn === "Y" && (
          <div className="bg-primary-subtle border border-primary/20 rounded-lg px-5 py-3 flex items-center gap-3">
            <span className="text-lg">📋</span>
            <div>
              <p className="text-sm font-semibold text-primary-hover">수의계약 가능 물건입니다</p>
              <p className="text-xs text-primary mt-0.5">정규 입찰은 종료되었으나, 수의계약으로 매수할 수 있습니다.</p>
            </div>
          </div>
        )}
        {closed && item.pvct_trgt_yn !== "Y" && (
          <div className="bg-hot-bg border border-hot-fg/20 rounded-lg px-5 py-3 flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-hot-fg">이 물건은 종료되었습니다</p>
              <p className="text-xs text-hot-fg/80 mt-0.5">온비드에서 낙찰·취소 처리되어 더 이상 입찰할 수 없습니다.</p>
            </div>
          </div>
        )}

        {/* Hero */}
        <HeroSection item={item} onBookmark={handleBookmark} onRefresh={handleRefresh} refreshing={refreshing} />

        {/* 탭 */}
        <div className="bg-surface shadow-card rounded-xl overflow-hidden">
          <div className="flex border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary text-primary font-semibold"
                    : "text-text-3 hover:text-text-1 hover:bg-surface-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6">
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
```

또한 loading/error 상단부(80~102줄)의 하드코딩 hex를 다음처럼 교체:

80~89줄의 loading JSX를 아래로 대체:

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-48px)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-3">물건 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }
```

91~102줄의 error JSX를 아래로 대체:

```tsx
  if (error || !item) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-48px)]">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-1 mb-2">물건을 찾을 수 없습니다</p>
          <Link href="/" className="text-sm text-primary underline">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }
```

104~106줄의 미사용 변수 제거 (변수 `deadlinePillColor`는 이제 `DeadlinePill` 컴포넌트가 HeroSection 내부에서 처리하므로 상세 페이지 nav에서 쓰지 않음; 이전 버전에선 nav에 있던 deadline pill/bookmark 버튼/온비드 링크를 제거했기 때문). `dl` 변수도 더 이상 안 쓰이면 제거.

수정된 부분을 반영한 실제 차이:
- 원래 페이지 내 nav(108~141줄)에서 북마크·온비드 버튼·마감 pill이 있었음
- 이들을 제거 — 모두 HeroSection 내부에 이미 중복되어 있으므로 DRY
- 서브 nav는 "← 목록 / 물건명" 브레드크럼만 남김
- 상단 여백은 `sticky top-12` (TopNav 높이 48px 아래)

- [ ] **Step 6.3: 타입체크/린트**

```bash
cd frontend && npm run lint
```

미사용 import(`dLabel`, `daysLeft`는 HeroSection에만 필요)가 발생하면 제거:

```tsx
// app/items/[id]/page.tsx 상단의 import에서 dLabel 제거
import { daysLeft } from "@/utils/format";
// 혹은 daysLeft도 쓰이지 않으면 import 자체 삭제 (lint가 알려줌)
```

- [ ] **Step 6.4: 브라우저 검증**

상세 페이지 (`/items/{id}`) 데스크톱:
- 상단: TopNav(루트) + 그 아래 서브 nav (`← 목록 / 물건명`)
- Hero 카드: shadow-card, 썸네일 왼쪽, 정보 중앙, 액션 오른쪽 세로
- 배지들 색상 토큰
- 4수치 카드: AI 점수가 primary-subtle 배경
- 새로고침/관심/온비드 버튼 동작
- 탭바: 활성 탭이 `border-b-2 border-primary text-primary font-semibold`

모바일:
- Hero 내용이 세로 스택 (썸네일 풀폭 → 정보 → 액션은 가로 스택)
- 4수치 `grid-cols-2` 2×2
- 탭바는 가로 스크롤

- [ ] **Step 6.5: 커밋**

```bash
git add frontend/src/components/detail/HeroSection.tsx frontend/src/app/items/\[id\]/page.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): restyle detail hero + shell, tokens + mobile-stack

상세 페이지 내부 중복 nav(북마크/온비드 버튼)를 HeroSection으로 통합,
상단은 브레드크럼만 남김. Hero는 shadow-card + mobile flex-col 대응.
탭바는 border-b-2 primary 강조.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Detail 탭 + 공용 컴포넌트 리스킨 (batch)

**Files:**
- Modify: `frontend/src/components/LabeledTable.tsx`
- Modify: `frontend/src/components/StatsBar.tsx`
- Modify: `frontend/src/components/detail/TabInfo.tsx`
- Modify: `frontend/src/components/detail/TabChecklist.tsx`
- Modify: `frontend/src/components/detail/TabRisk.tsx`
- Modify: `frontend/src/components/detail/TabProfit.tsx`
- Modify: `frontend/src/components/detail/TabTenant.tsx`
- Modify: `frontend/src/components/detail/TabHistory.tsx`

각 파일마다 동일한 매핑 원칙을 적용 (검색/치환 기반 + 특정 스팟의 pill 변환). 이 태스크는 길지만 각 서브스텝이 독립적으로 커밋 가능하다.

### 공통 치환 매핑

이 Task 내내 아래 매핑을 반복 적용한다:

| Before (하드코딩) | After (토큰) |
|---|---|
| `bg-[#faf9f7]` | `bg-surface-muted` |
| `bg-[#f3f2ee]` | `bg-bg` |
| `bg-[#f5f4f0]` | `bg-surface-muted` |
| `bg-white` | `bg-surface` |
| `border-[#e8e6df]` | `border-border` |
| `border-[#d3d1c7]` | `border-border-strong` |
| `text-[#1a1a18]` | `text-text-1` |
| `text-[#3d3d3a]` | `text-text-2` |
| `text-[#5f5e5a]` | `text-text-3` |
| `text-[#73726c]` | `text-text-3` |
| `text-[#9c9a92]` | `text-text-4` |
| `text-[#6b6960]` | `text-text-3` |
| `text-[#185fa5]` | `text-primary` |
| `bg-[#185fa5]` | `bg-primary` |
| `hover:bg-[#14508f]` | `hover:bg-primary-hover` |
| `border-[#f0efe9]` | `border-border` |
| `focus:border-[#185fa5]` | `focus:border-primary` |
| `bg-red-100 text-red-700 border-red-300` | `bg-hot-bg text-hot-fg` (border 제거) |
| `bg-amber-100 text-amber-700 border-amber-300` | `bg-mid-bg text-mid-fg` |
| `bg-green-100 text-green-700 border-green-300` | `bg-ok-bg text-ok-fg` |
| `bg-red-50 ... text-red-7xx` | `bg-hot-bg text-hot-fg` |
| `bg-amber-50 ... text-amber-7xx` | `bg-mid-bg text-mid-fg` |
| `bg-green-50 ... text-green-7xx` | `bg-ok-bg text-ok-fg` |
| `bg-blue-50 text-blue-700` | `bg-primary-subtle text-primary` |
| `text-red-600`/`text-red-7xx` (단독) | `text-hot-fg` |
| `text-amber-7xx`/`text-amber-6xx` (단독) | `text-mid-fg` |
| `text-green-7xx`/`text-green-6xx` (단독) | `text-ok-fg` |
| `text-gray-400` | `text-text-4` |
| `text-gray-500` | `text-text-3` |
| `text-gray-600` | `text-text-2` |
| `bg-gray-50` | `bg-surface-muted` |
| `bg-gray-100` | `bg-border` |
| `border-gray-100` | `border-border` |
| `border-gray-300` | `border-border-strong` |
| `hover:bg-blue-50` | `hover:bg-primary-subtle` |
| `accent-[#185fa5]` | `accent-primary` |
| `border border-[#d3d1c7]` 를 카드에 쓴 경우 | `shadow-card` (border 제거) |

`bg-[#faf9f7] border border-[#e8e6df] rounded-xl` 같은 "카드 래퍼" 패턴은 `bg-surface shadow-card rounded-xl`로 교체 (border 제거).

- [ ] **Step 7.1: LabeledTable 교체**

현재 파일 전체(37줄)를 아래로 교체:

```tsx
export type ColDef = { key: string; label: string; fmt?: (v: unknown) => string };

export function LabeledTable({ data, columns }: { data: Record<string, unknown>[]; columns: ColDef[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-text-4 py-2">데이터 없음</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-card">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-surface-muted border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className="px-2.5 py-2 text-left text-text-3 font-normal whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {columns.map((c) => {
                const v = row[c.key];
                const display = c.fmt ? c.fmt(v) : (v == null || v === "" ? "-" : String(v));
                return (
                  <td key={c.key} className="px-2.5 py-2 text-text-2 whitespace-nowrap">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7.2: StatsBar 교체**

현재 파일 전체(45줄)를 아래로 교체:

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchStats } from "@/api";
import type { Stats } from "@/types";

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return null;
  if (!stats) {
    return <div className="h-10 bg-surface shadow-card rounded-lg animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-3 bg-surface shadow-card rounded-lg px-4 py-2 text-sm flex-wrap">
      <span className="text-text-3 text-xs">통계</span>
      <span className="inline-flex items-center gap-1 bg-hot-bg text-hot-fg rounded-full px-2 py-0.5 text-xs font-medium">
        60% 미만 <span className="font-bold">{stats.ratio_below60}</span>건
      </span>
      <span className="inline-flex items-center gap-1 bg-mid-bg text-mid-fg rounded-full px-2 py-0.5 text-xs font-medium">
        60~70% <span className="font-bold">{stats.ratio_60_70}</span>건
      </span>
      <span className="inline-flex items-center gap-1 bg-primary-subtle text-primary rounded-full px-2 py-0.5 text-xs font-medium">
        전체 <span className="font-bold">{stats.total}</span>건
      </span>
      <span className="ml-auto text-xs text-text-3">
        수의계약 가능 <span className="font-semibold text-primary">{stats.pvct_count}</span>건
      </span>
    </div>
  );
}
```

- [ ] **Step 7.3: TabInfo 색상 치환**

`frontend/src/components/detail/TabInfo.tsx`에서 `InfoRow` (105~110줄) 교체:

```tsx
  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex gap-2 py-2 border-b border-border last:border-0">
      <span className="text-xs text-text-4 w-28 shrink-0">{label}</span>
      <span className="text-xs text-text-1 flex-1">{value}</span>
    </div>
  );
```

112~210줄의 return 블록에서 하드코딩된 hex를 위 매핑 표 대로 모두 교체. 핵심 변환:
- `bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5` (2군데, 115/181줄) → `bg-surface shadow-card rounded-xl p-5`
- `text-[#1a1a18]` 모든 인스턴스 → `text-text-1`
- `text-[#9c9a92]` → `text-text-4`
- `text-[#3d3d3a]` → `text-text-2`
- `text-[#5f5e5a]` → `text-text-3`
- `text-red-500` (133줄) → `text-hot-fg`
- `bg-gray-50 border border-[#e8e6df]` (162줄) → `bg-surface-muted border border-border` (유지)
- `bg-gray-100` (194줄, KAKAO 코드 뱃지) → 유지(브랜드 색상: `bg-[#FEE500]`은 카카오 공식이므로 그대로 둔다)
- `text-[#185fa5]` (197줄) → `text-primary`
- `text-[#3d3d3a]` (183줄) → `text-text-2`
- 지도 InfoWindow의 `background:#185fa5` (81줄 custom overlay CSS 안)은 런타임 인라인 스타일이므로 `var(--color-primary)`로 교체하지 않고 **그대로 둔다** (JS 문자열 내 CSS, Tailwind가 처리하지 않음).

- [ ] **Step 7.4: TabChecklist 색상 치환**

`LEVEL_STYLE` (22~26줄) 교체:

```tsx
const LEVEL_STYLE: Record<string, string> = {
  HIGH: "bg-hot-bg text-hot-fg",
  MID: "bg-mid-bg text-mid-fg",
  LOW: "bg-border text-text-3",
};
```

JSX 내 모든 하드코딩을 아래처럼 치환:
- `bg-[#faf9f7] border border-[#e8e6df] rounded-xl` (3곳, 80/96/143줄) → `bg-surface shadow-card rounded-xl`
- `divide-[#e8e6df]` (96줄) → `divide-border`
- `text-[#1a1a18]`, `text-[#185fa5]`, `bg-[#185fa5]`, `text-[#3d3d3a]`, `text-[#9c9a92]`, `text-[#73726c]`, `bg-gray-200` 각각 매핑대로
- `bg-gray-200` (진행바 배경, 87줄) → `bg-border`
- `bg-[#185fa5]` (진행바 채우기, 89줄) → `bg-primary`
- `accent-[#185fa5]` → `accent-primary`
- 체크 완료 시 `line-through text-[#9c9a92]` → `line-through text-text-4`
- 셀렉트/인풋 `border-[#d3d1c7]` → `border-border-strong`, `focus:border-[#185fa5]` → `focus:border-primary`
- 추가 버튼 `bg-[#185fa5] text-white hover:bg-[#14508f]` → `bg-primary text-primary-fg hover:bg-primary-hover`

- [ ] **Step 7.5: TabRisk 색상 치환**

`StatusPill` (18~36줄)을 아래로 교체:

```tsx
function StatusPill({ status }: { status: Status }) {
  if (status === "ok")
    return (
      <span className="text-xs bg-ok-bg text-ok-fg rounded-full px-2 py-0.5 font-medium">
        양호
      </span>
    );
  if (status === "warn")
    return (
      <span className="text-xs bg-mid-bg text-mid-fg rounded-full px-2 py-0.5 font-medium">
        주의
      </span>
    );
  return (
    <span className="text-xs bg-border text-text-3 rounded-full px-2 py-0.5">
      확인 필요
    </span>
  );
}
```

요약 카드(98~114줄) 교체:

```tsx
      <div className={`rounded-xl p-4 ${
        warnCount >= 3
          ? "bg-hot-bg"
          : warnCount >= 1
          ? "bg-mid-bg"
          : "bg-ok-bg"
      }`}>
        <p className={`text-sm font-semibold ${
          warnCount >= 3 ? "text-hot-fg" : warnCount >= 1 ? "text-mid-fg" : "text-ok-fg"
        }`}>
          {warnCount >= 3
            ? `주의 항목 ${warnCount}개 — 신중한 검토 필요`
            : warnCount >= 1
            ? `주의 항목 ${warnCount}개 — 확인 필요`
            : "전체 양호"}
        </p>
      </div>
```

리스트 래퍼(116줄) → `bg-surface shadow-card rounded-xl divide-y divide-border`.
내부 라벨(121줄) → `text-text-1`, 설명(122줄) → `text-text-3`.

- [ ] **Step 7.6: TabProfit 색상 치환**

`StatusBanner` (124~137줄):

```tsx
function StatusBanner({ icon, title, desc, extra }: { icon: string; title: string; desc: string; extra?: string }) {
  return (
    <div className="bg-mid-bg rounded-xl p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-mid-fg">{title}</p>
          <p className="text-xs text-mid-fg/90 mt-1">{desc}</p>
          {extra && <p className="text-xs text-mid-fg/70 mt-1">{extra}</p>}
        </div>
      </div>
    </div>
  );
}
```

기준값 카드(71~96줄)의 래퍼 `bg-[#faf9f7] border border-[#e8e6df] rounded-xl p-5` → `bg-surface shadow-card rounded-xl p-5`.
내부 텍스트 색을 매핑대로. 감정가 대비 비율 색상(88~93줄):

```tsx
            <p
              className={`text-base font-bold mt-0.5 tabular-nums ${
                item.ratio_pct < 60 ? "text-hot-fg" : item.ratio_pct < 70 ? "text-mid-fg" : "text-ok-fg"
              }`}
            >
```

메모 카드(99~118줄) 래퍼도 `bg-surface shadow-card rounded-xl`.
저장 성공 표시 `text-green-600` → `text-ok-fg`.
저장 버튼 `bg-[#185fa5] text-white hover:bg-[#14508f]` → `bg-primary text-primary-fg hover:bg-primary-hover`.

시세 비교 섹션(`MarketSection`, 146~202줄):
- 외곽 `border border-[#185fa5]/20` → `shadow-card`로 바꾸고 `border-[#185fa5]/20` 제거
- `bg-white border border-[#185fa5]/20 rounded-xl p-5` → `bg-surface shadow-card rounded-xl p-5`
- tier 라벨 pill(149~151줄) `bg-[#f5f4f0]` → `bg-surface-muted`
- 시세 대비 할인율 색상(180~185줄):

```tsx
                <p className={`text-base font-bold mt-0.5 tabular-nums ${
                  comparison.discount_from_market_pct > 30
                    ? "text-hot-fg"
                    : comparison.discount_from_market_pct > 15
                    ? "text-mid-fg"
                    : "text-ok-fg"
                }`}>
```

실거래 내역 테이블(207~243줄) 래퍼 → `bg-surface shadow-card rounded-xl p-5`.
`border-[#f0efe9]` → `border-border`.

- [ ] **Step 7.7: TabTenant 색상 치환**

안내 박스(85~93줄):

```tsx
    return (
      <div className="bg-mid-bg rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-mid-fg mb-1">임차인 정보 미제공</p>
        <p className="text-xs text-mid-fg/80">
          신탁재산 / 기타일반재산은 온비드 API에서 임차인 정보를 제공하지 않습니다.
        </p>
        <p className="text-xs text-mid-fg/70 mt-1">현재 자산 구분: {prptDivNm}</p>
      </div>
    );
```

로딩(97줄): `text-sm text-text-4 animate-pulse py-8 text-center`
에러(100줄): `text-sm text-hot-fg py-8 text-center`
Section 제목(116줄): `text-text-1`

- [ ] **Step 7.8: TabHistory 색상 치환**

테이블 래퍼(40줄) `border border-[#e8e6df]` → `bg-surface shadow-card`로 감쌈.
헤더(43~49줄) `bg-[#faf9f7] border-b border-[#e8e6df]` → `bg-surface-muted border-b border-border`, `text-[#5f5e5a]` → `text-text-3`.
바디 tr `border-b border-[#e8e6df] hover:bg-gray-50` → `border-b border-border hover:bg-surface-muted`.
`text-[#1a1a18]` → `text-text-1`, `text-[#5f5e5a]` → `text-text-3`, `text-[#185fa5]` → `text-primary`, `text-[#9c9a92]` → `text-text-4`.
결과 pill `text-amber-700 bg-amber-50 border border-amber-200` → `bg-mid-bg text-mid-fg`.
요약 카드(93줄) `bg-[#faf9f7] border border-[#e8e6df] rounded-xl` → `bg-surface shadow-card rounded-xl`.
카드 내부 구분선(113줄) `border-t border-[#e8e6df]` → `border-t border-border`.
하락률(115줄) `text-red-600` → `text-hot-fg`.

모바일 대응 한 줄 추가: 37줄 `<div className="flex gap-6">` → `<div className="flex flex-col md:flex-row gap-4 md:gap-6">`. 92줄 사이드 카드 `<div className="w-56 shrink-0 flex flex-col gap-3">` → `<div className="md:w-56 shrink-0 flex flex-col gap-3">` (모바일에서 풀폭).

- [ ] **Step 7.9: 타입체크/린트**

```bash
cd frontend && npm run lint
```

- [ ] **Step 7.10: 브라우저 검증**

상세 페이지 6개 탭 모두:
- 색상이 일관된 토큰 체계로
- 카드 래퍼에 shadow-card
- 빨강/호박/초록 상태가 hot/mid/ok 토큰으로 통일
- 데스크톱·모바일 각각 레이아웃 깨짐 없음
- 탭 전환 시 콘솔 에러 0

특히 확인할 항목:
- 기본정보 탭: 카카오맵 정상 (KAKAO 키가 있으면 지도 렌더)
- 유찰내역 탭: 요약 카드가 모바일에서 테이블 아래로 감
- 체크리스트 탭: 진행바가 primary 색, 체크/해제, 추가/삭제 동작
- 수익성 탭: 시세 비교 카드, 실거래 테이블, 메모 저장 동작
- 임차인 탭: prptDivNm에 따라 안내 박스 또는 데이터 테이블
- 리스크 탭: 요약 카드 색상이 warnCount에 따라 hot/mid/ok

- [ ] **Step 7.11: 커밋**

```bash
git add frontend/src/components/LabeledTable.tsx frontend/src/components/StatsBar.tsx frontend/src/components/detail/
git commit -m "$(cat <<'EOF'
feat(frontend): restyle detail tabs + shared tables to tokens

LabeledTable, StatsBar 그리고 6개 상세 탭의 하드코딩 hex를 토큰으로
일괄 교체. 카드 래퍼는 shadow-card, 상태 색상은 hot/mid/ok 시맨틱으로
통일. TabHistory는 모바일에서 세로 스택으로 전환.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Analytics 페이지 + 컴포넌트 리스킨 (batch)

**Files:**
- Modify: `frontend/src/app/analytics/page.tsx`
- Modify: `frontend/src/components/analytics/AnalyticsFilters.tsx`
- Modify: `frontend/src/components/analytics/MarketOverview.tsx`
- Modify: `frontend/src/components/analytics/TrendCharts.tsx`
- Modify: `frontend/src/components/analytics/Leaderboard.tsx`

분석 페이지는 자체 `<aside>`를 가지고 있어서 Task 2의 AppShell과 중복된다. 여기서 정리한다.

- [ ] **Step 8.1: `app/analytics/page.tsx` 레이아웃 정리**

현재 `return` 블록(53~98줄)을 아래로 교체:

```tsx
  return (
    <PageWithSidebar sidebar={<AnalyticsFilters filter={filter} onChange={setFilter} />}>
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-text-1 tracking-tight">분석 대시보드</h1>
        <p className="text-sm text-text-3 mt-1">시장 현황, 트렌드, 투자 스코어</p>
      </div>

      {summary.error && (
        <div className="text-hot-fg text-sm mt-4">
          데이터를 불러오지 못했습니다: {summary.error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {filteredSummary && <MarketOverview data={filteredSummary} />}

        <TrendCharts
          data={trends.data}
          period={trends.period}
          loading={trends.loading}
          onPeriodChange={handlePeriodChange}
        />

        <Leaderboard
          data={scores.data}
          loading={scores.loading}
          weights={scores.weights}
          onWeightsChange={(w) => scores.load(w)}
        />
      </div>
    </PageWithSidebar>
  );
}
```

import 추가:

```tsx
import PageWithSidebar from "@/components/layout/PageWithSidebar";
```

import 제거 (더 이상 안 쓰임):

```tsx
import Link from "next/link";
```

(분석 페이지 자체의 "← 물건 목록" 링크가 TopNav의 "Overview"로 대체되었으므로 Link import 삭제 가능; 다만 다른 곳에서 안 쓰이는지 확인 — lint가 알려줌.)

`AnalyticsFilters`의 `<Link href="/">물건 목록</Link>` 노드는 이제 TopNav 중복이지만, 사이드바 상단 링크를 보존하고 싶으면 `AnalyticsFilters` 내부에 둬야 함 — 여기선 TopNav로 충분하므로 그대로 두되 `AnalyticsFilters`에는 링크 없음(현재 구조 유지).

- [ ] **Step 8.2: AnalyticsFilters 색상 치환**

현재 파일 전체(103줄)를 아래로 교체:

```tsx
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
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="hidden md:block text-sm font-semibold text-text-1">필터</h3>
        {hasFilter && (
          <button
            onClick={clearAll}
            className="text-xs text-text-4 hover:text-text-2 ml-auto"
          >
            초기화
          </button>
        )}
      </div>

      <div>
        <p className="text-xs text-text-3 mb-2">지역</p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter.regions.includes(r)
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-muted text-text-2 hover:bg-border"
              }`}
            >
              {r.replace(/특별시|광역시|특별자치시|도$/, "")}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-text-3 mb-2">용도</p>
        <div className="flex flex-wrap gap-1.5">
          {USAGE_TYPES.map((u) => (
            <button
              key={u}
              onClick={() => toggleUsage(u)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                filter.usageTypes.includes(u)
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-muted text-text-2 hover:bg-border"
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
```

- [ ] **Step 8.3: MarketOverview 색상 치환**

`COLORS` 팔레트(17~28줄)를 토큰 기반으로 교체:

```tsx
const COLORS = [
  "var(--color-primary)",
  "var(--color-primary-hover)",
  "var(--color-ok-fg)",
  "var(--color-mid-fg)",
  "var(--color-hot-fg)",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#0891b2",
  "#a855f7",
];
```

카드 래퍼(41/65/80줄) `bg-white border border-[#d3d1c7]` → `bg-surface shadow-card`.
`Bar fill="#185fa5"` (59줄) → `fill="var(--color-primary)"`.
`Bar fill="#2e86de"` (74줄) → `fill="var(--color-primary-hover)"`.

- [ ] **Step 8.4: TrendCharts 색상 치환**

기간 버튼(40~52줄):

```tsx
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p.value
                  ? "bg-primary text-primary-fg"
                  : "bg-surface-muted text-text-2 hover:bg-border"
              }`}
            >
```

로딩/빈 상태(56~63줄) `text-gray-400` → `text-text-4`.
카드 래퍼(68/95줄) `bg-white border border-[#d3d1c7]` → `bg-surface shadow-card`.
라인 stroke(87줄) `stroke="#185fa5"` → `stroke="var(--color-primary)"`.
라인 stroke(117줄) `stroke="#e55039"` → `stroke="var(--color-hot-fg)"`.
`<CartesianGrid strokeDasharray="3 3">` (72/99줄) → `<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-strong)" />`.

- [ ] **Step 8.5: Leaderboard 색상 치환**

`ScoreBar` (14~41줄): bg 클래스 교체
- `bg-blue-500` → `bg-primary`
- `bg-orange-400` → `bg-mid-fg`
- `bg-green-500` → `bg-ok-fg`

가중치 슬라이더 섹션(85~130줄):
- `bg-gray-50 border border-[#d3d1c7]` → `bg-surface shadow-card`
- 색상 점의 `color` 변수 (91/96/101줄):

```tsx
          {[
            {
              key: "ratio" as const,
              label: "감정가율",
              color: "bg-primary",
            },
            {
              key: "fail" as const,
              label: "유찰 횟수",
              color: "bg-mid-fg",
            },
            {
              key: "location" as const,
              label: "입지 프리미엄",
              color: "bg-ok-fg",
            },
          ].map(...)
```

- 적용 버튼(123~128줄) `bg-[#185fa5] ... hover:bg-[#134d88]` → `bg-primary ... hover:bg-primary-hover`.
- 커스텀 가중치 토글 `text-[#185fa5]` (79줄) → `text-primary`.

테이블 섹션(132~200줄):
- `bg-white border border-[#d3d1c7]` → `bg-surface shadow-card`
- `bg-gray-50 border-b border-[#d3d1c7]` → `bg-surface-muted border-b border-border`
- `border-b border-gray-100 hover:bg-blue-50` → `border-b border-border hover:bg-primary-subtle`
- `text-gray-400` → `text-text-4`
- `text-[#185fa5]` → `text-primary`
- `text-gray-600` → `text-text-2`

범례(187~200줄):
- `bg-blue-500` → `bg-primary`
- `bg-orange-400` → `bg-mid-fg`
- `bg-green-500` → `bg-ok-fg`
- `text-gray-500` → `text-text-3`

- [ ] **Step 8.6: 타입체크/린트**

```bash
cd frontend && npm run lint
```

- [ ] **Step 8.7: 브라우저 검증**

`/analytics` 데스크톱:
- TopNav 아래 좌측 `w-60` 사이드바에 AnalyticsFilters
- 사이드바 상단 "필터" 제목
- 지역/용도 칩 토글이 primary 색상
- 시장 현황: 3개 차트 카드, 각각 shadow-card
- 트렌드: 기간 버튼 3개, 2개 라인 차트
- 스코어보드: 테이블 hover 시 primary-subtle 배경, 점수 바 primary/mid/ok 색

`/analytics` 모바일:
- 햄버거 → 드로어로 필터
- 차트는 단일 컬럼으로 스택 (recharts의 ResponsiveContainer가 자동 처리)
- 스코어 테이블은 가로 스크롤

- [ ] **Step 8.8: 커밋**

```bash
git add frontend/src/app/analytics/page.tsx frontend/src/components/analytics/
git commit -m "$(cat <<'EOF'
feat(frontend): restyle analytics page + recharts to token palette

analytics 페이지를 PageWithSidebar로 통합(중복 aside 제거), 4개
분석 컴포넌트를 토큰 기반으로 교체. recharts의 색상은 var(--color-*)
문자열로 주입해 CSS 토큰과 연동.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Cleanup — hex 잔여 제거 + 최종 회귀

**Files:**
- Modify: 위 태스크에서 놓친 잔여 hex가 있는 임의 파일

- [ ] **Step 9.1: hex 코드 grep 검사**

```bash
cd frontend/src
grep -rn --include='*.tsx' --include='*.ts' -E '#[0-9a-fA-F]{6}' . | grep -v -E '(node_modules|// |/\*|\.md|var\(--)'
```

기대: 아래 예외만 남음
- `KAKAO_KEY` 관련 브랜드 색 `#FEE500` / `#3C1E1E` (카카오 공식 로고 색, 유지)
- `globals.css`의 hex (토큰 정의 그 자체)
- TabInfo의 지도 InfoWindow 인라인 CSS `#185fa5` — **이것은 교체**:

`TabInfo.tsx` 81줄의 인라인 CSS:

```tsx
            content: `<div style="
              background:var(--color-primary);color:#fff;font-size:11px;font-weight:700;
```

(`#fff`는 인디고 위 흰 텍스트로 유지 — HTML 인라인 스타일이라 Tailwind 토큰 클래스가 아닌 CSS 변수로 참조.)

추가로 발견되는 hex는 모두 위 매핑 표에 따라 토큰으로 교체한다. 각 수정 후 파일별로 개별 커밋은 하지 않고 아래 Step 9.3에서 일괄 커밋.

- [ ] **Step 9.2: Tailwind 임의 색상 클래스 잔여 검사**

```bash
cd frontend/src
grep -rn --include='*.tsx' --include='*.ts' -E '\b(bg|text|border|ring|accent|fill|stroke|divide)-\[#' .
```

기대: 0건. 남아 있으면 매핑에 따라 교체.

- [ ] **Step 9.3: 잔여 색상 클래스 검사 (gray/red/amber/green)**

```bash
cd frontend/src
grep -rn --include='*.tsx' -E '\b(bg|text|border)-(red|amber|green|blue|gray|orange|indigo)-[0-9]+' . | grep -v 'node_modules'
```

기대: 0건. 이 Phase 1에서는 모든 색상이 시맨틱 토큰을 거쳐야 한다. 남아 있는 건 해당 파일을 열어 매핑대로 교체.

- [ ] **Step 9.4: lint + build 검증**

```bash
cd frontend
npm run lint
npm run build
```

기대: 둘 다 에러 없이 통과. 경고는 기존 대비 **증가하지 않아야** 한다 (사전 체크 Pre-step B에서 기준을 확인한 상태).

- [ ] **Step 9.5: 전체 브라우저 회귀 시나리오**

각 항목을 데스크톱(1280px)과 모바일(375×667) 둘 다에서 수행.

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 홈 로드 → 감정가 대비 50~70% 필터 → 검색 | 결과 테이블 업데이트 |
| 2 | 정렬 "비율 ↑" → "마감일" | 페이지 1 리셋, 활성 버튼 전환 |
| 3 | 테이블/카드 행 클릭 | `/items/{cltr_mng_no}` 이동 |
| 4 | 상세 페이지 탭 6개 순회 | 각 탭 콘텐츠 렌더, 콘솔 에러 0 |
| 5 | 모바일 드로어 열기 → 필터 변경 → 검색 → 오버레이 클릭으로 닫기 | 결과 반영 + 드로어 닫힘 |
| 6 | 북마크 체크 → 다른 페이지 이동 → 복귀 | 체크 상태 유지 |
| 7 | `/analytics` 로드 | 3개 섹션(시장/트렌드/스코어) 모두 렌더 |
| 8 | 분석 → 스코어보드 가중치 슬라이더 조정 → 적용 | 스코어 재계산 |
| 9 | 분석 → 트렌드 기간 7/30/90일 전환 | 각 기간 라인 차트 업데이트 |
| 10 | 상세 → 수익성 탭 → 메모 저장 → 다시 로드 | 메모 유지 |
| 11 | 상세 → 체크리스트 탭 → 항목 체크/추가/삭제 → 재진입 | 상태 유지 |
| 12 | TopNav Overview/Analytics 클릭 | 활성 탭 전환 |
| 13 | ESC 키로 드로어 닫기 | 닫힘 |

하나라도 실패하면 해당 컴포넌트로 돌아가 수정 후 재검증.

- [ ] **Step 9.6: Acceptance Criteria 최종 체크**

스펙의 Phase 1 Acceptance Criteria 완주 확인:

- [ ] 홈/분석/상세 세 페이지 모두 인디고 액센트 + 오프화이트 배경 + 카드 그림자
- [ ] 모바일에서 가로 스크롤 없음
- [ ] 홈: 데스크톱 사이드바 / 모바일 드로어 동작
- [ ] 홈 테이블: 데스크톱 테이블 / 모바일 카드 리스트 전환
- [ ] 기존 기능 회귀 0건 (Step 9.5 완료)
- [ ] `frontend/src` 내 `\b(bg|text|border|ring|accent|fill|stroke|divide)-\[#` 정규식 매칭 0건 (Step 9.2 완료)
- [ ] `npm run lint` pass (Step 9.4 완료)

- [ ] **Step 9.7: 커밋**

Task 9에서 수정된 잔여가 있으면:

```bash
git add -A
git status  # 예상: 수정된 파일 목록 확인
git commit -m "$(cat <<'EOF'
chore(frontend): clean up residual hex codes, pass lint/build

Phase 1 리스킨 마무리. globals.css 외의 하드코딩 hex 모두 제거,
lint/build 통과 확인.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

잔여가 없으면 커밋 스킵.

- [ ] **Step 9.8: 브랜치 정리 및 병합 준비**

```bash
git log --oneline main..feat/phase1-restyle
```

기대: 1 (토큰) / 2 (셸) / 3 (SummaryStrip) / 4 (ItemTable) / 5 (FilterPanel) / 6 (Hero+Detail) / 7 (탭 batch) / 8 (Analytics batch) / 9 (cleanup, 있을 때만) = 8~9 커밋.

`git diff main..feat/phase1-restyle --stat`으로 변경량 개괄 확인 후, PR 생성 혹은 `dev` 브랜치로 병합.

---

## Self-Review 결과

**Spec coverage** — 스펙 섹션별 커버리지:
- Design Decisions 6개 → Task 1(토큰), Task 2(셸+드로어+브레이크포인트)에 모두 반영
- File Structure 전체 파일 목록 → Task 2~8이 하나씩 담당
- Design Tokens Colors/Typography → Task 1 globals.css에 그대로
- Layout Shell (TopNav/AppShell/PageWithSidebar/FilterDrawer/Home/Detail/Analytics) → Task 2, 6, 8
- Migration Order Step 1~9 → Task 1~9와 1:1 매칭
- Testing & Acceptance Criteria → Task 9에서 전체 회귀 및 최종 체크
- Next.js 16 주의 → Pre-step A에 반영

**Placeholder scan** — "TBD/TODO/추후" 등 0건. 모든 Step은 정확한 코드 블록 또는 정확한 치환 지시(매핑 표 + 특정 라인 언급)를 포함.

**Type consistency** — `RatioPill`, `DeadlineLabel`, `NavLink`는 모두 소유 컴포넌트(각각 `ItemTable.tsx`, `TopNav.tsx`) 내부 지역 컴포넌트로 일관되게 정의. Props 타입(`{ratio: number}`, `{dt: string, pvct: boolean}`, `{href, children}`)이 사용처와 일치.

**한 가지 발견된 불일치, 인라인 수정됨**:
- 스펙에서는 `ratioLabel`(필터 라벨)이 5단계, `RatioPill`(테이블 pill)이 3단계라 표현이 다른 스케일을 씀. Task 4에서는 `RatioPill` 3단계(hot/mid/ok)로, Task 5 `ratioLabel`에서는 5단계 레이블을 유지하되 색은 3단계 토큰(hot/mid/text-4)에 매핑해서 시각적 일관성은 유지. 의도된 분리(필터 vs 테이블)이므로 플랜 Task 5에 이를 반영.

---

## 실행 옵션

Plan complete and saved to `docs/superpowers/plans/2026-04-13-frontend-phase1-restyle.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per Task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints
