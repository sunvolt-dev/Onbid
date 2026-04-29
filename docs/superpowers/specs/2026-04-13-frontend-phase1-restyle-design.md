# Phase 1: Frontend Restyle + Responsive Shell — Design Spec

**Date:** 2026-04-13
**Phase:** 1 of 5 (UX 개선 로드맵)
**Scope:** 순수 프레젠테이션 레이어 리스킨 + 반응형 셸. 데이터/API/훅 불변.

## Context

온비드 공매 대시보드 프론트엔드가 "안 예뻐" 보인다는 피드백과, 모바일/태블릿에서 쓰기 힘들다는 문제를 해결한다. 전체 UX 개선은 5개 Phase로 분할:

- **Phase 1 (본 문서)**: 스타일 리스킨 + 반응형 셸
- Phase 2: 홈 우선순위 시그널링
- Phase 3: 상세 페이지 탭 재구성
- Phase 4: 비교 기능 신규
- Phase 5: 분석 페이지 재설계

각 Phase는 독립 spec → plan → 구현 사이클을 돌린다.

## Design Decisions (확정)

| 항목 | 결정 |
|---|---|

| 시각 방향 | Modern SaaS Light (화이트 배경, 여백, 칩/그림자, Linear/Notion 느낌) |
| 액센트 컬러 | Indigo `#6366f1` (브랜드 블루 `#185fa5`에서 변경) |
| 모바일 필터 UX | 햄버거 트리거 → 좌측 Drawer 슬라이드 |
| 구현 접근 | Incremental: 토큰 → 셸 → 컴포넌트 순, 각 Step 커밋 |
| 브레이크포인트 | `md: 768px` 단일 경계 (태블릿 세로는 모바일 취급) |
| 폰트 | 시스템 폰트 유지 (웹폰트 추가 안 함) |

## Architecture

**레이어드 리스킨**: 데이터 흐름(API/훅/타입)은 불변, 순수 프레젠테이션만 교체.

### File Structure

```
frontend/src/
├── app/
│   ├── globals.css             [수정] @theme 토큰 재정의 + 전역 스타일
│   ├── layout.tsx              [수정] nav 제거 → <AppShell>{children}</AppShell>
│   ├── page.tsx                [수정] <PageWithSidebar>로 래핑
│   ├── analytics/page.tsx      [수정] 컴포넌트 리스킨 반영
│   └── items/[id]/page.tsx     [수정] 컴포넌트 리스킨 반영
├── components/
│   ├── layout/                 [신규] 셸 레이어
│   │   ├── AppShell.tsx        [신규] TopNav 포함 루트 컨테이너
│   │   ├── TopNav.tsx          [신규] sticky 네브
│   │   ├── PageWithSidebar.tsx [신규] 사이드바/드로어 포함 페이지 래퍼
│   │   └── FilterDrawer.tsx    [신규] 모바일 드로어
│   ├── FilterPanel.tsx         [수정] 사이드바/드로어 양쪽에서 재사용
│   ├── SummaryStrip.tsx        [수정]
│   ├── ItemTable.tsx           [수정] 테이블 + 모바일 카드 리스트
│   ├── LabeledTable.tsx        [수정] 토큰 적용
│   ├── StatsBar.tsx            [수정] 토큰 적용
│   ├── detail/
│   │   ├── HeroSection.tsx     [수정]
│   │   ├── TabChecklist.tsx    [수정]
│   │   ├── TabHistory.tsx      [수정]
│   │   ├── TabInfo.tsx         [수정]
│   │   ├── TabProfit.tsx       [수정]
│   │   ├── TabRisk.tsx         [수정]
│   │   └── TabTenant.tsx       [수정]
│   └── analytics/
│       ├── AnalyticsFilters.tsx [수정]
│       ├── Leaderboard.tsx      [수정]
│       ├── MarketOverview.tsx   [수정]
│       └── TrendCharts.tsx      [수정]
├── hooks/                      [변경 없음]
├── api/                        [변경 없음]
├── types/                      [변경 없음]
└── utils/                      [변경 없음]
```

### Component Responsibilities

