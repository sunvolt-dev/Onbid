# Analytics Dashboard & Investment Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a market analytics layer with a home-page summary strip and a dedicated analytics page featuring charts, trend lines, and an investment scoring leaderboard.

**Architecture:** Server-computed aggregations and scoring via Flask + SQL. A new `DAILY_SNAPSHOT` table, populated by the collector pipeline, powers trend data. Frontend uses Recharts for visualization. Three new API endpoints serve summary, trends, and scores.

**Tech Stack:** Python/Flask/SQLite (backend), Next.js 16/TypeScript/Recharts/Tailwind (frontend)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `onbid-dashboard/db/schema_items.py` | Add DAILY_SNAPSHOT table creation |
| Modify | `onbid-dashboard/collector/run_pipeline.py` | Write snapshot after pipeline completes |
| Modify | `onbid-dashboard/api/app.py` | Add 3 analytics endpoints + scoring logic |
| Create | `onbid-dashboard/frontend/src/types/analytics.ts` | Analytics TypeScript types |
| Create | `onbid-dashboard/frontend/src/api/analytics.ts` | Analytics API client functions |
| Create | `onbid-dashboard/frontend/src/hooks/useAnalytics.ts` | Shared analytics data hook |
| Create | `onbid-dashboard/frontend/src/components/SummaryStrip.tsx` | Home page summary strip |
| Create | `onbid-dashboard/frontend/src/components/analytics/MarketOverview.tsx` | Bar + histogram + donut charts |
| Create | `onbid-dashboard/frontend/src/components/analytics/TrendCharts.tsx` | Line charts + period selector |
| Create | `onbid-dashboard/frontend/src/components/analytics/Leaderboard.tsx` | Scored table + weight sliders |
| Create | `onbid-dashboard/frontend/src/components/analytics/AnalyticsFilters.tsx` | Region/type filter sidebar |
| Create | `onbid-dashboard/frontend/src/app/analytics/page.tsx` | Analytics page |
| Modify | `onbid-dashboard/frontend/src/app/page.tsx` | Insert SummaryStrip above FilterPanel |
| Modify | `onbid-dashboard/frontend/src/app/layout.tsx` | Add analytics nav link |

---

### Task 1: DAILY_SNAPSHOT Schema

**Files:**
- Modify: `onbid-dashboard/db/schema_items.py`

- [ ] **Step 1: Add DAILY_SNAPSHOT table creation to schema_items.py**

Open `onbid-dashboard/db/schema_items.py` and add the following table creation after the existing `ALERT_LOG` table creation:

```python
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS DAILY_SNAPSHOT (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_date TEXT NOT NULL,
            region TEXT NOT NULL,
            usage_type TEXT NOT NULL,
            total_count INTEGER NOT NULL DEFAULT 0,
            avg_ratio_pct REAL,
            min_ratio_pct REAL,
            avg_apsl_unt_prc REAL,
            avg_min_bid REAL,
            fail_count_avg REAL,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE(snapshot_date, region, usage_type)
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshot_date
        ON DAILY_SNAPSHOT(snapshot_date)
    """)
```

- [ ] **Step 2: Verify schema creation works**

Run:
```bash
cd onbid-dashboard && python -c "
from db.schema_items import init_items_schema
from db.connection import get_connection
conn = get_connection()
init_items_schema(conn)
# Check table exists
tables = conn.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='DAILY_SNAPSHOT'\").fetchall()
print('DAILY_SNAPSHOT exists:', len(tables) == 1)
conn.close()
"
```

Expected: `DAILY_SNAPSHOT exists: True`

- [ ] **Step 3: Commit**

```bash
git add onbid-dashboard/db/schema_items.py
git commit -m "feat(db): add DAILY_SNAPSHOT table for analytics trends"
```

---

### Task 2: Snapshot Writer in Pipeline

**Files:**
- Modify: `onbid-dashboard/collector/run_pipeline.py`

- [ ] **Step 1: Add snapshot writer function to run_pipeline.py**

Add this import at the top of `run_pipeline.py`:

```python
from datetime import date
```

Add this function before `main()`:

```python
def write_daily_snapshot():
    """Aggregate active BID_ITEMS into DAILY_SNAPSHOT for today."""
    logger.info("일일 스냅샷 기록 시작")
    try:
        conn = sqlite3.connect(DB_PATH)
        today = date.today().isoformat()

        rows = conn.execute("""
            SELECT
                lctn_sd_nm AS region,
                cltr_usg_mcls_nm AS usage_type,
                COUNT(*) AS total_count,
                AVG(ratio_pct) AS avg_ratio_pct,
                MIN(ratio_pct) AS min_ratio_pct,
                AVG(apsl_evl_amt) AS avg_apsl_unt_prc,
                AVG(lowst_bid_prc) AS avg_min_bid,
                AVG(usbd_nft) AS fail_count_avg
            FROM BID_ITEMS
            WHERE status = 'active'
              AND lctn_sd_nm IS NOT NULL
              AND cltr_usg_mcls_nm IS NOT NULL
            GROUP BY lctn_sd_nm, cltr_usg_mcls_nm
        """).fetchall()

        for row in rows:
            conn.execute("""
                INSERT INTO DAILY_SNAPSHOT
                    (snapshot_date, region, usage_type, total_count,
                     avg_ratio_pct, min_ratio_pct, avg_apsl_unt_prc,
                     avg_min_bid, fail_count_avg)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_date, region, usage_type)
                DO UPDATE SET
                    total_count = excluded.total_count,
                    avg_ratio_pct = excluded.avg_ratio_pct,
                    min_ratio_pct = excluded.min_ratio_pct,
                    avg_apsl_unt_prc = excluded.avg_apsl_unt_prc,
                    avg_min_bid = excluded.avg_min_bid,
                    fail_count_avg = excluded.fail_count_avg,
                    created_at = datetime('now', 'localtime')
            """, (today, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]))

        conn.commit()
        logger.info(f"일일 스냅샷 기록 완료: {len(rows)}개 그룹")

        # Log to COLLECTION_LOG
        conn.execute("""
            INSERT INTO COLLECTION_LOG (query_label, total_count, new_count, updated_count, status)
            VALUES ('daily_snapshot', ?, ?, 0, 'success')
        """, (len(rows), len(rows)))
        conn.commit()
        conn.close()

    except Exception as e:
        logger.error(f"스냅샷 기록 실패: {e}")
```

- [ ] **Step 2: Call write_daily_snapshot at the end of main()**

In the `main()` function, add the snapshot call after all three stages complete successfully (after the stage 3 log line, before the final elapsed-time log):

```python
    write_daily_snapshot()
```

- [ ] **Step 3: Test the snapshot writer**

Run:
```bash
cd onbid-dashboard && python -c "
import sqlite3
from collector.run_pipeline import write_daily_snapshot, DB_PATH
conn = sqlite3.connect(DB_PATH)
# Ensure schema exists
conn.execute('''CREATE TABLE IF NOT EXISTS DAILY_SNAPSHOT (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL, region TEXT NOT NULL, usage_type TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0, avg_ratio_pct REAL, min_ratio_pct REAL,
    avg_apsl_unt_prc REAL, avg_min_bid REAL, fail_count_avg REAL,
    created_at TEXT DEFAULT (datetime(\"now\", \"localtime\")),
    UNIQUE(snapshot_date, region, usage_type))''')
conn.commit()
conn.close()
write_daily_snapshot()
conn = sqlite3.connect(DB_PATH)
count = conn.execute('SELECT COUNT(*) FROM DAILY_SNAPSHOT').fetchone()[0]
print(f'Snapshot rows: {count}')
sample = conn.execute('SELECT snapshot_date, region, usage_type, total_count, avg_ratio_pct FROM DAILY_SNAPSHOT LIMIT 3').fetchall()
for r in sample:
    print(r)
conn.close()
"
```

Expected: Snapshot rows > 0, with today's date and valid aggregated data.

- [ ] **Step 4: Commit**

```bash
git add onbid-dashboard/collector/run_pipeline.py
git commit -m "feat(collector): write daily snapshot after pipeline run"
```

---

### Task 3: Analytics API Endpoints

**Files:**
- Modify: `onbid-dashboard/api/app.py`

- [ ] **Step 1: Add the location premium map and scoring helper**

Add these near the top of `app.py`, after the `get_db()` function:

```python
# Investment scoring: location premium map (0-100)
LOCATION_PREMIUM = {
    "서울 강남구": 100, "서울 서초구": 100, "서울 송파구": 95,
    "서울 마포구": 90, "서울 영등포구": 90, "서울 용산구": 90,
    "서울 성동구": 85, "서울 광진구": 85, "서울 종로구": 85,
    "서울": 80,
    "경기 성남시": 85, "경기 과천시": 85, "경기 하남시": 80,
    "경기 수원시": 75, "경기 용인시": 75, "경기 화성시": 70,
    "경기": 65,
    "인천": 60, "부산": 60, "대구": 55, "광주": 55,
    "대전": 55, "울산": 50, "세종": 50,
}


def get_location_score(sd_nm: str, sggn_nm: str) -> float:
    """Return location premium score (0-100) for a region."""
    specific = f"{sd_nm} {sggn_nm}" if sggn_nm else sd_nm
    if specific in LOCATION_PREMIUM:
        return LOCATION_PREMIUM[specific]
    if sd_nm in LOCATION_PREMIUM:
        return LOCATION_PREMIUM[sd_nm]
    return 30  # default for unlisted regions


def compute_scores(items: list[dict], w_ratio=0.4, w_fail=0.3, w_location=0.3) -> list[dict]:
    """Compute investment scores for a list of item dicts."""
    ratios = [it["ratio_pct"] for it in items if it["ratio_pct"] is not None]
    if not ratios:
        return items
    ratio_min = min(ratios)
    ratio_max = max(ratios)
    ratio_range = ratio_max - ratio_min if ratio_max != ratio_min else 1

    for it in items:
        r = it.get("ratio_pct")
        ratio_score = 100 * (1 - (r - ratio_min) / ratio_range) if r is not None else 0
        fail_score = min((it.get("usbd_nft", 0) or 0) / 5, 1.0) * 100
        loc_score = get_location_score(it.get("lctn_sd_nm", ""), it.get("lctn_sggn_nm", ""))

        total = w_ratio * ratio_score + w_fail * fail_score + w_location * loc_score
        it["score"] = round(total, 1)
        it["score_breakdown"] = {
            "ratio": round(w_ratio * ratio_score, 1),
            "fail": round(w_fail * fail_score, 1),
            "location": round(w_location * loc_score, 1),
        }
        it["ratio_score"] = round(ratio_score, 1)
        it["fail_score"] = round(fail_score, 1)
        it["location_score"] = round(loc_score, 1)

    return sorted(items, key=lambda x: x["score"], reverse=True)
```

