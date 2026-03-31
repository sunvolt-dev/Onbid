"""
onbid_bid_collector.py
─────────────────────────────────────────────────────────────────────────────
BID_ITEMS(물건목록)에서 cltrMngNo + pbctCdtnNo 를 읽어
온비드 물건상세 입찰정보 조회 API(getCltrBidInf)를 호출하고
응답을 2개 서브 테이블에 저장한다.

[서브 테이블]
  BID_QUAL  - 회차별 입찰정보  (1:N)
  BID_HIST  - 이전 입찰 내역   (1:N, BID_QUAL 하위)

[실행 전략]
  - BID_ITEMS.bid_fetched_at IS NULL → 한 번도 입찰정보 조회 안 한 물건 우선
  - status = 'active' 인 물건만 대상
  - API 초당 10 tps 제한 → 호출마다 0.15초 대기
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import sqlite3
import requests
import logging
import time
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# 프로젝트 루트를 sys.path에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils import to_int, to_float, to_str, now_str, to_list
from db.schema_bid import init_bid_db

# ─────────────────────────────────────────
# 설정
# ─────────────────────────────────────────
SERVICE_KEY = os.environ["ONBID_API_KEY"]
BID_URL     = "https://apis.data.go.kr/B010003/OnbidCltrBidDtlSrvc/getCltrBidInf"
DB_PATH     = "onbid.db"

SLEEP_SEC     = 0.15   # API 10 tps 제한 → 호출 간 대기(초)
BATCH_SIZE    = 50     # 중간 커밋 단위
FORCE_REFETCH = False  # True이면 이미 조회한 물건도 재조회

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("onbid_bid.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────
# API 호출
# ─────────────────────────────────────────
def fetch_bid(cltr_mng_no: str, pbct_cdtn_no) -> dict | None:
    """입찰정보 조회 API 호출. 성공 시 응답 dict 반환, 실패 시 None.

    serviceKey는 이미 URL 인코딩된 값이므로 URL에 직접 포함.
    나머지 파라미터는 requests가 안전하게 인코딩하도록 params 딕셔너리 사용.
    """
    base = f"{BID_URL}?serviceKey={SERVICE_KEY}"

    params = {
        "resultType": "json",
        "numOfRows":  10,   # 회차가 여러 개일 수 있으므로 넉넉하게
        "pageNo":     1,
        "cltrMngNo":  cltr_mng_no,
    }
    if pbct_cdtn_no:
        params["pbctCdtnNo"] = pbct_cdtn_no

    try:
        res = requests.get(base, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        log.error(f"  [{cltr_mng_no}] API 요청 실패: {e}")
        return None

    try:
        # 응답 구조가 두 가지:
        #   구형: { "result": { "resultCode": "00" }, ... }
        #   신형: { "header": { "resultCode": "00" }, "body": { "items": ... } }
        result_code = (
            data.get("result", {}).get("resultCode")
            or data.get("header", {}).get("resultCode")
            or "??"
        )

        if result_code == "03":
            # NODATA_ERROR — 입찰 진행 중이 아닌 물건 (종료/낙찰). 조용히 스킵
            return None
        if result_code != "00":
            log.warning(f"  [{cltr_mng_no}] 응답코드 {result_code}")
            return None

        return data

    except Exception as e:
        log.error(f"  [{cltr_mng_no}] 응답 파싱 실패: {e}")
        return None


# ─────────────────────────────────────────
# 서브 테이블 저장
# ─────────────────────────────────────────
def _clear_sub_tables(conn: sqlite3.Connection, cltr_mng_no: str):
    """재조회 전 기존 데이터 삭제."""
    # BID_HIST는 BID_QUAL의 id를 참조하므로 BID_QUAL 먼저 조회 후 삭제
    qual_ids = [
        row[0] for row in conn.execute(
            "SELECT id FROM BID_QUAL WHERE cltr_mng_no = ?", (cltr_mng_no,)
        ).fetchall()
    ]
    if qual_ids:
        placeholders = ",".join("?" * len(qual_ids))
        conn.execute(f"DELETE FROM BID_HIST WHERE bid_qual_id IN ({placeholders})", qual_ids)
    conn.execute("DELETE FROM BID_QUAL WHERE cltr_mng_no = ?", (cltr_mng_no,))


def save_bid(conn: sqlite3.Connection, cltr_mng_no: str, data: dict):
    """API 응답을 BID_QUAL + BID_HIST에 저장.

    흐름:
      1. 기존 데이터 삭제 (재조회 시 중복 방지)
      2. 최상위 공고명 파싱
      3. prvdBidDtls 배열 → BID_QUAL INSERT
      4. 각 회차의 prvdBidHists → BID_HIST INSERT
      5. BID_ITEMS.bid_fetched_at 갱신
    """
    _clear_sub_tables(conn, cltr_mng_no)

    # 응답 구조 분기: 구형(prvdBidDtls) vs 신형(body.items.item)
    raw = data
    if "body" in data:
        items_raw = (data.get("body") or {}).get("items", {}).get("item")
        if items_raw:
            raw = to_list(items_raw)[0] if isinstance(items_raw, list) else items_raw

    dtls = raw.get("prvdBidDtls")
    proc_anct_nm = to_str(raw.get("procAnctNm") or raw.get("onbidPbancNm"))
    pbct_cdtn_no = to_int(raw.get("pbctCdtnNo"))

    # 신형 구조: cseqBidInfClgList(회차별 입찰정보)를 prvdBidDtls 형식으로 변환
    if not dtls and raw.get("cseqBidInfClgList"):
        dtls = []
        for seq in to_list(raw.get("cseqBidInfClgList")):
            dtls.append({
                "bidSeq":              seq.get("pbctNsq"),
                "bidStrtDttm":         seq.get("cltrBidBgngDt"),
                "bidEndDttm":          seq.get("cltrBidEndDt"),
                "bidOpnnDttm":         seq.get("cltrOpbdDt"),
                "bidMthdNm":           seq.get("bidDivNm"),
                "minBdPrc":            seq.get("lowstBidPrcIndctCont"),
                "acmlFailCnt":         raw.get("usbdNft"),
            })
        # prcnBidClgList를 BID_HIST로 매핑
        prcn_list = to_list(raw.get("prcnBidClgList"))

    dtls = to_list(dtls)

    for dtl in dtls:
        # BID_QUAL INSERT
        cursor = conn.execute("""
            INSERT INTO BID_QUAL (
                cltr_mng_no, pbct_cdtn_no, proc_anct_nm,
                bid_seq, bid_strt_dttm, bid_end_dttm, bid_opnn_dttm,
                bid_mthd_nm, bid_particp_cstgr_nm, bid_particp_lmtn_nm,
                min_bd_prc, bd_prc_dcrmn_amount,
                bid_grnt_prc, bid_grnt_dcsn, bid_rsltn_mthd_nm,
                acml_fail_cnt, prv_bid_hist_rcnt,
                collb_bid_possbl_yn, aprxy_bid_possbl_yn, elctrn_grnt_srv_yn
            ) VALUES (
                :cltr_mng_no, :pbct_cdtn_no, :proc_anct_nm,
                :bid_seq, :bid_strt_dttm, :bid_end_dttm, :bid_opnn_dttm,
                :bid_mthd_nm, :bid_particp_cstgr_nm, :bid_particp_lmtn_nm,
                :min_bd_prc, :bd_prc_dcrmn_amount,
                :bid_grnt_prc, :bid_grnt_dcsn, :bid_rsltn_mthd_nm,
                :acml_fail_cnt, :prv_bid_hist_rcnt,
                :collb_bid_possbl_yn, :aprxy_bid_possbl_yn, :elctrn_grnt_srv_yn
            )
        """, {
            "cltr_mng_no":          cltr_mng_no,
            "pbct_cdtn_no":         pbct_cdtn_no,
            "proc_anct_nm":         proc_anct_nm,
            "bid_seq":              to_int(dtl.get("bidSeq")),
            "bid_strt_dttm":        to_str(dtl.get("bidStrtDttm")),
            "bid_end_dttm":         to_str(dtl.get("bidEndDttm")),
            "bid_opnn_dttm":        to_str(dtl.get("bidOpnnDttm")),
            "bid_mthd_nm":          to_str(dtl.get("bidMthdNm")),
            "bid_particp_cstgr_nm": to_str(dtl.get("bidParticpCstgrNm")),
            "bid_particp_lmtn_nm":  to_str(dtl.get("bidParticpLmtnCdtnNm")),
            "min_bd_prc":           to_int(dtl.get("minBdPrc")),
            "bd_prc_dcrmn_amount":  to_int(dtl.get("bdPrcDcrmnAmount")),
            "bid_grnt_prc":         to_int(dtl.get("bidGrntPrc")),
            "bid_grnt_dcsn":        to_str(dtl.get("bidGrntDcsn")),
            "bid_rsltn_mthd_nm":    to_str(dtl.get("bidRsltnMthdNm")),
            "acml_fail_cnt":        to_int(dtl.get("acmlFailCnt")),
            "prv_bid_hist_rcnt":    to_int(dtl.get("prvBidHistRcnt")),
            "collb_bid_possbl_yn":  to_str(dtl.get("collbBidPossblYn")),
            "aprxy_bid_possbl_yn":  to_str(dtl.get("aprxyBidPossblYn")),
            "elctrn_grnt_srv_yn":   to_str(dtl.get("elctrnGrntSrvYn")),
        })
        bid_qual_id = cursor.lastrowid  # 방금 INSERT된 BID_QUAL.id

        # BID_HIST INSERT (이전 입찰 내역)
        # 구형: prvdBidHists / 신형: prcnBidClgList (최초 1회만)
        hist_items = to_list(dtl.get("prvdBidHists"))

        for hist in hist_items:
            conn.execute("""
                INSERT INTO BID_HIST
                    (bid_qual_id, cltr_mng_no, prv_bid_seq, prv_bid_rslt, prv_bid_fail_cnt)
                VALUES (?, ?, ?, ?, ?)
            """, (
                bid_qual_id,
                cltr_mng_no,
                to_int(hist.get("prvBidSeq")),
                to_str(hist.get("prvBidRslt")),
                to_int(hist.get("prvBidFailCnt")),
            ))

    # 신형 prcnBidClgList → BID_HIST (첫 번째 BID_QUAL에 연결)
    if not raw.get("prvdBidDtls") and raw.get("prcnBidClgList"):
        first_qual = conn.execute(
            "SELECT id FROM BID_QUAL WHERE cltr_mng_no = ? ORDER BY bid_seq ASC LIMIT 1",
            (cltr_mng_no,),
        ).fetchone()
        if first_qual:
            fq_id = first_qual[0]
            for prcn in to_list(raw.get("prcnBidClgList")):
                conn.execute("""
                    INSERT INTO BID_HIST
                        (bid_qual_id, cltr_mng_no, prv_bid_seq, prv_bid_rslt, prv_bid_fail_cnt)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    fq_id,
                    cltr_mng_no,
                    to_int(prcn.get("pbctNsq")),
                    to_str(prcn.get("pbctStatNm")),
                    None,
                ))

    # 입찰정보 조회 완료 시각 기록
    conn.execute(
        "UPDATE BID_ITEMS SET bid_fetched_at = ? WHERE cltr_mng_no = ?",
        (now_str(), cltr_mng_no),
    )
    conn.commit()