- **`globals.css`** — Tailwind 4 `@theme`에 전체 디자인 토큰 정의. 다른 어떤 파일도 하드코딩 색상/크기를 가지지 않는다.
- **`AppShell`** — 루트 레이아웃에서 한 번만 래핑. TopNav 렌더 + `<main>` 컨테이너.
- **`TopNav`** — sticky top, 로고·탭 네비게이션. 현재 경로 감지해 활성 탭 표시.
- **`PageWithSidebar`** — 사이드바가 필요한 페이지(홈)가 콘텐츠를 래핑. 드로어 open 상태를 **지역적으로** 소유 (전역 컨텍스트 사용 안 함).
- **`FilterDrawer`** — 모바일에서만 렌더. 오버레이 + CSS 트랜지션 슬라이드. 자식으로 `FilterPanel` 주입받음.
- **`FilterPanel`** — 현재처럼 필터 UI만 담당. 사이드바인지 드로어인지 모른다 (주입된 자식일 뿐).

### Core Principles

1. 데이터/타입/훅 불변 — 이번 Phase는 오직 스타일/레이아웃
2. 모든 색상·크기·그림자는 토큰 경유 (`bg-surface`, `text-primary`). 하드코딩 HEX 금지
3. 기존 기능 회귀 0건 — 정렬, 페이지네이션, 북마크, 필터 동작 모두 유지

## Design Tokens

### Colors

```css
@theme {
  /* Surfaces */
  --color-bg: #fafbfc;            /* 페이지 배경 */
  --color-surface: #ffffff;       /* 카드/테이블 배경 */
  --color-surface-muted: #f8fafc; /* 테이블 헤더, 호버 */

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
  --color-hot-bg: #fee2e2;  --color-hot-fg: #b91c1c;  /* < 60% */
  --color-mid-bg: #fef3c7;  --color-mid-fg: #b45309;  /* 60–70% */
  --color-ok-bg: #dcfce7;   --color-ok-fg: #166534;   /* ≥ 70% */

  /* Semantic — urgency */
  --color-urgent: #ef4444;   /* D-3 이내 마감 */
  --color-new: #6366f1;      /* NEW 뱃지 */

  /* Shadows */
  --shadow-card: 0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04);
  --shadow-card-hover: 0 4px 8px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.06);
  --shadow-drawer: 2px 0 16px rgba(15, 23, 42, 0.12);

  /* Radius */
  --radius-sm: 4px;      /* pill, chip */
  --radius-md: 6px;      /* input, button */
  --radius-lg: 8px;      /* card */
  --radius-xl: 12px;     /* large card, modal */
  --radius-full: 9999px;
}
```

### Typography Scale

| 토큰 | 크기 | 용도 |
|---|---|---|
| `text-xs` | 11px | 메타, 라벨, 배지 |
| `text-sm` | 13px | 테이블 셀, 본문 |
| `text-base` | 14px | 서브타이틀 |
| `text-lg` | 16px | 카드 제목 |
| `text-xl` | 20px | 페이지 서브헤더 |
| `text-2xl` | 24px | KPI 값, 페이지 타이틀 |
| `text-3xl` | 30px | 랜딩/1순위 강조 |

- Tracking: title/kpi에 `letter-spacing: -0.02em`
- 숫자: `font-variant-numeric: tabular-nums`

### 주요 변경점 (현재 대비)

- 페이지 배경 크림 `#f3f2ee` → 오프화이트 `#fafbfc`
- 본문 12px → 13px (밀도 완화)
- 감정가 대비 표기: 평문 `48.0%` → 색상 pill
- 카드: `border` → `shadow-card`

## Layout Shell

### TopNav

```tsx
// components/layout/TopNav.tsx
<nav className="sticky top-0 z-30 bg-surface border-b border-border h-12 px-4 md:px-6 flex items-center gap-6">
  <Link href="/" className="text-sm font-bold text-primary tracking-tight">Onbid</Link>
  <div className="flex items-center gap-4 text-sm">
    <NavLink href="/">Overview</NavLink>
    <NavLink href="/analytics">Analytics</NavLink>
  </div>
</nav>
```
- 높이 48px, sticky, `z-30` (드로어 `z-50`보다 낮음)
- `NavLink`는 `TopNav.tsx` 내부 지역 컴포넌트. `usePathname()`으로 활성 경로 감지, 활성 시 `text-primary font-semibold`, 비활성 `text-text-3 hover:text-text-1`