- [ ] **Step 2: Add GET /api/analytics/summary endpoint**

```python
@app.route("/api/analytics/summary")
def analytics_summary():
    conn = get_db()
    try:
        # Total active items
        total = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active'"
        ).fetchone()[0]

        # By region
        by_region = conn.execute("""
            SELECT lctn_sd_nm AS region, COUNT(*) AS count,
                   ROUND(AVG(ratio_pct), 1) AS avg_ratio
            FROM BID_ITEMS WHERE status = 'active' AND lctn_sd_nm IS NOT NULL
            GROUP BY lctn_sd_nm ORDER BY count DESC
        """).fetchall()

        # By usage type
        by_usage = conn.execute("""
            SELECT cltr_usg_mcls_nm AS usage_type, COUNT(*) AS count,
                   ROUND(AVG(ratio_pct), 1) AS avg_ratio
            FROM BID_ITEMS WHERE status = 'active' AND cltr_usg_mcls_nm IS NOT NULL
            GROUP BY cltr_usg_mcls_nm ORDER BY count DESC
        """).fetchall()

        # Ratio distribution (10% buckets)
        ratio_dist = conn.execute("""
            SELECT
                CAST(CAST(ratio_pct / 10 AS INTEGER) * 10 AS TEXT) || '-' ||
                CAST(CAST(ratio_pct / 10 AS INTEGER) * 10 + 10 AS TEXT) || '%' AS bucket,
                COUNT(*) AS count
            FROM BID_ITEMS WHERE status = 'active' AND ratio_pct IS NOT NULL
            GROUP BY CAST(ratio_pct / 10 AS INTEGER)
            ORDER BY CAST(ratio_pct / 10 AS INTEGER)
        """).fetchall()

        # Top 5 scored items (default weights)
        top_rows = conn.execute("""
            SELECT cltr_mng_no, onbid_cltr_nm, ratio_pct, usbd_nft,
                   lctn_sd_nm, lctn_sggn_nm
            FROM BID_ITEMS WHERE status = 'active' AND ratio_pct IS NOT NULL
        """).fetchall()
        top_items = compute_scores([dict(r) for r in top_rows])[:5]

        # Yesterday delta
        from datetime import date, timedelta
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        yesterday_total = conn.execute("""
            SELECT SUM(total_count) FROM DAILY_SNAPSHOT WHERE snapshot_date = ?
        """, (yesterday,)).fetchone()[0]

        return jsonify({
            "total_items": total,
            "total_delta": total - yesterday_total if yesterday_total else None,
            "by_region": [dict(r) for r in by_region],
            "by_usage_type": [dict(r) for r in by_usage],
            "ratio_distribution": [dict(r) for r in ratio_dist],
            "top_scored": [{
                "cltr_mng_no": it["cltr_mng_no"],
                "name": it["onbid_cltr_nm"],
                "score": it["score"],
                "ratio_pct": it["ratio_pct"],
                "region": it["lctn_sd_nm"],
            } for it in top_items],
        })
    finally:
        conn.close()
```

- [ ] **Step 3: Add GET /api/analytics/trends endpoint**

```python
@app.route("/api/analytics/trends")
def analytics_trends():
    period = request.args.get("period", "30d")
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)

    conn = get_db()
    try:
        from datetime import date, timedelta
        start_date = (date.today() - timedelta(days=days)).isoformat()

        rows = conn.execute("""
            SELECT snapshot_date, region, usage_type, total_count,
                   avg_ratio_pct, min_ratio_pct, fail_count_avg
            FROM DAILY_SNAPSHOT
            WHERE snapshot_date >= ?
            ORDER BY snapshot_date
        """, (start_date,)).fetchall()

        # Group by date
        from collections import defaultdict
        by_date = defaultdict(lambda: {"total_count": 0, "ratio_sum": 0, "ratio_n": 0, "by_region": []})
        for r in rows:
            d = dict(r)
            entry = by_date[d["snapshot_date"]]
            entry["total_count"] += d["total_count"]
            if d["avg_ratio_pct"] is not None:
                entry["ratio_sum"] += d["avg_ratio_pct"] * d["total_count"]
                entry["ratio_n"] += d["total_count"]
            entry["by_region"].append({
                "region": d["region"],
                "usage_type": d["usage_type"],
                "count": d["total_count"],
                "avg_ratio": d["avg_ratio_pct"],
            })

        data = []
        for dt in sorted(by_date.keys()):
            entry = by_date[dt]
            avg_ratio = round(entry["ratio_sum"] / entry["ratio_n"], 1) if entry["ratio_n"] > 0 else None
            data.append({
                "date": dt,
                "total_count": entry["total_count"],
                "avg_ratio": avg_ratio,
                "by_region": entry["by_region"],
            })

        return jsonify({"period": period, "data": data})
    finally:
        conn.close()
```

