import os
import sqlite3
import requests
import logging
from datetime import datetime
from enum import Enum
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


# 알림 종류: 감정가 비율 조건 / 마감 임박 / 수의계약 전환
class AlertType(str, Enum):
    RATIO    = "ratio"     # 감정가 대비 비율 조건 충족
    DEADLINE = "deadline"  # 마감 3일 이내
    PVCT     = "pvct"      # 수의계약 전환


# 알림 발송 결과 상태
class AlertStatus(str, Enum):
    SUCCESS = "success"    # 이메일 발송 성공
    FAIL    = "fail"       # 발송 실패 (네트워크 오류 등)
    SKIP    = "skip"       # 이미 보낸 물건이라 건너뜀

# ─────────────────────────────────────────
# 설정
# ─────────────────────────────────────────
SERVICE_KEY = os.environ["ONBID_API_KEY"]
BASE_URL    = "https://apis.data.go.kr/B010003/OnbidRlstListSrvc/getRlstCltrList"
DB_PATH     = "onbid.db"

NUM_OF_ROWS = 100   # 페이지당 최대 수집 건수
MAX_PAGES   = 1000    # 그룹당 최대 페이지 수 (최대 1,000건)

# 수집 대상 지역 (시도명 기준)
# 서울, 광역시, 특별자치시, 인구 100만 이상 특례시 중심
TARGET_REGIONS = {
    "서울특별시",
    "경기도",
    "인천광역시",
    "부산광역시",
    "대구광역시",
    "광주광역시",
    "대전광역시",
    "울산광역시",
    "세종특별자치시",
}

# 수집할 용도 중분류 / 소분류 조합
# 새 카테고리 추가 시 이 리스트에만 딕셔너리 추가하면 됨
QUERY_GROUPS = [
    {
        "label": "상가용및업무용건물 > 업무시설",
        "cltrUsgMclsCtgrNm": "상가용및업무용건물",
        "cltrUsgSclsCtgrNm": "업무시설",
    },
    {
        "label": "용도복합용건물 > 주/상용건물",
        "cltrUsgMclsCtgrNm": "용도복합용건물",
        "cltrUsgSclsCtgrNm": "주/상용건물",
    },
    {
        "label": "용도복합용건물 > 오피스텔",
        "cltrUsgMclsCtgrNm": "용도복합용건물",
        "cltrUsgSclsCtgrNm": "오피스텔",
    },
]

