import os
import sys
import sqlite3
from datetime import date, timedelta
from collections import defaultdict
from flask import Flask, jsonify, request, abort
from flask_cors import CORS

# 프로젝트 루트 + collector를 sys.path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "collector"))

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "collector", "onbid.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─────────────────────────────────────────
# GET /api/items
# 목록 + 필터 + 정렬
# 쿼리 파라미터: ratio_max, usbd_min, sd_nm, bookmarked, pvct, limit
# ─────────────────────────────────────────
@app.route("/api/items")
def get_items():
    ratio_min  = request.args.get("ratio_min",  type=float)
    ratio_max  = request.args.get("ratio_max",  type=float)
    price_min  = request.args.get("price_min",  type=int)
    price_max  = request.args.get("price_max",  type=int)
    usbd_min   = request.args.get("usbd_min",   type=int)
    sd_nm      = request.args.get("sd_nm",      type=str)
    bookmarked = request.args.get("bookmarked", type=int)
    pvct       = request.args.get("pvct",       type=str)
    usg_mcls   = request.args.get("usg_mcls",   type=str)
    usg_scls   = request.args.get("usg_scls",   type=str)
    limit      = request.args.get("limit",      type=int, default=100)

    conditions = ["status = 'active'"]
    params = []

    if ratio_min is not None:
        conditions.append("ratio_pct >= ?")
        params.append(ratio_min)
    if ratio_max is not None:
        conditions.append("ratio_pct <= ?")
        params.append(ratio_max)
    if price_min is not None:
        conditions.append("lowst_bid_prc >= ?")
        params.append(price_min)
    if price_max is not None:
        conditions.append("lowst_bid_prc <= ?")
        params.append(price_max)
    if usbd_min is not None:
        conditions.append("usbd_nft >= ?")
        params.append(usbd_min)
    if sd_nm:
        conditions.append("lctn_sd_nm = ?")
        params.append(sd_nm)
    if bookmarked is not None:
        conditions.append("is_bookmarked = ?")
        params.append(bookmarked)
    if pvct in ("Y", "N"):
        conditions.append("pvct_trgt_yn = ?")
        params.append(pvct)
    if usg_mcls:
        conditions.append("cltr_usg_mcls_nm = ?")
        params.append(usg_mcls)
    if usg_scls:
        conditions.append("cltr_usg_scls_nm = ?")
        params.append(usg_scls)

    where = " AND ".join(conditions)
    params.append(limit)

    conn = get_db()
    try:
        rows = conn.execute(
            f"SELECT * FROM BID_ITEMS WHERE {where} ORDER BY ratio_pct ASC LIMIT ?",
            params,
        ).fetchall()
    finally:
        conn.close()

    return jsonify([dict(r) for r in rows])


# ─────────────────────────────────────────
# GET /api/stats
# 목록 요약 통계 바 (필터 무관 전체 active 기준)
# ─────────────────────────────────────────
@app.route("/api/stats")
def get_stats():
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active'"
        ).fetchone()[0]

        bookmarked = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active' AND is_bookmarked = 1"
        ).fetchone()[0]

        ratio_row = conn.execute(
            "SELECT AVG(ratio_pct), MIN(ratio_pct) FROM BID_ITEMS WHERE status = 'active'"
        ).fetchone()

        by_region = conn.execute(
            """
            SELECT lctn_sd_nm, COUNT(*) as cnt
            FROM BID_ITEMS
            WHERE status = 'active'
            GROUP BY lctn_sd_nm
            ORDER BY cnt DESC
            """
        ).fetchall()

        pvct_count = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active' AND pvct_trgt_yn = 'Y'"
        ).fetchone()[0]

        ratio_below60 = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active' AND ratio_pct < 60"
        ).fetchone()[0]

        ratio_60_70 = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active' AND ratio_pct >= 60 AND ratio_pct < 70"
        ).fetchone()[0]
    finally:
        conn.close()

    return jsonify({
        "total":         total,
        "bookmarked":    bookmarked,
        "pvct_count":    pvct_count,
        "ratio_avg":     round(ratio_row[0], 1) if ratio_row[0] else None,
        "ratio_min":     ratio_row[1],
        "ratio_below60": ratio_below60,
        "ratio_60_70":   ratio_60_70,
        "by_region":     [dict(r) for r in by_region],
    })