- [ ] **Step 4: Add GET /api/analytics/scores endpoint**

```python
@app.route("/api/analytics/scores")
def analytics_scores():
    w_ratio = float(request.args.get("w_ratio", 0.4))
    w_fail = float(request.args.get("w_fail", 0.3))
    w_location = float(request.args.get("w_location", 0.3))
    limit = int(request.args.get("limit", 50))

    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT cltr_mng_no, onbid_cltr_nm, lctn_sd_nm, lctn_sggn_nm,
                   cltr_usg_mcls_nm, ratio_pct, usbd_nft, lowst_bid_prc,
                   apsl_evl_amt, cltr_bid_end_dt
            FROM BID_ITEMS
            WHERE status = 'active' AND ratio_pct IS NOT NULL
        """).fetchall()

        items = compute_scores([dict(r) for r in rows], w_ratio, w_fail, w_location)

        ratios = [it["ratio_pct"] for it in items if it["ratio_pct"] is not None]
        return jsonify({
            "weights": {"ratio": w_ratio, "fail": w_fail, "location": w_location},
            "normalization": {
                "ratio_min": min(ratios) if ratios else None,
                "ratio_max": max(ratios) if ratios else None,
            },
            "items": [{
                "cltr_mng_no": it["cltr_mng_no"],
                "name": it["onbid_cltr_nm"],
                "region": f"{it['lctn_sd_nm']} {it.get('lctn_sggn_nm', '')}".strip(),
                "usage_type": it.get("cltr_usg_mcls_nm", ""),
                "ratio_pct": it["ratio_pct"],
                "fail_count": it.get("usbd_nft", 0),
                "lowst_bid_prc": it.get("lowst_bid_prc"),
                "apsl_evl_amt": it.get("apsl_evl_amt"),
                "cltr_bid_end_dt": it.get("cltr_bid_end_dt"),
                "score": it["score"],
                "score_breakdown": it["score_breakdown"],
            } for it in items[:limit]],
        })
    finally:
        conn.close()
```

- [ ] **Step 5: Test all three endpoints**

Run the Flask server and test:
```bash
cd onbid-dashboard && python -c "
from api.app import app
client = app.test_client()

# Test summary
resp = client.get('/api/analytics/summary')
data = resp.get_json()
print('summary total_items:', data.get('total_items'))
print('summary regions:', len(data.get('by_region', [])))
print('summary ratio_dist:', len(data.get('ratio_distribution', [])))
print('summary top_scored:', len(data.get('top_scored', [])))

# Test trends
resp = client.get('/api/analytics/trends?period=7d')
data = resp.get_json()
print('trends period:', data.get('period'))
print('trends data points:', len(data.get('data', [])))

# Test scores
resp = client.get('/api/analytics/scores?limit=5')
data = resp.get_json()
print('scores weights:', data.get('weights'))
print('scores items:', len(data.get('items', [])))
if data.get('items'):
    top = data['items'][0]
    print('top item:', top.get('name'), 'score:', top.get('score'))
    print('breakdown:', top.get('score_breakdown'))
"
```

Expected: All three endpoints return valid JSON with real data from the database.

- [ ] **Step 6: Commit**

```bash
git add onbid-dashboard/api/app.py
git commit -m "feat(api): add analytics summary, trends, and scores endpoints"
```

---

### Task 4: Frontend Types & API Client

**Files:**
- Create: `onbid-dashboard/frontend/src/types/analytics.ts`
- Create: `onbid-dashboard/frontend/src/api/analytics.ts`

- [ ] **Step 1: Create analytics TypeScript types**

Create `onbid-dashboard/frontend/src/types/analytics.ts`:

```typescript
export interface AnalyticsSummary {
  total_items: number;
  total_delta: number | null;
  by_region: { region: string; count: number; avg_ratio: number }[];
  by_usage_type: { usage_type: string; count: number; avg_ratio: number }[];
  ratio_distribution: { bucket: string; count: number }[];
  top_scored: {
    cltr_mng_no: string;
    name: string;
    score: number;
    ratio_pct: number;
    region: string;
  }[];
}

export interface TrendDataPoint {
  date: string;
  total_count: number;
  avg_ratio: number | null;
  by_region: {
    region: string;
    usage_type: string;
    count: number;
    avg_ratio: number | null;
  }[];
}

export interface AnalyticsTrends {
  period: string;
  data: TrendDataPoint[];
}

export interface ScoredItem {
  cltr_mng_no: string;
  name: string;
  region: string;
  usage_type: string;
  ratio_pct: number;
  fail_count: number;
  lowst_bid_prc: number;
  apsl_evl_amt: number;
  cltr_bid_end_dt: string;
  score: number;
  score_breakdown: {
    ratio: number;
    fail: number;
    location: number;
  };
}

export interface AnalyticsScores {
  weights: { ratio: number; fail: number; location: number };
  normalization: { ratio_min: number | null; ratio_max: number | null };
  items: ScoredItem[];
}

export type TrendPeriod = "7d" | "30d" | "90d";

export interface ScoreWeights {
  ratio: number;
  fail: number;
  location: number;
}
```