# ─────────────────────────────────────────
# 조회 대상 물건 목록
# ─────────────────────────────────────────
def get_pending_items(conn: sqlite3.Connection, force: bool = False) -> list[tuple]:
    """입찰정보 조회가 필요한 물건 목록 반환.

    조건:
      - status = 'active'
      - force=False: bid_fetched_at IS NULL (미조회) 만
      - force=True:  전체 active 물건 재조회
    """
    if force:
        sql = """
            SELECT cltr_mng_no, pbct_cdtn_no
            FROM BID_ITEMS
            WHERE status = 'active'
              AND cltr_bid_bgng_dt <= datetime('now', 'localtime')
            ORDER BY ratio_pct ASC
        """
    else:
        sql = """
            SELECT cltr_mng_no, pbct_cdtn_no
            FROM BID_ITEMS
            WHERE status = 'active'
              AND bid_fetched_at IS NULL
              AND cltr_bid_bgng_dt <= datetime('now', 'localtime')
            ORDER BY ratio_pct ASC
        """
    return conn.execute(sql).fetchall()


# ─────────────────────────────────────────
# 메인
# ─────────────────────────────────────────
def main():
    conn = sqlite3.connect(DB_PATH)
    try:
        init_bid_db(conn)

        pending = get_pending_items(conn, force=FORCE_REFETCH)
        total   = len(pending)

        if total == 0:
            log.info("입찰정보 조회 대상 물건 없음 (모두 최신 상태)")
            return

        log.info(f"입찰정보 조회 대상: {total}건 시작")
        log.info("=" * 55)

        success = 0
        fail    = 0

        for idx, (cltr_mng_no, pbct_cdtn_no) in enumerate(pending, 1):
            log.info(f"[{idx}/{total}] {cltr_mng_no} (공매조건번호={pbct_cdtn_no})")

            data = fetch_bid(cltr_mng_no, pbct_cdtn_no)

            if data:
                save_bid(conn, cltr_mng_no, data)

                qual_cnt = conn.execute(
                    "SELECT COUNT(*) FROM BID_QUAL WHERE cltr_mng_no=?", (cltr_mng_no,)
                ).fetchone()[0]
                hist_cnt = conn.execute(
                    "SELECT COUNT(*) FROM BID_HIST WHERE cltr_mng_no=?", (cltr_mng_no,)
                ).fetchone()[0]

                log.info(f"  → 저장 완료 | 입찰회차:{qual_cnt} 이전입찰내역:{hist_cnt}")
                success += 1
            else:
                # NODATA 포함 실패 물건도 bid_fetched_at 기록 → 다음 실행 시 재시도 방지
                conn.execute(
                    "UPDATE BID_ITEMS SET bid_fetched_at = ? WHERE cltr_mng_no = ?",
                    (now_str(), cltr_mng_no),
                )
                conn.commit()
                fail += 1

            time.sleep(SLEEP_SEC)

            if idx % BATCH_SIZE == 0:
                conn.commit()
                log.info(f"  ── 중간 저장 ({idx}/{total}건 처리됨) ──")

        conn.commit()

        log.info("=" * 55)
        log.info(f"입찰정보 조회 완료 | 성공: {success}건 / 실패: {fail}건 / 전체: {total}건")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