# ─────────────────────────────────────────
# GET /api/items/<id>
# 상세 Hero 섹션 (BID_ITEMS 단건)
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>")
def get_item(item_id):
    conn = get_db()
    try:
        item = conn.execute(
            "SELECT * FROM BID_ITEMS WHERE cltr_mng_no = ?", (item_id,)
        ).fetchone()
    finally:
        conn.close()

    if item is None:
        abort(404)

    return jsonify(dict(item))


# ─────────────────────────────────────────
# GET /api/items/<id>/info
# 탭1 기본정보 — 면적·감정평가·공매재산명세서
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/info")
def get_item_info(item_id):
    conn = get_db()
    try:
        item = conn.execute(
            "SELECT cltr_mng_no FROM BID_ITEMS WHERE cltr_mng_no = ?", (item_id,)
        ).fetchone()

        if item is None:
            abort(404)

        sqms     = conn.execute("SELECT * FROM BID_SQMS     WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        apsl_evl = conn.execute("SELECT * FROM BID_APSL_EVL WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        paps_inf = conn.execute("SELECT * FROM BID_PAPS_INF WHERE cltr_mng_no = ?", (item_id,)).fetchone()
        crtn_lst = conn.execute("SELECT * FROM BID_CRTN_LST WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        batc_cltr = conn.execute("SELECT * FROM BID_BATC_CLTR WHERE cltr_mng_no = ?", (item_id,)).fetchall()
    finally:
        conn.close()

    return jsonify({
        "sqms":      [dict(r) for r in sqms],
        "apsl_evl":  [dict(r) for r in apsl_evl],
        "paps_inf":  dict(paps_inf) if paps_inf else None,
        "crtn_lst":  [dict(r) for r in crtn_lst],
        "batc_cltr": [dict(r) for r in batc_cltr],
    })


# ─────────────────────────────────────────
# GET /api/items/<id>/history
# 탭2 유찰내역 — 회차별 입찰정보 + 이전 입찰 내역
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/history")
def get_item_history(item_id):
    conn = get_db()
    try:
        item = conn.execute(
            "SELECT cltr_mng_no FROM BID_ITEMS WHERE cltr_mng_no = ?", (item_id,)
        ).fetchone()

        if item is None:
            abort(404)

        quals = conn.execute(
            "SELECT * FROM BID_QUAL WHERE cltr_mng_no = ? ORDER BY bid_seq ASC",
            (item_id,),
        ).fetchall()

        result = []
        for q in quals:
            hists = conn.execute(
                "SELECT * FROM BID_HIST WHERE bid_qual_id = ?",
                (q["id"],),
            ).fetchall()
            result.append({**dict(q), "hist": [dict(h) for h in hists]})
    finally:
        conn.close()

    return jsonify(result)


# ─────────────────────────────────────────
# GET /api/items/<id>/tenant
# 탭4 임차인 정보 — 임대차·점유관계·등기사항·배분요구
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/tenant")
def get_item_tenant(item_id):
    conn = get_db()
    try:
        item = conn.execute(
            "SELECT cltr_mng_no FROM BID_ITEMS WHERE cltr_mng_no = ?", (item_id,)
        ).fetchone()

        if item is None:
            abort(404)

        leas_inf  = conn.execute("SELECT * FROM BID_LEAS_INF  WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        ocpy_rel  = conn.execute("SELECT * FROM BID_OCPY_REL  WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        rgst_prmr = conn.execute("SELECT * FROM BID_RGST_PRMR WHERE cltr_mng_no = ?", (item_id,)).fetchall()
        dtbt_rqr  = conn.execute("SELECT * FROM BID_DTBT_RQR  WHERE cltr_mng_no = ?", (item_id,)).fetchall()
    finally:
        conn.close()

    return jsonify({
        "leas_inf":  [dict(r) for r in leas_inf],
        "ocpy_rel":  [dict(r) for r in ocpy_rel],
        "rgst_prmr": [dict(r) for r in rgst_prmr],
        "dtbt_rqr":  [dict(r) for r in dtbt_rqr],
    })


# ─────────────────────────────────────────
# POST /api/items/<id>/bookmark
# 관심물건 토글
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/bookmark", methods=["POST"])
def toggle_bookmark(item_id):
    conn = get_db()
    try:
        item = conn.execute(
            "SELECT cltr_mng_no, is_bookmarked FROM BID_ITEMS WHERE cltr_mng_no = ?",
            (item_id,),
        ).fetchone()

        if item is None:
            abort(404)

        new_value = 0 if item["is_bookmarked"] else 1
        conn.execute(
            "UPDATE BID_ITEMS SET is_bookmarked = ? WHERE cltr_mng_no = ?",
            (new_value, item_id),
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"cltr_mng_no": item_id, "is_bookmarked": new_value})



# ─────────────────────────────────────────
# GET /api/items/<id>/check
# 온비드 API에 물건이 아직 유효한지 확인
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/check")
def check_item(item_id):
    from onbid_bid_collector import fetch_bid

    conn = get_db()
    try:
        item = conn.execute(
            "SELECT cltr_mng_no, pbct_cdtn_no, status FROM BID_ITEMS WHERE cltr_mng_no = ?",
            (item_id,),
        ).fetchone()
    finally:
        conn.close()

    if item is None:
        abort(404)

    data = fetch_bid(item["cltr_mng_no"], item["pbct_cdtn_no"])

    if data is None:
        # API가 NODATA → 종료된 물건. DB 상태 업데이트
        conn2 = sqlite3.connect(DB_PATH)
        try:
            conn2.execute(
                "UPDATE BID_ITEMS SET status = 'closed' WHERE cltr_mng_no = ?",
                (item_id,),
            )
            conn2.commit()
        finally:
            conn2.close()
        return jsonify({"alive": False, "status": "closed"})

    return jsonify({"alive": True, "status": "active"})


# ─────────────────────────────────────────
# POST /api/items/<id>/refresh
# 단건 새로고침 — 온비드 API에서 상세+입찰 정보 재수집
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/refresh", methods=["POST"])
def refresh_item(item_id):
    from onbid_detail_collector import fetch_detail, save_detail
    from onbid_bid_collector import fetch_bid, save_bid
    from db.schema_detail import init_detail_db
    from db.schema_bid import init_bid_db

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row

        item = conn.execute(
            "SELECT cltr_mng_no, pbct_cdtn_no FROM BID_ITEMS WHERE cltr_mng_no = ?",
            (item_id,),
        ).fetchone()

        if item is None:
            abort(404)

        cltr_mng_no = item["cltr_mng_no"]
        pbct_cdtn_no = item["pbct_cdtn_no"]
        results = {"detail": False, "bid": False}

        # 상세 정보 재수집
        try:
            init_detail_db(conn)
            detail_data = fetch_detail(cltr_mng_no, pbct_cdtn_no)
            if detail_data:
                save_detail(conn, cltr_mng_no, detail_data)
                results["detail"] = True
        except Exception:
            pass

        # 입찰 정보 재수집
        try:
            init_bid_db(conn)
            bid_data = fetch_bid(cltr_mng_no, pbct_cdtn_no)
            if bid_data:
                save_bid(conn, cltr_mng_no, bid_data)
                results["bid"] = True

                # 원본 API 응답에서 현재 회차 데이터 직접 추출
                raw = bid_data
                if "body" in bid_data:
                    items_raw = (bid_data.get("body") or {}).get("items", {}).get("item")
                    if isinstance(items_raw, list):
                        raw = items_raw[0]
                    elif isinstance(items_raw, dict):
                        raw = items_raw

                usbd = raw.get("usbdNft")
                cur_price = raw.get("prcnNsqLowstBidPrc") or raw.get("lowstBidPrc")

                if usbd is not None or cur_price is not None:
                    apsl = conn.execute(
                        "SELECT apsl_evl_amt FROM BID_ITEMS WHERE cltr_mng_no = ?",
                        (cltr_mng_no,),
                    ).fetchone()
                    updates = {}
                    if usbd is not None:
                        updates["usbd_nft"] = int(usbd)
                    if cur_price is not None:
                        price = int(float(cur_price))
                        updates["lowst_bid_prc"] = price
                        if apsl and apsl["apsl_evl_amt"]:
                            updates["ratio_pct"] = round(price / apsl["apsl_evl_amt"] * 100, 2)
                    if updates:
                        set_clause = ", ".join(f"{k} = ?" for k in updates)
                        conn.execute(
                            f"UPDATE BID_ITEMS SET {set_clause} WHERE cltr_mng_no = ?",
                            (*updates.values(), cltr_mng_no),
                        )
                        conn.commit()
        except Exception:
            pass

        # 갱신된 데이터 반환
        conn.row_factory = sqlite3.Row
        updated = conn.execute(
            "SELECT * FROM BID_ITEMS WHERE cltr_mng_no = ?", (item_id,)
        ).fetchone()

        return jsonify({"item": dict(updated), "refreshed": results})
    finally:
        conn.close()


# ─────────────────────────────────────────
# GET /api/items/<id>/market-price
# 탭3 수익성 분석 — 국토부 실거래가 기반 시세 조회
# ─────────────────────────────────────────
@app.route("/api/items/<item_id>/market-price")
def get_market_price(item_id):
    from molit_fetcher import get_market_price as fetch_market
    from db.schema_molit import init_molit_db

    conn = sqlite3.connect(DB_PATH)
    try:
        conn.row_factory = sqlite3.Row
        item = conn.execute(
            """SELECT cltr_mng_no, lctn_sd_nm, lctn_sggn_nm, lctn_emd_nm,
                      cltr_usg_scls_nm, bld_sqms, onbid_cltr_nm,
                      lowst_bid_prc, apsl_evl_amt
               FROM BID_ITEMS WHERE cltr_mng_no = ?""",
            (item_id,),
        ).fetchone()

        if item is None:
            abort(404)

        init_molit_db(conn)

        result = fetch_market(
            conn,
            sd_nm=item["lctn_sd_nm"],
            sggn_nm=item["lctn_sggn_nm"],
            emd_nm=item["lctn_emd_nm"],
            usg_scls=item["cltr_usg_scls_nm"],
            bld_sqms=item["bld_sqms"],
            cltr_nm=item["onbid_cltr_nm"],
        )

        # 시세 vs 입찰가 비교 추가
        if result.get("status") == "ok" and result.get("summary"):
            est = result["summary"].get("estimated_market_price_won")
            bid = item["lowst_bid_prc"]
            if est and bid:
                result["comparison"] = {
                    "market_vs_bid_pct": round(bid / est * 100, 1),
                    "discount_from_market_pct": round((1 - bid / est) * 100, 1),
                }

        return jsonify(result)
    finally:
        conn.close()


# ─────────────────────────────────────────
# 투자 스코어링
# ─────────────────────────────────────────
LOCATION_PREMIUM = {
    "서울특별시 강남구": 100, "서울특별시 서초구": 100, "서울특별시 송파구": 95,
    "서울특별시 마포구": 90, "서울특별시 영등포구": 90, "서울특별시 용산구": 90,
    "서울특별시 성동구": 85, "서울특별시 광진구": 85, "서울특별시 종로구": 85,
    "서울특별시": 80,
    "경기도 성남시": 85, "경기도 과천시": 85, "경기도 하남시": 80,
    "경기도 수원시": 75, "경기도 용인시": 75, "경기도 화성시": 70,
    "경기도": 65,
    "인천광역시": 60, "부산광역시": 60, "대구광역시": 55, "광주광역시": 55,
    "대전광역시": 55, "울산광역시": 50, "세종특별자치시": 50,
}


def get_location_score(sd_nm: str, sggn_nm: str) -> float:
    specific = f"{sd_nm} {sggn_nm}" if sggn_nm else sd_nm
    if specific in LOCATION_PREMIUM:
        return LOCATION_PREMIUM[specific]
    if sd_nm in LOCATION_PREMIUM:
        return LOCATION_PREMIUM[sd_nm]
    return 30


def compute_scores(items: list, w_ratio=0.4, w_fail=0.3, w_location=0.3) -> list:
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

    return sorted(items, key=lambda x: x["score"], reverse=True)


# ─────────────────────────────────────────
# GET /api/analytics/summary
# 홈페이지 요약 스트립용 집계 데이터
# ─────────────────────────────────────────
@app.route("/api/analytics/summary")
def analytics_summary():
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM BID_ITEMS WHERE status = 'active'"
        ).fetchone()[0]

        by_region = conn.execute("""
            SELECT lctn_sd_nm AS region, COUNT(*) AS count,
                   ROUND(AVG(ratio_pct), 1) AS avg_ratio
            FROM BID_ITEMS WHERE status = 'active' AND lctn_sd_nm IS NOT NULL
            GROUP BY lctn_sd_nm ORDER BY count DESC
        """).fetchall()

        by_usage = conn.execute("""
            SELECT cltr_usg_mcls_nm AS usage_type, COUNT(*) AS count,
                   ROUND(AVG(ratio_pct), 1) AS avg_ratio
            FROM BID_ITEMS WHERE status = 'active' AND cltr_usg_mcls_nm IS NOT NULL
            GROUP BY cltr_usg_mcls_nm ORDER BY count DESC
        """).fetchall()

        ratio_dist = conn.execute("""
            SELECT
                CAST(CAST(ratio_pct / 10 AS INTEGER) * 10 AS TEXT) || '-' ||
                CAST(CAST(ratio_pct / 10 AS INTEGER) * 10 + 10 AS TEXT) || '%' AS bucket,
                COUNT(*) AS count
            FROM BID_ITEMS WHERE status = 'active' AND ratio_pct IS NOT NULL
            GROUP BY CAST(ratio_pct / 10 AS INTEGER)
            ORDER BY CAST(ratio_pct / 10 AS INTEGER)
        """).fetchall()

        top_rows = conn.execute("""
            SELECT cltr_mng_no, onbid_cltr_nm, ratio_pct, usbd_nft,
                   lctn_sd_nm, lctn_sggn_nm
            FROM BID_ITEMS WHERE status = 'active' AND ratio_pct IS NOT NULL
        """).fetchall()
        top_items = compute_scores([dict(r) for r in top_rows])[:5]

        yesterday = (date.today() - timedelta(days=1)).isoformat()
        yesterday_total = conn.execute(
            "SELECT SUM(total_count) FROM DAILY_SNAPSHOT WHERE snapshot_date = ?",
            (yesterday,),
        ).fetchone()[0]

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


# ─────────────────────────────────────────
# GET /api/analytics/trends?period=30d
# 트렌드 차트용 스냅샷 데이터
# ─────────────────────────────────────────
@app.route("/api/analytics/trends")
def analytics_trends():
    period = request.args.get("period", "30d")
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)

    conn = get_db()
    try:
        start_date = (date.today() - timedelta(days=days)).isoformat()

        rows = conn.execute("""
            SELECT snapshot_date, region, usage_type, total_count,
                   avg_ratio_pct, min_ratio_pct, fail_count_avg
            FROM DAILY_SNAPSHOT
            WHERE snapshot_date >= ?
            ORDER BY snapshot_date
        """, (start_date,)).fetchall()

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


# ─────────────────────────────────────────
# GET /api/analytics/scores
# 투자 스코어보드
# ─────────────────────────────────────────
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


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