- [ ] **Step 2: Create analytics API client**

Create `onbid-dashboard/frontend/src/api/analytics.ts`:

```typescript
import { API_BASE } from "@/utils/api";
import type {
  AnalyticsSummary,
  AnalyticsTrends,
  AnalyticsScores,
  TrendPeriod,
  ScoreWeights,
} from "@/types/analytics";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/api/analytics/summary`);
  if (!res.ok) throw new Error("분석 요약 데이터 로드 실패");
  return res.json();
}

export async function fetchAnalyticsTrends(
  period: TrendPeriod = "30d"
): Promise<AnalyticsTrends> {
  const res = await fetch(`${API_BASE}/api/analytics/trends?period=${period}`);
  if (!res.ok) throw new Error("트렌드 데이터 로드 실패");
  return res.json();
}

export async function fetchAnalyticsScores(
  weights?: ScoreWeights,
  limit: number = 50
): Promise<AnalyticsScores> {
  const params = new URLSearchParams();
  if (weights) {
    params.set("w_ratio", String(weights.ratio));
    params.set("w_fail", String(weights.fail));
    params.set("w_location", String(weights.location));
  }
  params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/api/analytics/scores?${params}`);
  if (!res.ok) throw new Error("투자 점수 데이터 로드 실패");
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
cd onbid-dashboard/frontend
git add src/types/analytics.ts src/api/analytics.ts
git commit -m "feat(frontend): add analytics types and API client"
```

---

### Task 5: useAnalytics Hook

**Files:**
- Create: `onbid-dashboard/frontend/src/hooks/useAnalytics.ts`

- [ ] **Step 1: Create the shared analytics hook**

Create `onbid-dashboard/frontend/src/hooks/useAnalytics.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsTrends,
  fetchAnalyticsScores,
} from "@/api/analytics";
import type {
  AnalyticsSummary,
  AnalyticsTrends,
  AnalyticsScores,
  TrendPeriod,
  ScoreWeights,
} from "@/types/analytics";

const DEFAULT_WEIGHTS: ScoreWeights = { ratio: 0.4, fail: 0.3, location: 0.3 };

export function useSummary() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAnalyticsSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}

export function useTrends() {
  const [data, setData] = useState<AnalyticsTrends | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TrendPeriod>("30d");

  const load = useCallback(async (p: TrendPeriod = period) => {
    setLoading(true);
    setError(null);
    setPeriod(p);
    try {
      setData(await fetchAnalyticsTrends(p));
    } catch (e) {
      setError(e instanceof Error ? e.message : "트렌드 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [period]);

  return { data, loading, error, period, load };
}

export function useScores() {
  const [data, setData] = useState<AnalyticsScores | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);

  const load = useCallback(async (w: ScoreWeights = weights, limit = 50) => {
    setLoading(true);
    setError(null);
    setWeights(w);
    try {
      setData(await fetchAnalyticsScores(w, limit));
    } catch (e) {
      setError(e instanceof Error ? e.message : "점수 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [weights]);

  return { data, loading, error, weights, load };
}
```

- [ ] **Step 2: Commit**

```bash
cd onbid-dashboard/frontend
git add src/hooks/useAnalytics.ts
git commit -m "feat(frontend): add analytics data hooks"
```

---

### Task 6: Install Recharts

**Files:**
- Modify: `onbid-dashboard/frontend/package.json`

- [ ] **Step 1: Install recharts**

```bash
cd onbid-dashboard/frontend && npm install recharts
```

- [ ] **Step 2: Verify installation**

```bash
cd onbid-dashboard/frontend && node -e "require('recharts'); console.log('recharts OK')"
```

Expected: `recharts OK`

- [ ] **Step 3: Commit**

```bash
cd onbid-dashboard/frontend
git add package.json package-lock.json
git commit -m "deps(frontend): add recharts for analytics charts"
```

---

### Task 7: SummaryStrip Component

**Files:**
- Create: `onbid-dashboard/frontend/src/components/SummaryStrip.tsx`
- Modify: `onbid-dashboard/frontend/src/app/page.tsx`

- [ ] **Step 1: Create SummaryStrip component**

Create `onbid-dashboard/frontend/src/components/SummaryStrip.tsx`:

```typescript
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
          <div key={i} className="h-20 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  const topRegion = data.by_region[0];
  const topScored = data.top_scored[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* Total listings */}
      <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">전체 물건</p>
        <p className="text-2xl font-bold text-[#185fa5]">
          {data.total_items.toLocaleString()}
          {data.total_delta != null && (
            <span className={`text-sm ml-2 ${data.total_delta >= 0 ? "text-red-500" : "text-blue-500"}`}>
              {data.total_delta >= 0 ? "▲" : "▼"}{Math.abs(data.total_delta)}
            </span>
          )}
        </p>
      </div>

      {/* Average ratio */}
      <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">평균 감정가율</p>
        <p className="text-2xl font-bold text-[#185fa5]">
          {data.by_region.length > 0
            ? (data.by_region.reduce((s, r) => s + r.avg_ratio * r.count, 0) /
               data.by_region.reduce((s, r) => s + r.count, 0)).toFixed(1)
            : "-"}%
        </p>
      </div>

      {/* Top region */}
      <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">최다 지역</p>
        <p className="text-2xl font-bold text-[#185fa5]">
          {topRegion ? `${topRegion.region}` : "-"}
        </p>
        {topRegion && (
          <p className="text-xs text-gray-400">{topRegion.count}건</p>
        )}
      </div>

      {/* #1 scored */}
      <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
        <p className="text-xs text-gray-500 mb-1">투자 1순위</p>
        {topScored ? (
          <Link
            href={`/items/${topScored.cltr_mng_no}`}
            className="text-sm font-bold text-[#185fa5] hover:underline line-clamp-1"
          >
            {topScored.name}
          </Link>
        ) : (
          <p className="text-2xl font-bold text-[#185fa5]">-</p>
        )}
        {topScored && (
          <p className="text-xs text-gray-400">
            점수 {topScored.score} · {topScored.ratio_pct}%
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add SummaryStrip to home page**

In `onbid-dashboard/frontend/src/app/page.tsx`, add the import at the top:

```typescript
import SummaryStrip from "@/components/SummaryStrip";
```

Then insert `<SummaryStrip />` inside the `<main>` tag, right after the `<h1>` header and `<p>` description, before the error/loading/table section:

```typescript
        <SummaryStrip />
```

- [ ] **Step 3: Verify it compiles**

```bash
cd onbid-dashboard/frontend && npx next build 2>&1 | tail -20
```

Expected: Build succeeds (or only existing warnings).

- [ ] **Step 4: Commit**

```bash
cd onbid-dashboard/frontend
git add src/components/SummaryStrip.tsx src/app/page.tsx
git commit -m "feat(frontend): add summary strip to home page"
```

---

### Task 8: MarketOverview Chart Component

**Files:**
- Create: `onbid-dashboard/frontend/src/components/analytics/MarketOverview.tsx`

- [ ] **Step 1: Create MarketOverview component**

Create `onbid-dashboard/frontend/src/components/analytics/MarketOverview.tsx`:

```typescript
"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import type { AnalyticsSummary } from "@/types/analytics";

const COLORS = [
  "#185fa5", "#2e86de", "#54a0ff", "#82ccdd", "#78e08f",
  "#f6b93b", "#e55039", "#b71540", "#6c5ce7", "#a29bfe",
];

interface Props {
  data: AnalyticsSummary;
}

export default function MarketOverview({ data }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">시장 현황</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Region bar chart */}
        <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">지역별 물건 수</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.by_region} layout="vertical" margin={{ left: 40 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="region" width={50} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [`${value}건`, "물건 수"]}
              />
              <Bar dataKey="count" fill="#185fa5" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ratio histogram */}
        <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">감정가율 분포</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.ratio_distribution}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [`${value}건`, "물건 수"]}
              />
              <Bar dataKey="count" fill="#2e86de" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usage type donut */}
        <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">용도별 비율</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.by_usage_type}
                dataKey="count"
                nameKey="usage_type"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                label={({ usage_type, percent }) =>
                  `${usage_type} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.by_usage_type.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value}건`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd onbid-dashboard/frontend
git add src/components/analytics/MarketOverview.tsx
git commit -m "feat(frontend): add MarketOverview chart component"
```

---

### Task 9: TrendCharts Component

**Files:**
- Create: `onbid-dashboard/frontend/src/components/analytics/TrendCharts.tsx`

- [ ] **Step 1: Create TrendCharts component**

Create `onbid-dashboard/frontend/src/components/analytics/TrendCharts.tsx`:

```typescript
"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { AnalyticsTrends, TrendPeriod } from "@/types/analytics";

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "90d", label: "90일" },
];