### AppShell

```tsx
// components/layout/AppShell.tsx
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
```

루트 레이아웃에서 한 번만 사용.

### PageWithSidebar

```tsx
// components/layout/PageWithSidebar.tsx
interface Props { sidebar: React.ReactNode; children: React.ReactNode }

export default function PageWithSidebar({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-border bg-surface min-h-[calc(100vh-48px)]">
        {sidebar}
      </aside>
      {/* Mobile drawer */}
      <FilterDrawer open={open} onClose={() => setOpen(false)}>
        {sidebar}
      </FilterDrawer>
      {/* Main */}
      <main className="flex-1 min-w-0 p-4 md:p-6">
        <button
          onClick={() => setOpen(true)}
          className="md:hidden mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-surface shadow-card rounded-md"
          aria-label="필터 열기"
        >
          ☰ 필터
        </button>
        {children}
      </main>
    </div>
  );
}
```

### FilterDrawer

```tsx
// components/layout/FilterDrawer.tsx
interface Props { open: boolean; onClose: () => void; children: React.ReactNode }

export default function FilterDrawer({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`md:hidden fixed inset-0 z-40 bg-text-1/50 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-surface shadow-drawer p-4 transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">필터</h2>
          <button onClick={onClose} className="text-text-3" aria-label="닫기">✕</button>
        </div>
        {children}
      </aside>
    </>
  );
}
```

- ESC 키로 닫기 (open 상태일 때만 리스너 등록)
- 오버레이 클릭으로 닫기
- CSS 트랜지션만 사용 (애니메이션 라이브러리 없음)

### Home Page Integration

현재 `app/page.tsx`의 `<div className="flex min-h-screen">` + 좌측 `<FilterPanel>` + 우측 `<main>` 구조를 아래처럼 교체한다. 내부 콘텐츠(헤더, SummaryStrip, error box, loading spinner, ItemTable)는 인라인 JSX로 유지하고 스타일만 토큰 경유로 교체한다.

```tsx
// app/page.tsx (상위 구조만, 내부 자식은 기존 JSX 유지)
return (
  <PageWithSidebar sidebar={<FilterPanel filter={filter} onSearch={handleSearch} />}>
    {/* 기존 헤더 div (h1 + p) — 클래스만 토큰 교체 */}
    {/* SummaryStrip */}
    {/* error 표시 / loading 스피너 / ItemTable */}
  </PageWithSidebar>
);
```

별도 `Header`/`ErrorBox`/`LoadingSpinner` 컴포넌트는 만들지 않는다 (YAGNI — 한 곳에서만 쓰임).

### Analytics & Detail Pages

사이드바 없음. `PageWithSidebar` 사용하지 않고 단순히 `<main className="p-4 md:p-6 max-w-7xl mx-auto">` 래핑만.

## Component Migration Order

### Step 1 — Tokens (foundation)

- `globals.css`의 `@theme` 블록을 위 "Design Tokens" 값으로 교체
- 제거할 기존 토큰: `--color-red-brand`, `--color-warn`, `--color-green-brand`, `--color-border2`, `--color-text1`, `--color-text2`, `--color-text3`, `--color-text4`, `--color-text5`
- **이름 변경 주의**: `--color-text1` → `--color-text-1` (하이픈). Tailwind 4의 `@theme` → 유틸리티 클래스 매핑상 `text-text-1`이 자연스럽다. 기존 컴포넌트들이 쓰는 `text-[#1a1a18]` 같은 하드코딩은 Step 3~8에서 `text-text-1`로 교체되므로 Step 1 시점엔 토큰만 선언
- 이 시점엔 컴포넌트가 아직 하드코딩 hex 상태이므로 시각적 큰 변화 없음
- **검증**: 앱이 에러 없이 뜬다, Tailwind 빌드 경고 없음

### Step 2 — Layout Shell

- `components/layout/` 하위 4개 파일 신규 작성
- `app/layout.tsx`에서 기존 `<nav>` 제거, `<AppShell>{children}</AppShell>`로 교체
- `app/page.tsx` 최상위 `<div className="flex min-h-screen">` + 좌측 aside를 `<PageWithSidebar sidebar={...}>`로 교체
- **검증**: 데스크톱(1280px)에서 사이드바 유지, 모바일(375px)에서 햄버거 → 드로어 오픈·닫힘(오버레이 클릭/ESC) 동작

### Step 3 — SummaryStrip

- 카드: `border border-[#d3d1c7]` → `shadow-card`
- 색: `text-[#185fa5]` → `text-primary`, `text-gray-500` → `text-text-3`
- 숫자: `text-2xl font-bold tracking-tight tabular-nums`
- 스켈레톤: `bg-border-strong animate-pulse`
- **검증**: KPI 4개 값이 정상 표시되고 클릭(투자 1순위) 링크 동작

### Step 4 — ItemTable

가장 시각 변화가 큰 단계.

데스크톱(md 이상, 기존 테이블):
- 컨테이너: `border` → `shadow-card rounded-xl overflow-hidden`
- 헤더: `bg-surface-muted text-text-3 text-xs font-semibold`
- 행 hover: `hover:bg-surface-muted`
- **감정가 대비 pill 전환**: 현재 평문 `48.0%` + 진행바 → `RatioPill` 컴포넌트 (`bg-hot-bg text-hot-fg rounded-full px-2.5 py-0.5 text-sm font-semibold`). 진행바 제거
- 점(dot) 유지
- NEW 배지: `bg-new text-white rounded-sm px-1.5 py-0.5 text-[10px] font-bold`
- 만료 행: `opacity-50`
- 수의계약 왼쪽 바: `border-l-mid-fg`

모바일(md 미만, 카드 리스트 신규):
```tsx
<div className="md:hidden flex flex-col gap-2">
  {pageItems.map(item => (
    <Link href={`/items/${item.cltr_mng_no}`} key={item.cltr_mng_no}
          className="bg-surface shadow-card rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-text-1 truncate">{item.onbid_cltr_nm}</div>
        <RatioPill ratio={item.ratio_pct} />
      </div>
      <div className="text-xs text-text-3">{item.lctn_sd_nm} {item.lctn_sggn_nm}</div>
      <div className="flex items-center justify-between text-xs mt-1">
        <span className="font-semibold text-primary">{fmtAmt(item.lowst_bid_prc)}</span>
        <DeadlineLabel dt={item.cltr_bid_end_dt} />
      </div>
    </Link>
  ))}
</div>
```

`RatioPill`과 `DeadlineLabel`은 `ItemTable.tsx` 내부 지역 컴포넌트로 추출 (테이블/카드 공유).

- **검증**: 정렬 3종, 페이지네이션, 행/카드 클릭, NEW 뱃지, 만료·수의계약 처리, 375px 뷰포트에서 가로 스크롤 0

### Step 5 — FilterPanel

- 인풋: `border-[#d3d1c7] bg-white` → `border-border-strong bg-surface`
- 라벨: `text-[#3d3d3a]` → `text-text-2`
- 수의계약 3-way 토글: `bg-primary text-primary-fg` / `bg-surface border-border-strong`
- 버튼: `bg-primary hover:bg-primary-hover` / `bg-surface border-border-strong hover:bg-surface-muted`
- 좁은 너비(드로어 288px) 대응: 숫자 인풋 `flex-wrap`으로 1단 polish
- **검증**: 데스크톱 사이드바/모바일 드로어 양쪽에서 모든 필터 필드 동작

### Step 6 — Detail: HeroSection

- 타이틀: `text-2xl font-bold tracking-tight`
- 메타 라벨: `uppercase tracking-wider text-text-3 text-xs`
- 썸네일(존재 시): `rounded-lg shadow-card`
- **검증**: `/items/[id]` 페이지 로드, 히어로 영역 정상 표시

### Step 7 — Detail: Tabs (batch)

- 탭 바: `border-b border-border`, 활성 탭 `border-b-2 border-primary text-primary font-semibold`
- 각 탭 내부 테이블·리스트(`LabeledTable`, `StatsBar` 포함) — 토큰 교체만
- **정보 구조/필드 순서는 건드리지 않는다** (Phase 3 예정)
- **검증**: 6개 탭 순회, 각 콘텐츠 렌더

### Step 8 — Analytics (batch)

- `AnalyticsFilters`, `Leaderboard`, `MarketOverview`, `TrendCharts` — 토큰 적용
- recharts 색상 팔레트: `stroke="var(--color-border)"`, 시리즈 색은 primary + hot/mid/ok 조합
- **차트 종류/정보 구조는 건드리지 않는다** (Phase 5 예정)
- **검증**: `/analytics` 로드, 차트 정상 렌더

### Step 9 — Cleanup

- `frontend/src` 내 `#[0-9a-f]{3,6}` 정규식 그렙 → 매칭 0건 확인 (모두 토큰 경유)
- 미사용 컴포넌트/import 제거
- `lint` 통과 확인

## Testing & Acceptance

### 전략

순수 프레젠테이션 리스킨이라 유닛 테스트는 노이즈가 커서 작성하지 않는다. 대신 **체크리스트 수동 검증 + grep 정적 검증**. 자동 스크린샷 회귀(Playwright 등)는 Phase 2에서 필요 시 도입.

### 각 Step 완료 체크리스트

1. **데스크톱 1280×800 Chrome**
   - 콘솔 에러 없음
   - 해당 Step이 건드린 화면의 정렬/필터/북마크/탭 전환/링크 클릭 동작
2. **모바일 375×667 (Chrome DevTools 디바이스 모드)**
   - 가로 스크롤 없음
   - 드로어: 햄버거 열림, 오버레이 클릭 닫힘, ESC 닫힘
3. `npm run lint` 통과

### Phase 1 전체 Acceptance Criteria

- [ ] 홈/분석/상세 세 페이지 모두 인디고 액센트 + 오프화이트 배경 + 카드 그림자 스타일 반영
- [ ] 모바일(< 768px)에서 세 페이지 모두 가로 스크롤 없이 사용 가능
- [ ] 홈: 필터가 데스크톱 사이드바 / 모바일 드로어로 동작, 동일한 `FilterPanel` 재사용
- [ ] 홈 테이블: 데스크톱 테이블 / 모바일 카드 리스트 전환
- [ ] 기존 기능 회귀 0건: 정렬 3종, 페이지네이션, 북마크, 용도 선택, 수의계약 토글, 마감일/만료 표시, 상세 링크, 탭 전환
- [ ] `frontend/src` 내 `#[0-9a-f]{3,6}` 정규식 매칭 0건
- [ ] `npm run lint` pass

### Regression 시나리오

| 시나리오 | 기대 동작 |
|---|---|
| 감정가 대비 50–70% 필터 → 검색 | 결과 테이블 업데이트 |
| 정렬 "비율 ↑" → "마감일" | 페이지 1 리셋, 활성 버튼 전환 |
| 테이블 행 클릭 | `/items/[cltr_mng_no]` 이동 |
| 상세 페이지 탭 6개 순회 | 각 탭 콘텐츠 렌더 |
| 모바일 드로어 열고 필터 변경 → 적용 | 드로어 닫힘, 결과 반영 |
| 북마크 체크 → 페이지 이동 → 복귀 | 체크 상태 유지 |

### 범위 밖 (의도적)

- Cross-browser (Chrome만). Safari/Firefox 이슈는 Phase 2에서 대응
- WCAG AA 전체 접근성 감사 — `aria-modal`, `aria-label` 기본만
- SSR 하이드레이션 차이 측정 — Next.js 16 기본 동작 신뢰
- 퍼포먼스 벤치마크 — 스타일 변경만이라 런타임 영향 없음

## Next.js 16 주의

`frontend/AGENTS.md`에 명시: 이 프로젝트는 "당신이 알던 Next.js가 아니다". 구현 전 `frontend/node_modules/next/dist/docs/` 확인할 것. 특히 App Router 관련 deprecation.

## References

- 브랜드스토밍 목업 (Modern SaaS Light 방향): `.superpowers/brainstorm/18348-1776048672/content/design-directions.html`
- 액센트 컬러 비교: `.superpowers/brainstorm/18348-1776048672/content/accent-color.html`
- 모바일 필터 패턴 비교: `.superpowers/brainstorm/18348-1776048672/content/mobile-filter.html`
