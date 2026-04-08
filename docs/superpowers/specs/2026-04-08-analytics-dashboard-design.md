# Analytics Dashboard & Investment Scoring

**Date**: 2026-04-08
**Status**: Approved

## Overview

Add a market analytics and investment scoring layer to the Onbid Dashboard. Two user-facing surfaces:

1. **Summary Strip** — compact stats bar above the home page item list
2. **Dedicated Analytics Page** — charts, trend lines, and a scored investment leaderboard

## Approach

**Hybrid (server + snapshot)**: Aggregations and scoring computed server-side in Flask via SQL. Trend data powered by a new `DAILY_SNAPSHOT` table populated by the collector pipeline on each run. Frontend renders pre-computed data with Recharts.

---

## Data Layer

### DAILY_SNAPSHOT Table

Added to `db/schema_items.py`. Written at the end of each `run_pipeline.py` execution.

| Column           | Type    | Description                      |
|------------------|---------|----------------------------------|
| id               | INTEGER | PRIMARY KEY                      |
| snapshot_date    | TEXT    | YYYY-MM-DD                       |
| region           | TEXT    | 시/도                            |
| usage_type       | TEXT    | 용도                             |
| total_count      | INTEGER | Number of active items           |
| avg_ratio_pct    | REAL    | Average 감정가율                 |
| min_ratio_pct    | REAL    | Minimum 감정가율                 |
| avg_apsl_unt_prc | REAL    | Average 감정가                   |
| avg_min_bid      | REAL    | Average 최저입찰가               |
| fail_count_avg   | REAL    | Average 유찰횟수                 |
| created_at       | TEXT    | Timestamp                        |

**Constraint**: `UNIQUE(snapshot_date, region, usage_type)` — enables UPSERT on re-runs.

### Investment Score Formula

```
score = (w_ratio x ratio_score) + (w_fail x fail_score) + (w_location x location_score)

Defaults: w_ratio=0.4, w_fail=0.3, w_location=0.3
```

- **ratio_score**: Normalized 0-100 using **global** min/max across all `BID_ITEMS`. `100 x (1 - (ratio - min_ratio) / (max_ratio - min_ratio))`. Global normalization ensures scores are stable over time for trend comparison.
- **fail_score**: Normalized 0-100. More failures = higher score. Capped at 5+ failures = 100. Formula: `min(fail_count / 5, 1.0) x 100`.
- **location_score**: Configurable region premium map (Python dict in API). Seoul Gangnam/Seocho = 100, other Seoul = 80, Gyeonggi key cities = 70, etc.

Weights passed as query params with defaults. Adjustable via frontend sliders.

---

## API Endpoints

### `GET /api/analytics/summary`

Powers the home page summary strip. Returns current aggregate stats from `BID_ITEMS`.

```json
{
  "total_items": 342,
  "by_region": [
    {"region": "서울", "count": 89, "avg_ratio": 62.3}
  ],
  "by_usage_type": [
    {"usage_type": "오피스텔", "count": 156, "avg_ratio": 60.1}
  ],
  "ratio_distribution": [
    {"bucket": "30-40%", "count": 12}
  ],
  "top_scored": [
    {"cltr_mng_no": "...", "name": "...", "score": 92.3, "ratio_pct": 38.5, "region": "서울"}
  ]
}
```

Ratio distribution uses 10% buckets. Top scored returns top 5 with default weights.

### `GET /api/analytics/trends?period=30d`

Powers trend charts. Queries `DAILY_SNAPSHOT`.

```json
{
  "period": "30d",
  "data": [
    {
      "date": "2026-03-09",
      "total_count": 310,
      "avg_ratio": 61.2,
      "by_region": [
        {"region": "서울", "count": 82, "avg_ratio": 63.1}
      ]
    }
  ]
}
```

Supports `period`: `7d`, `30d`, `90d`. Defaults to `30d`.

### `GET /api/analytics/scores?w_ratio=0.4&w_fail=0.3&w_location=0.3&limit=50`

Powers the scored leaderboard.

```json
{
  "weights": {"ratio": 0.4, "fail": 0.3, "location": 0.3},
  "normalization": {"ratio_min": 28.5, "ratio_max": 95.0},
  "items": [
    {
      "cltr_mng_no": "...",
      "name": "...",
      "region": "서울 강남구",
      "usage_type": "오피스텔",
      "ratio_pct": 38.5,
      "fail_count": 3,
      "score": 92.3,
      "score_breakdown": {"ratio": 38.2, "fail": 18.0, "location": 24.0}
    }
  ]
}
```

Weight params optional (use defaults). `limit` defaults to 50.

---

## Frontend

### Summary Strip (Home Page)

Horizontal bar above FilterPanel on `app/page.tsx`. Four compact cards:

| Card             | Content                                                  |
|------------------|----------------------------------------------------------|
| Total Listings   | Count + delta from yesterday (e.g., "342 물건 ▲12")     |
| Avg Ratio        | Overall average ratio_pct (e.g., "평균 감정가율 61.2%") |
| Top Region       | Region with most listings + count                        |
| #1 Scored        | Highest-scored item name + score, clickable to detail    |

Collapses to 2x2 grid on mobile.

### Analytics Page (`app/analytics/page.tsx`)

Accessible via navigation link. Four sections:

**1. Market Overview (top)**
- Region distribution horizontal bar chart (sorted by count)
- Ratio distribution histogram (10% buckets)
- Usage type donut chart

**2. Trend Lines (middle)**
- Line chart: total listing count over time
- Line chart: average ratio over time
- Period selector: 7d / 30d / 90d tabs
- Optional region filter dropdown

**3. Investment Leaderboard (bottom)**
- Scored items table, sorted by score descending
- Columns: rank, name, region, type, ratio, fail count, score, breakdown sparkbar
- Collapsed "커스텀 가중치" section with 3 sliders for weight adjustment
- Click row navigates to detail page

**4. Filters sidebar**
- Region multi-select
- Usage type multi-select
- Applies across all sections

### Chart Library

**Recharts** — lightweight, React-native, good Next.js compatibility.

### New Files

```
frontend/src/
├── app/analytics/page.tsx          # Analytics page
├── components/SummaryStrip.tsx     # Home page strip
├── components/analytics/
│   ├── MarketOverview.tsx          # Bar + histogram + donut
│   ├── TrendCharts.tsx             # Line charts + period selector
│   ├── Leaderboard.tsx             # Scored table + weight sliders
│   └── AnalyticsFilters.tsx        # Region/type filter sidebar
└── hooks/useAnalytics.ts           # Shared data fetching hook
```

---

## Collector Pipeline Change

At the end of `run_pipeline.py`, after all three collectors complete:

1. Query `BID_ITEMS` grouped by `(region, usage_type)` for active items
2. UPSERT aggregated rows into `DAILY_SNAPSHOT` with today's date
3. Log snapshot creation to `COLLECTION_LOG`

This adds ~1 query per pipeline run — negligible overhead.

### Backfill Strategy

On first deploy, run a one-time backfill that creates a single snapshot for today from current data. Historical trends will build up naturally from that point forward. No attempt to fabricate past snapshots.