interface Props {
  data: AnalyticsTrends | null;
  period: TrendPeriod;
  loading: boolean;
  onPeriodChange: (p: TrendPeriod) => void;
}

export default function TrendCharts({ data, period, loading, onPeriodChange }: Props) {
  const chartData = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">트렌드</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => onPeriodChange(p.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                period === p.value
                  ? "bg-[#185fa5] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          트렌드 데이터 로딩 중...
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          데이터가 아직 충분하지 않습니다. 스냅샷이 쌓이면 트렌드를 볼 수 있습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Total count trend */}
          <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">물건 수 추이</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(d: string) => d}
                  formatter={(value: number) => [`${value}건`, "물건 수"]}
                />
                <Line
                  type="monotone"
                  dataKey="total_count"
                  stroke="#185fa5"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg ratio trend */}
          <div className="bg-white border border-[#d3d1c7] rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">평균 감정가율 추이</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis domain={["auto", "auto"]} unit="%" />
                <Tooltip
                  labelFormatter={(d: string) => d}
                  formatter={(value: number) => [`${value}%`, "평균 감정가율"]}
                />
                <Line
                  type="monotone"
                  dataKey="avg_ratio"
                  stroke="#e55039"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd onbid-dashboard/frontend
git add src/components/analytics/TrendCharts.tsx
git commit -m "feat(frontend): add TrendCharts component"
```

---

### Task 10: Leaderboard Component

**Files:**
- Create: `onbid-dashboard/frontend/src/components/analytics/Leaderboard.tsx`

- [ ] **Step 1: Create Leaderboard component**

Create `onbid-dashboard/frontend/src/components/analytics/Leaderboard.tsx`:

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import type { AnalyticsScores, ScoreWeights } from "@/types/analytics";

interface Props {
  data: AnalyticsScores | null;
  loading: boolean;
  weights: ScoreWeights;
  onWeightsChange: (w: ScoreWeights) => void;
}

function ScoreBar({ breakdown }: { breakdown: { ratio: number; fail: number; location: number } }) {
  const total = breakdown.ratio + breakdown.fail + breakdown.location;
  if (total === 0) return null;

  return (
    <div className="flex h-4 w-24 rounded overflow-hidden" title={`감정가율: ${breakdown.ratio} | 유찰: ${breakdown.fail} | 입지: ${breakdown.location}`}>
      <div style={{ width: `${(breakdown.ratio / total) * 100}%` }} className="bg-blue-500" />
      <div style={{ width: `${(breakdown.fail / total) * 100}%` }} className="bg-orange-400" />
      <div style={{ width: `${(breakdown.location / total) * 100}%` }} className="bg-green-500" />
    </div>
  );
}

export default function Leaderboard({ data, loading, weights, onWeightsChange }: Props) {
  const [showWeights, setShowWeights] = useState(false);
  const [local, setLocal] = useState(weights);

  function handleSlider(key: keyof ScoreWeights, val: number) {
    const updated = { ...local, [key]: val };
    // Normalize remaining two to sum to (1 - val)
    const others = (Object.keys(updated) as (keyof ScoreWeights)[]).filter((k) => k !== key);
    const othersSum = others.reduce((s, k) => s + updated[k], 0);
    if (othersSum > 0) {
      const scale = (1 - val) / othersSum;
      for (const k of others) {
        updated[k] = Math.round(updated[k] * scale * 100) / 100;
      }
    }
    setLocal(updated);
  }

  function applyWeights() {
    onWeightsChange(local);
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">투자 스코어보드</h2>
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="text-sm text-[#185fa5] hover:underline"
        >
          {showWeights ? "가중치 닫기" : "커스텀 가중치"}
        </button>
      </div>

      {/* Weight sliders */}
      {showWeights && (
        <div className="bg-gray-50 border border-[#d3d1c7] rounded-lg p-4 space-y-3">
          {([
            { key: "ratio" as const, label: "감정가율", color: "bg-blue-500" },
            { key: "fail" as const, label: "유찰 횟수", color: "bg-orange-400" },
            { key: "location" as const, label: "입지 프리미엄", color: "bg-green-500" },
          ]).map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm w-24">{label}</span>
              <div className={`w-3 h-3 rounded-full ${color}`} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={local[key]}
                onChange={(e) => handleSlider(key, parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm w-12 text-right">
                {(local[key] * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          <button
            onClick={applyWeights}
            className="px-4 py-1.5 text-sm bg-[#185fa5] text-white rounded-md hover:bg-[#134d88] transition-colors"
          >
            적용
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-400">
          스코어 계산 중...
        </div>
      ) : (
        <div className="bg-white border border-[#d3d1c7] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-[#d3d1c7]">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">물건명</th>
                <th className="px-3 py-2 text-left">지역</th>
                <th className="px-3 py-2 text-left">용도</th>
                <th className="px-3 py-2 text-right">감정가율</th>
                <th className="px-3 py-2 text-right">유찰</th>
                <th className="px-3 py-2 text-right">점수</th>
                <th className="px-3 py-2 text-center">구성</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.cltr_mng_no}
                  className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/items/${item.cltr_mng_no}`}
                      className="text-[#185fa5] hover:underline line-clamp-1"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.region}</td>
                  <td className="px-3 py-2 text-gray-600">{item.usage_type}</td>
                  <td className="px-3 py-2 text-right">{item.ratio_pct}%</td>
                  <td className="px-3 py-2 text-right">{item.fail_count}회</td>
                  <td className="px-3 py-2 text-right font-bold">{item.score}</td>
                  <td className="px-3 py-2 flex justify-center">
                    <ScoreBar breakdown={item.score_breakdown} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          감정가율
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
          유찰 횟수
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          입지
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd onbid-dashboard/frontend
git add src/components/analytics/Leaderboard.tsx
git commit -m "feat(frontend): add Leaderboard component with weight sliders"
```

---

### Task 11: AnalyticsFilters Component

**Files:**
- Create: `onbid-dashboard/frontend/src/components/analytics/AnalyticsFilters.tsx`

- [ ] **Step 1: Create AnalyticsFilters component**

Create `onbid-dashboard/frontend/src/components/analytics/AnalyticsFilters.tsx`:

```typescript
"use client";

