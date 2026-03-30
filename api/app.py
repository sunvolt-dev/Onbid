import os
import sqlite3
from flask import Flask, jsonify, request, abort
from flask_cors import CORS

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
    ratio_max  = request.args.get("ratio_max",  type=float)
    usbd_min   = request.args.get("usbd_min",   type=int)
    sd_nm      = request.args.get("sd_nm",      type=str)
    bookmarked = request.args.get("bookmarked", type=int)
    pvct       = request.args.get("pvct",       type=str)
    usg_mcls   = request.args.get("usg_mcls",   type=str)
    usg_scls   = request.args.get("usg_scls",   type=str)
    limit      = request.args.get("limit",      type=int, default=100)

    conditions = ["status = 'active'"]
    params = []

    if ratio_max is not None:
        conditions.append("ratio_pct <= ?")
        params.append(ratio_max)
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
    finally:
        conn.close()

    return jsonify({
        "total":      total,
        "bookmarked": bookmarked,
        "pvct_count": pvct_count,
        "ratio_avg":  round(ratio_row[0], 1) if ratio_row[0] else None,
        "ratio_min":  ratio_row[1],
        "by_region":  [dict(r) for r in by_region],
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
            "SELECT * FROM BID_QUAL WHERE cltr_mng_no = ? ORDER BY pbct_nsq ASC",
            (item_id,),
        ).fetchall()

        result = []
        for q in quals:
            hists = conn.execute(
                "SELECT * FROM BID_HIST WHERE cltr_mng_no = ? AND pbct_nsq = ?",
                (item_id, q["pbct_nsq"]),
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



if __name__ == "__main__":
    app.run(debug=True, port=8000)