# 로그: 파일(onbid_collector.log) + 콘솔 동시 출력
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("onbid_collector.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ─────────────────────────────────────────
# DB 초기화
# ─────────────────────────────────────────
def init_db(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS BID_ITEMS (
            cltr_mng_no         TEXT        PRIMARY KEY,   -- 물건관리번호 (고유 식별자)
            pbct_cdtn_no        INTEGER,                   -- 공매조건번호 (상세 API 호출 시 cltr_mng_no와 함께 필수)
            onbid_cltr_nm       TEXT,                      -- 물건명
            prpt_div_nm         TEXT,                      -- 재산유형 (예: 기타일반재산)
            cltr_usg_mcls_nm    TEXT,                      -- 용도 중분류 (예: 상가용및업무용건물)
            cltr_usg_scls_nm    TEXT,                      -- 용도 소분류 (예: 업무시설)
            lctn_sd_nm          TEXT,                      -- 소재지 시도
            lctn_sggn_nm        TEXT,                      -- 소재지 시군구
            lctn_emd_nm         TEXT,                      -- 소재지 읍면동
            land_sqms           REAL,                      -- 토지면적 (㎡)
            bld_sqms            REAL,                      -- 건물면적 (㎡)
            apsl_evl_amt        INTEGER,                   -- 감정평가금액 (원)
            lowst_bid_prc       INTEGER,                   -- 현재 회차 최저입찰가 (원)
            ratio_pct           REAL,                      -- 감정가 대비 최저입찰가 비율 (%)
            frst_ratio_pct      REAL,                      -- 최초 최저입찰가 대비 현재 비율 (%) - 하락폭 파악용
            usbd_nft            INTEGER,                   -- 유찰 횟수
            pbct_nsq            TEXT,                      -- 현재 공매 회차
            pvct_trgt_yn        TEXT,                      -- 수의계약 대상 여부 (Y/N)
            batc_bid_yn         TEXT,                      -- 일괄입찰 여부 (Y: 여러 물건 묶음)
            alc_yn              TEXT,                      -- 지분물건 여부 (Y: 일부 지분만 매각)
            crtn_yn             TEXT,                      -- 정정 이력 여부 (Y: 상세 조회 시 정정내역 확인 권장)
            rqst_org_nm         TEXT,                      -- 공고기관명
            exct_org_nm         TEXT,                      -- 집행기관명
            cltr_bid_bgng_dt    TEXT,                      -- 입찰 시작일시 (YYYY-MM-DD HH:MM)
            cltr_bid_end_dt     TEXT,                      -- 입찰 마감일시 (YYYY-MM-DD HH:MM)
            thnl_img_url        TEXT,                      -- 썸네일 이미지 URL
            status              TEXT        DEFAULT 'active',              -- 물건 상태 (active: 진행중 / closed: 낙찰·취소로 API에서 사라짐)
            is_bookmarked       INTEGER     DEFAULT 0,                     -- 관심목록 등록 여부 (0: 미등록 / 1: 등록). 수집과 무관하게 사용자가 직접 설정
            first_collected_at  TEXT,                                      -- 최초 수집 일시 (INSERT 시에만 기록, 이후 변경 없음)
            collected_at        TEXT        DEFAULT (datetime('now', 'localtime'))  -- 마지막 수집 일시 (매 수집마다 갱신)
        );

        -- 대시보드 필터 쿼리 성능을 위한 인덱스
        CREATE INDEX IF NOT EXISTS idx_ratio     ON BID_ITEMS (ratio_pct);       -- 감정가 비율 필터
        CREATE INDEX IF NOT EXISTS idx_end_dt    ON BID_ITEMS (cltr_bid_end_dt); -- 마감일 정렬/필터
        CREATE INDEX IF NOT EXISTS idx_region    ON BID_ITEMS (lctn_sd_nm, lctn_sggn_nm); -- 지역 필터
        CREATE INDEX IF NOT EXISTS idx_usbd      ON BID_ITEMS (usbd_nft);        -- 유찰 횟수 필터

        -- 수집 실행 이력 (그룹별 성공/실패, 신규/변경 건수 기록)
        CREATE TABLE IF NOT EXISTS COLLECTION_LOG (
            id              INTEGER     PRIMARY KEY AUTOINCREMENT,
            run_at          TEXT        DEFAULT (datetime('now', 'localtime')),
            query_label     TEXT,       -- 수집 그룹 레이블
            total_count     INTEGER,    -- 수집된 전체 건수
            new_count       INTEGER,    -- 신규 저장 건수
            updated_count   INTEGER,    -- 기존 업데이트 건수
            status          TEXT,       -- 'success' / 'fail'
            error_msg       TEXT        -- 실패 시 오류 메시지
        );

        -- 알림 발송 이력 (중복 발송 방지 및 발송 상태 추적)
        CREATE TABLE IF NOT EXISTS ALERT_LOG (
            id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
            cltr_mng_no         TEXT        REFERENCES BID_ITEMS(cltr_mng_no),
            triggered_ratio     REAL,       -- 알림을 트리거한 시점의 비율값
            alert_type          TEXT,       -- AlertType: ratio / deadline / pvct
            sent_at             TEXT        DEFAULT (datetime('now', 'localtime')),
            status              TEXT        -- AlertStatus: success / fail / skip
        );
    """)

    # 기존 DB 마이그레이션: 신규 컬럼이 없으면 추가 (스키마 변경 시 DB 재생성 없이 적용)
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(BID_ITEMS)")}
    if "status" not in existing_cols:
        conn.execute("ALTER TABLE BID_ITEMS ADD COLUMN status TEXT DEFAULT 'active'")
        log.info("마이그레이션: status 컬럼 추가")
    if "first_collected_at" not in existing_cols:
        conn.execute("ALTER TABLE BID_ITEMS ADD COLUMN first_collected_at TEXT")
        log.info("마이그레이션: first_collected_at 컬럼 추가")
    if "is_bookmarked" not in existing_cols:
        conn.execute("ALTER TABLE BID_ITEMS ADD COLUMN is_bookmarked INTEGER DEFAULT 0")
        log.info("마이그레이션: is_bookmarked 컬럼 추가")

    conn.commit()
    log.info("DB 초기화 완료")


# ─────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────
def format_dt(dt_str: str) -> str:
    """표시용 날짜 포맷 변환. 날짜 없거나 9999년이면 '미정' 반환."""
    if not dt_str or dt_str[:4] >= "2999":
        return "미정"
    try:
        return f"{dt_str[0:4]}-{dt_str[4:6]}-{dt_str[6:8]} {dt_str[8:10]}:{dt_str[10:12]}"
    except Exception:
        return "미정"


def parse_dt(dt_str: str) -> str | None:
    """DB 저장용 날짜 포맷 변환. SQLite 정렬·비교 가능한 ISO 형식으로 변환. 날짜 없으면 None."""
    if not dt_str or dt_str[:4] >= "2999":
        return None
    try:
        return f"{dt_str[0:4]}-{dt_str[4:6]}-{dt_str[6:8]} {dt_str[8:10]}:{dt_str[10:12]}"
    except Exception:
        return None


def calc_ratio(item: dict) -> float | None:
    """감정가 대비 최저입찰가 비율(%) 계산.
    API가 apslPrcCtrsLowstBidRto를 직접 제공하면 그 값을 사용하고,
    없으면 apslEvlAmt / lowstBidPrcIndctCont로 직접 계산.
    """
    ratio = item.get("apslPrcCtrsLowstBidRto")
    if ratio is not None:
        try:
            return round(float(ratio), 2)
        except Exception:
            pass
    try:
        apsl = float(item.get("apslEvlAmt") or 0)
        lowst = float(item.get("lowstBidPrcIndctCont") or 0)
        if apsl > 0 and lowst > 0:
            return round(lowst / apsl * 100, 2)
    except Exception:
        pass
    return None


def to_int(value) -> int | None:
    """API 문자열 값을 int로 변환. 변환 불가 시 None."""
    try:
        return int(float(value)) if value else None
    except Exception:
        return None


def to_float(value) -> float | None:
    """API 문자열 값을 float으로 변환. 변환 불가 시 None."""
    try:
        return float(value) if value else None
    except Exception:
        return None


# ─────────────────────────────────────────
# API 호출
# ─────────────────────────────────────────
def fetch_pages(mclass: str, sclass: str, label: str) -> list[dict]:
    """온비드 공매물건 목록 API를 페이지 단위로 호출해 전체 결과를 반환.
    totalCount에 도달하거나 MAX_PAGES에 도달하면 중단.
    """
    items = []
    for page_no in range(1, MAX_PAGES + 1):
        url = (
            f"{BASE_URL}"
            f"?serviceKey={SERVICE_KEY}"                           # 인증키
            f"&pageNo={page_no}"                                   # 페이지 번호
            f"&numOfRows={NUM_OF_ROWS}"                            # 페이지당 건수
            "&resultType=json"                                     # 응답 형식
            "&prptDivCd=0007,0010,0005,0002,0003,0006,0008,0011"   # 재산종류 코드 (다중)
            "&dspsMthodCd=0001"                                    # 매각만
            "&bidDivCd=0001"                                       # 인터넷 입찰만
            "&cltrUsgLclsCtgrNm=부동산"                              # 부동산만
            f"&cltrUsgMclsCtgrNm={mclass}"                         # 용도 중분류
            f"&cltrUsgSclsCtgrNm={sclass}"                         # 용도 소분류
            "&bldSqmsStart=30"                                     # 건물면적 최소 (㎡)
            "&bldSqmsEnd=200"                                      # 건물면적 최대 (㎡)
        )
        try:
            res = requests.get(url, timeout=10)
            data = res.json()
        except Exception as e:
            log.error(f"[{label}] 페이지 {page_no} 요청 실패: {e}")
            break

        if "body" not in data:
            log.error(f"[{label}] 응답 구조 오류: {data}")
            break

        total_count = data["body"].get("totalCount", 0)
        raw_items   = data["body"].get("items") or {}
        page_items  = raw_items.get("item", [])

        # API가 단건일 때 dict로 반환하는 경우 리스트로 통일
        if isinstance(page_items, dict):
            page_items = [page_items]
        if not page_items:
            break

        items.extend(page_items)
        log.info(f"  [{label}] 페이지 {page_no} → {len(page_items)}건 (누적 {len(items)}/{total_count})")

        # 전체 건수 도달 시 조기 종료
        if len(items) >= total_count:
            break

    return items


# ─────────────────────────────────────────
# DB 저장 (UPSERT)
# ─────────────────────────────────────────
def upsert_items(conn: sqlite3.Connection, items: list[dict]) -> tuple[int, int, set]:
    """수집된 물건 목록을 DB에 저장.
    - 신규 물건: INSERT (first_collected_at, collected_at 모두 현재 시각)
    - 기존 물건: UPDATE (collected_at만 갱신, first_collected_at은 유지)
    - 반환: (신규 건수, 업데이트 건수, 수집된 물건번호 셋)
    """
    new_count     = 0
    updated_count = 0
    collected_ids = set()  # 이번 수집에서 확인된 물건번호 (mark_closed에서 사용)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for item in items:
        cltr_mng_no = item.get("cltrMngNo")
        if not cltr_mng_no:
            continue

        # 대상 지역 외 물건 제외
        if item.get("lctnSdnm") not in TARGET_REGIONS:
            continue

        collected_ids.add(cltr_mng_no)

        # 기존 레코드 존재 여부 확인 (INSERT vs UPDATE 분기)
        existing = conn.execute(
            "SELECT cltr_mng_no FROM BID_ITEMS WHERE cltr_mng_no = ?",
            (cltr_mng_no,)
        ).fetchone()

        # API 필드명 → DB 컬럼명 매핑 및 타입 변환
        fields = {
            "pbct_cdtn_no":     to_int(item.get("pbctCdtnNo")),
            "onbid_cltr_nm":    item.get("onbidCltrNm"),
            "prpt_div_nm":      item.get("prptDivNm"),
            "cltr_usg_mcls_nm": item.get("cltrUsgMclsCtgrNm"),
            "cltr_usg_scls_nm": item.get("cltrUsgSclsCtgrNm"),
            "lctn_sd_nm":       item.get("lctnSdnm"),
            "lctn_sggn_nm":     item.get("lctnSggnm"),
            "lctn_emd_nm":      item.get("lctnEmdNm"),
            "land_sqms":        to_float(item.get("landSqms")),
            "bld_sqms":         to_float(item.get("bldSqms")),
            "apsl_evl_amt":     to_int(item.get("apslEvlAmt")),
            "lowst_bid_prc":    to_int(item.get("lowstBidPrcIndctCont")),
            "ratio_pct":        calc_ratio(item),
            "frst_ratio_pct":   to_float(item.get("frstCtrsLowstBidPrcRto")),
            "usbd_nft":         to_int(item.get("usbdNft")),
            "pbct_nsq":         item.get("pbctNsq"),
            "pvct_trgt_yn":     item.get("pvctTrgtYn"),
            "batc_bid_yn":      item.get("batcBidYn"),
            "alc_yn":           item.get("alcYn"),
            "crtn_yn":          item.get("crtnYn"),
            "rqst_org_nm":      item.get("rqstOrgNm"),
            "exct_org_nm":      item.get("exctOrgNm"),
            "cltr_bid_bgng_dt": parse_dt(item.get("cltrBidBgngDt")),
            "cltr_bid_end_dt":  parse_dt(item.get("cltrBidEndDt")),
            "thnl_img_url":     item.get("thnlImgUrlAdr"),
        }

        if not existing:
            # 신규 물건: first_collected_at과 collected_at 모두 현재 시각으로 세팅
            conn.execute("""
                INSERT INTO BID_ITEMS (
                    cltr_mng_no, pbct_cdtn_no, onbid_cltr_nm, prpt_div_nm,
                    cltr_usg_mcls_nm, cltr_usg_scls_nm,
                    lctn_sd_nm, lctn_sggn_nm, lctn_emd_nm,
                    land_sqms, bld_sqms,
                    apsl_evl_amt, lowst_bid_prc, ratio_pct, frst_ratio_pct,
                    usbd_nft, pbct_nsq,
                    pvct_trgt_yn, batc_bid_yn, alc_yn, crtn_yn,
                    rqst_org_nm, exct_org_nm,
                    cltr_bid_bgng_dt, cltr_bid_end_dt,
                    thnl_img_url, first_collected_at, collected_at
                ) VALUES (
                    :cltr_mng_no, :pbct_cdtn_no, :onbid_cltr_nm, :prpt_div_nm,
                    :cltr_usg_mcls_nm, :cltr_usg_scls_nm,
                    :lctn_sd_nm, :lctn_sggn_nm, :lctn_emd_nm,
                    :land_sqms, :bld_sqms,
                    :apsl_evl_amt, :lowst_bid_prc, :ratio_pct, :frst_ratio_pct,
                    :usbd_nft, :pbct_nsq,
                    :pvct_trgt_yn, :batc_bid_yn, :alc_yn, :crtn_yn,
                    :rqst_org_nm, :exct_org_nm,
                    :cltr_bid_bgng_dt, :cltr_bid_end_dt,
                    :thnl_img_url, :now, :now
                )
            """, {**fields, "cltr_mng_no": cltr_mng_no, "now": now})
            new_count += 1
        else:
            # 기존 물건: 최신 정보로 업데이트. first_collected_at은 건드리지 않음
            conn.execute("""
                UPDATE BID_ITEMS SET
                    pbct_cdtn_no=:pbct_cdtn_no, onbid_cltr_nm=:onbid_cltr_nm, prpt_div_nm=:prpt_div_nm,
                    cltr_usg_mcls_nm=:cltr_usg_mcls_nm, cltr_usg_scls_nm=:cltr_usg_scls_nm,
                    lctn_sd_nm=:lctn_sd_nm, lctn_sggn_nm=:lctn_sggn_nm, lctn_emd_nm=:lctn_emd_nm,
                    land_sqms=:land_sqms, bld_sqms=:bld_sqms,
                    apsl_evl_amt=:apsl_evl_amt, lowst_bid_prc=:lowst_bid_prc,
                    ratio_pct=:ratio_pct, frst_ratio_pct=:frst_ratio_pct,
                    usbd_nft=:usbd_nft, pbct_nsq=:pbct_nsq,
                    pvct_trgt_yn=:pvct_trgt_yn, batc_bid_yn=:batc_bid_yn,
                    alc_yn=:alc_yn, crtn_yn=:crtn_yn,
                    rqst_org_nm=:rqst_org_nm, exct_org_nm=:exct_org_nm,
                    cltr_bid_bgng_dt=:cltr_bid_bgng_dt, cltr_bid_end_dt=:cltr_bid_end_dt,
                    thnl_img_url=:thnl_img_url, collected_at=:collected_at
                WHERE cltr_mng_no=:cltr_mng_no
            """, {**fields, "cltr_mng_no": cltr_mng_no, "collected_at": now})
            updated_count += 1

    conn.commit()
    return new_count, updated_count, collected_ids


# ─────────────────────────────────────────
# 수집 로그 저장
# ─────────────────────────────────────────
def save_log(
    conn: sqlite3.Connection,
    label: str,
    total: int,
    new: int,
    updated: int,
    status: str,
    error_msg: str = None,
):
    """그룹별 수집 결과를 COLLECTION_LOG에 기록."""
    conn.execute("""
        INSERT INTO COLLECTION_LOG (query_label, total_count, new_count, updated_count, status, error_msg)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (label, total, new, updated, status, error_msg))
    conn.commit()


# ─────────────────────────────────────────
# 온비드 상세페이지 URL 조합
# ─────────────────────────────────────────
def get_onbid_url(cltr_mng_no: str) -> str:
    """물건관리번호로 온비드 상세 페이지 URL 생성. DB에 저장하지 않고 조회 시 동적으로 생성."""
    return (
        f"https://www.onbid.co.kr/op/cta/cltrdtl/retrieveCltrDetail.do"
        f"?cltrMngNo={cltr_mng_no}"
    )


# ─────────────────────────────────────────
# 조회 헬퍼 (대시보드에서 활용)
# ─────────────────────────────────────────
def query_items(
    conn: sqlite3.Connection,
    ratio_max: float = 100.0,   # 감정가 대비 비율 상한 (%)
    usbd_min: int = 0,          # 최소 유찰 횟수
    sd_nm: str = None,          # 시도명 필터 (None이면 전체)
    limit: int = 100,
) -> list[dict]:
    """대시보드용 물건 조회. active 상태인 물건만 반환.
    is_new는 오늘 날짜와 collected_at을 비교해 계산 (별도 컬럼 없음).
    """
    sql = """
        SELECT
            cltr_mng_no, onbid_cltr_nm,
            lctn_sd_nm, lctn_sggn_nm, lctn_emd_nm,
            apsl_evl_amt, lowst_bid_prc, ratio_pct,
            usbd_nft, pbct_nsq,
            pvct_trgt_yn, batc_bid_yn, alc_yn,
            cltr_bid_end_dt, thnl_img_url, pbct_cdtn_no,
            (DATE(collected_at) = DATE('now', 'localtime')) AS is_new  -- 오늘 수집된 신규 물건 여부
        FROM BID_ITEMS
        WHERE status    = 'active'   -- 낙찰/취소된 물건 제외
          AND ratio_pct <= ?
          AND usbd_nft  >= ?
    """
    params = [ratio_max, usbd_min]

    if sd_nm:
        sql += " AND lctn_sd_nm = ?"
        params.append(sd_nm)

    sql += " ORDER BY ratio_pct ASC LIMIT ?"
    params.append(limit)

    cursor = conn.execute(sql, params)
    cols = [d[0] for d in cursor.description]
    rows = [dict(zip(cols, row)) for row in cursor.fetchall()]

    # 온비드 URL 동적 조합 (DB 저장 없이 런타임 생성)
    for row in rows:
        row["onbid_url"] = get_onbid_url(row["cltr_mng_no"])

    return rows


# ─────────────────────────────────────────
# 종료 물건 감지
# ─────────────────────────────────────────
def mark_closed(conn: sqlite3.Connection, collected_ids: set) -> int:
    """이번 수집에 나타나지 않은 active 물건을 closed로 마킹.
    낙찰되거나 취소된 물건은 API 응답에서 빠지므로 collected_ids에 없으면 종료로 간주.
    물건 자체는 삭제하지 않고 status만 변경해 이력 보존.
    """
    if not collected_ids:
        return 0
    placeholders = ",".join("?" * len(collected_ids))
    cursor = conn.execute(
        f"UPDATE BID_ITEMS SET status='closed' WHERE status='active' AND cltr_mng_no NOT IN ({placeholders})",
        list(collected_ids),
    )
    conn.commit()
    return cursor.rowcount


# ─────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────
def main():
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    all_collected_ids: set = set()  # 전체 그룹에서 수집된 물건번호 합산

    for group in QUERY_GROUPS:
        label  = group["label"]
        mclass = group["cltrUsgMclsCtgrNm"]
        sclass = group["cltrUsgSclsCtgrNm"]

        log.info(f"{'='*50}")
        log.info(f"[{label}] 수집 시작")

        try:
            items = fetch_pages(mclass, sclass, label)
            new_cnt, upd_cnt, ids = upsert_items(conn, items)
            all_collected_ids |= ids  # 그룹별 수집 ID를 전체 셋에 합산
            save_log(conn, label, len(items), new_cnt, upd_cnt, "success")
            log.info(f"[{label}] 완료 → 전체 {len(items)}건 / 신규 {new_cnt}건 / 변경 {upd_cnt}건")

        except Exception as e:
            save_log(conn, label, 0, 0, 0, "fail", str(e))
            log.error(f"[{label}] 실패: {e}")

    # 모든 그룹 수집 완료 후 사라진 물건 closed 처리
    closed_cnt = mark_closed(conn, all_collected_ids)
    if closed_cnt:
        log.info(f"[종료 감지] {closed_cnt}건 → status=closed (낙찰/취소 추정)")

    # 수집 결과 확인 (감정가 대비 75% 이하, 유찰 1회 이상)
    log.info("\n[결과 미리보기 - 감정가 75% 이하 / 유찰 1회 이상]")
    results = query_items(conn, ratio_max=75.0, usbd_min=1, limit=10)
    for r in results:
        log.info(
            f"  {r['cltr_mng_no']} | {r['lctn_sd_nm']} {r['lctn_sggn_nm']} | "
            f"감정가비율 {r['ratio_pct']}% | 유찰 {r['usbd_nft']}회 | "
            f"{'[신규]' if r['is_new'] else ''} "
            f"URL: {r['onbid_url']}"
        )

    conn.close()
    log.info("수집 완료")


if __name__ == "__main__":
    main()