const REGIONS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종"];
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
              {r}
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
```

- [ ] **Step 2: Commit**

```bash
cd onbid-dashboard/frontend
git add src/components/analytics/AnalyticsFilters.tsx
git commit -m "feat(frontend): add AnalyticsFilters component"
```

---

### Task 12: Analytics Page

**Files:**
- Create: `onbid-dashboard/frontend/src/app/analytics/page.tsx`
- Modify: `onbid-dashboard/frontend/src/app/layout.tsx`

- [ ] **Step 1: Create the analytics page**

Create `onbid-dashboard/frontend/src/app/analytics/page.tsx`:

```typescript
"use client";

import { useEffect, useState, useMemo } from "react";
import { useSummary, useTrends, useScores } from "@/hooks/useAnalytics";
import MarketOverview from "@/components/analytics/MarketOverview";
import TrendCharts from "@/components/analytics/TrendCharts";
import Leaderboard from "@/components/analytics/Leaderboard";
import AnalyticsFilters, {
  type AnalyticsFilterState,
} from "@/components/analytics/AnalyticsFilters";
import type { AnalyticsSummary, TrendPeriod } from "@/types/analytics";
import Link from "next/link";

export default function AnalyticsPage() {
  const summary = useSummary();
  const trends = useTrends();
  const scores = useScores();

  const [filter, setFilter] = useState<AnalyticsFilterState>({
    regions: [],
    usageTypes: [],
  });

  useEffect(() => {
    summary.load();
    trends.load();
    scores.load();
  }, []);

  function handlePeriodChange(p: TrendPeriod) {
    trends.load(p);
  }

  // Client-side filter applied to summary data for charts
  const filteredSummary = useMemo((): AnalyticsSummary | null => {
    if (!summary.data) return null;
    const d = summary.data;
    return {
      ...d,
      by_region:
        filter.regions.length > 0
          ? d.by_region.filter((r) => filter.regions.includes(r.region))
          : d.by_region,
      by_usage_type:
        filter.usageTypes.length > 0
          ? d.by_usage_type.filter((u) =>
              filter.usageTypes.includes(u.usage_type)
            )
          : d.by_usage_type,
    };
  }, [summary.data, filter]);

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#d3d1c7] bg-white p-4 space-y-6">
        <Link
          href="/"
          className="text-sm text-[#185fa5] hover:underline block mb-4"
        >
          &larr; 물건 목록
        </Link>
        <AnalyticsFilters filter={filter} onChange={setFilter} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 space-y-8 min-w-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">분석 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">
            시장 현황, 트렌드, 투자 스코어
          </p>
        </div>

        {summary.error && (
          <div className="text-red-500 text-sm">
            데이터를 불러오지 못했습니다: {summary.error}
          </div>
        )}

        {/* Market Overview */}
        {filteredSummary && <MarketOverview data={filteredSummary} />}

        {/* Trends */}
        <TrendCharts
          data={trends.data}
          period={trends.period}
          loading={trends.loading}
          onPeriodChange={handlePeriodChange}
        />

        {/* Leaderboard */}
        <Leaderboard
          data={scores.data}
          loading={scores.loading}
          weights={scores.weights}
          onWeightsChange={(w) => scores.load(w)}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add analytics nav link to layout**

In `onbid-dashboard/frontend/src/app/layout.tsx`, update the body to include a minimal nav. Replace the body content:

```typescript
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full bg-[#faf9f7]">
        <nav className="bg-white border-b border-[#d3d1c7] px-6 py-2 flex items-center gap-6">
          <a href="/" className="text-sm font-bold text-[#185fa5]">
            온비드 대시보드
          </a>
          <a
            href="/analytics"
            className="text-sm text-gray-600 hover:text-[#185fa5] transition-colors"
          >
            분석
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd onbid-dashboard/frontend && npx next build 2>&1 | tail -20
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd onbid-dashboard/frontend
git add src/app/analytics/page.tsx src/app/layout.tsx
git commit -m "feat(frontend): add analytics page and nav link"
```

---

### Task 13: End-to-End Smoke Test

- [ ] **Step 1: Ensure snapshot table exists and has data**

```bash
cd onbid-dashboard && python -c "
from db.schema_items import init_items_schema
from db.connection import get_connection
from collector.run_pipeline import write_daily_snapshot
conn = get_connection()
init_items_schema(conn)
conn.close()
write_daily_snapshot()
print('Snapshot populated')
"
```

- [ ] **Step 2: Test all API endpoints return valid JSON**

```bash
cd onbid-dashboard && python -c "
from api.app import app
c = app.test_client()
for path in ['/api/analytics/summary', '/api/analytics/trends?period=7d', '/api/analytics/scores?limit=3']:
    r = c.get(path)
    assert r.status_code == 200, f'{path} returned {r.status_code}'
    d = r.get_json()
    print(f'{path} -> OK ({list(d.keys())})')
print('All API endpoints pass')
"
```

- [ ] **Step 3: Verify frontend builds cleanly**

```bash
cd onbid-dashboard/frontend && npx next build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
# If any unstaged changes remain, stage and commit them
```
