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
import sqlite3
import requests
import logging
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

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
# 유틸
# ─────────────────────────────────────────
def to_int(v):
    try:
        return int(float(v)) if v not in (None, "", "null") else None
    except Exception:
        return None

def to_float(v):
    try:
        return float(v) if v not in (None, "", "null") else None
    except Exception:
        return None

def to_str(v):
    return str(v).strip() if v not in (None, "", "null") else None

def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def to_list(v):
    """API 응답 배열 필드를 안전하게 리스트로 변환."""
    if not v:
        return []
    if isinstance(v, dict):
        return [v]
    if isinstance(v, list):
        return v
    return []


# ─────────────────────────────────────────
# DB 초기화
# ─────────────────────────────────────────
def init_bid_db(conn: sqlite3.Connection):
    conn.executescript("""
        -- ── 회차별 입찰정보 ──────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS BID_QUAL (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            cltr_mng_no             TEXT    NOT NULL REFERENCES BID_ITEMS(cltr_mng_no),
            pbct_cdtn_no            INTEGER,                -- 공매조건번호
            proc_anct_nm            TEXT,                   -- 공고명
            bid_seq                 INTEGER,                -- 입찰 회차 번호
            bid_strt_dttm           TEXT,                   -- 입찰 시작 일시
            bid_end_dttm            TEXT,                   -- 입찰 마감 일시
            bid_opnn_dttm           TEXT,                   -- 개찰 일시
            bid_mthd_nm             TEXT,                   -- 입찰 방법명 (온라인/오프라인/혼합)
            bid_particp_cstgr_nm    TEXT,                   -- 입찰 참여 범주명 (개인/법인/기관)
            bid_particp_lmtn_nm     TEXT,                   -- 입찰 참여 제한 조건명
            min_bd_prc              INTEGER,                -- 최소 입찰가 (원)
            bd_prc_dcrmn_amount     INTEGER,                -- 입찰가 감소액 (원, 회차마다 내려가는 금액)
            bid_grnt_prc            INTEGER,                -- 입찰 보증금 (원)
            bid_grnt_dcsn           TEXT,                   -- 보증금 결정 방식 (예: 정가의 10%)
            bid_rsltn_mthd_nm       TEXT,                   -- 낙찰 방법명 (최고가 우선/최저가 우선/복합평가)
            acml_fail_cnt           INTEGER,                -- 유찰 누적 횟수
            prv_bid_hist_rcnt       INTEGER,                -- 이전 입찰 내역 건수
            collb_bid_possbl_yn     TEXT,                   -- 공동입찰 가능여부 (Y/N)
            aprxy_bid_possbl_yn     TEXT,                   -- 대리입찰 가능여부 (Y/N)
            elctrn_grnt_srv_yn      TEXT                    -- 전자보증서 가능여부 (Y/N)
        );
        CREATE INDEX IF NOT EXISTS idx_qual_cltr ON BID_QUAL(cltr_mng_no);

        -- ── 이전 입찰 내역 (BID_QUAL 하위) ──────────────────────────────────────
        CREATE TABLE IF NOT EXISTS BID_HIST (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            bid_qual_id     INTEGER NOT NULL REFERENCES BID_QUAL(id),
            cltr_mng_no     TEXT    NOT NULL,               -- 물건관리번호 (조회 편의용)
            prv_bid_seq     INTEGER,                        -- 이전 입찰 회차
            prv_bid_rslt    TEXT,                           -- 이전 입찰 결과 (유찰/낙찰/취소)
            prv_bid_fail_cnt INTEGER                        -- 해당 회차 실패 횟수
        );
        CREATE INDEX IF NOT EXISTS idx_hist_qual ON BID_HIST(bid_qual_id);
        CREATE INDEX IF NOT EXISTS idx_hist_cltr ON BID_HIST(cltr_mng_no);
    """)

    # BID_ITEMS에 입찰정보 조회 추적 컬럼 추가 (마이그레이션)
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(BID_ITEMS)")}
    if "bid_fetched_at" not in existing_cols:
        conn.execute("ALTER TABLE BID_ITEMS ADD COLUMN bid_fetched_at TEXT")
        log.info("마이그레이션: BID_ITEMS.bid_fetched_at 컬럼 추가")

    conn.commit()
    log.info("입찰정보 DB 초기화 완료")


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
        # 실제 응답 구조: { "result": { "resultCode": "00", "resultMsg": "..." }, ... }
        result_code = data.get("result", {}).get("resultCode", "??")

        if result_code == "03":
            # NODATA_ERROR — 입찰 진행 중이 아닌 물건 (종료/낙찰). 조용히 스킵
            return None
        if result_code != "00":
            log.warning(f"  [{cltr_mng_no}] 응답코드 {result_code}: {data.get('result', {}).get('resultMsg')}")
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

    proc_anct_nm = to_str(data.get("procAnctNm"))   # 공고명 (최상위)
    pbct_cdtn_no = to_int(data.get("pbctCdtnNo"))

    for dtl in to_list(data.get("prvdBidDtls")):
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
        for hist in to_list(dtl.get("prvdBidHists")):
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
    init_bid_db(conn)

    pending = get_pending_items(conn, force=FORCE_REFETCH)
    total   = len(pending)

    if total == 0:
        log.info("입찰정보 조회 대상 물건 없음 (모두 최신 상태)")
        conn.close()
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
    conn.close()

    log.info("=" * 55)
    log.info(f"입찰정보 조회 완료 | 성공: {success}건 / 실패: {fail}건 / 전체: {total}건")


if __name__ == "__main__":
    main()
