"""
molit_fetcher.py
─────────────────────────────────────────────────────────────────────────────
국토교통부 실거래가 API를 호출하고 캐싱하여,
온비드 물건과 유사한 거래를 매칭해 시세를 추정한다.

[지원 API]
  - 오피스텔 매매: RTMSDataSvcOffiTrade
  - 상업업무용 매매: RTMSDataSvcNrgTrade

[매칭 알고리즘 — 3단계 폴백]
  Tier 1: 같은 읍면동 + 같은 건물명 + 면적 ±30%
  Tier 2: 같은 읍면동 + 면적 ±30%
  Tier 3: 같은 시군구 + 면적 ±30%

[캐시 전략]
  MOLIT_FETCH_LOG에 (lawd_cd, deal_ymd, api_type) 단위로 조회 여부 기록.
  30일 이상 지난 로그는 재조회 (실거래 신고 기한 = 30일).
─────────────────────────────────────────────────────────────────────────────
"""

import os
import re
import sys
import sqlite3
import requests
import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lawd_code import get_lawd_cd
from db.schema_molit import init_molit_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────
# 설정
# ─────────────────────────────────────────
SERVICE_KEY = os.environ.get("ONBID_API_KEY", "")

API_URLS = {
    "officetel":  "https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade",
    "commercial": "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade",
    "apartment":  "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
    "rowhouse":   "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    "detached":   "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade",
}

# 온비드 용도소분류 → 우선 조회할 API 타입 (가능성 높은 순)
USG_TO_PRIMARY = {
    "오피스텔":     ["officetel", "commercial"],
    "업무시설":     ["commercial", "officetel"],
    "주/상용건물":  ["commercial", "rowhouse"],
}

ALL_API_TYPES = ["officetel", "commercial", "apartment", "rowhouse", "detached"]

DB_PATH = os.path.join(os.path.dirname(__file__), "onbid.db")
CACHE_EXPIRE_DAYS = 30
AREA_TOLERANCE = 0.3       # 면적 ±30%
SLEEP_SEC = 0.2            # API 호출 간 대기
LOOKBACK_MONTHS = 6        # 조회할 과거 개월 수


# ─────────────────────────────────────────
# 건물명 추출 (onbid_cltr_nm에서)
# ─────────────────────────────────────────
def extract_building_name(cltr_nm: str) -> str | None:
    """물건명에서 건물명을 추출한다.

    패턴:
      "인천 미추홀구 숭의동 302-8 외 4필지 [숭의엠타운] 903호 오피스텔"
      "경기도 여주시 오학동 292-34 외 2필지 [그랑시티] 제102동 제19층 제1902호"
      "울산 남구 신정동 1222-7 [신정반트펠리시아] 제6층 제602호"

    전략: 지번(숫자-숫자 또는 숫자 패턴) 뒤, 호/층/동 정보 앞에 있는 한글 단어
    """
    if not cltr_nm:
        return None

    # "외 N필지" 제거
    s = re.sub(r"\s*외\s*\d+필지\s*", " ", cltr_nm)
    # 시도/시군구/읍면동/지번 패턴 제거 (앞부분)
    s = re.sub(
        r"^.*?\d+(-\d+)?번?지?\s*",
        "",
        s,
    )
    # 호/층/동/오피스텔/업무시설 등 뒷부분 제거
    s = re.sub(
        r"\s*(제?\d+동|제?\d+층|제?\d+호|\d+호|오피스텔|업무시설|주건축물|및\s.*$).*",
        "",
        s,
        flags=re.IGNORECASE,
    )
    name = s.strip().rstrip(",").strip()

    # 결과가 너무 짧거나 숫자만이면 무효
    if not name or len(name) < 2 or name.isdigit():
        return None
    return name


# ─────────────────────────────────────────
# 지번 추출 (onbid_cltr_nm / zadr_nm에서)
# ─────────────────────────────────────────
def extract_jibun(cltr_nm: str | None, zadr_nm: str | None = None) -> str | None:
    """물건명 또는 지번주소에서 지번(번지)을 추출한다.

    우선순위: zadr_nm > cltr_nm
    패턴: '동|리|가' 뒤의 첫 번째 '숫자' 또는 '숫자-숫자'

    Returns: "302-8", "604", None 등
    """
    source = zadr_nm if zadr_nm else cltr_nm
    if not source:
        return None

    m = re.search(r"(?:동|리|가)\s+(\d+(?:-\d+)?)", source)
    if m:
        return m.group(1)
    return None


# ─────────────────────────────────────────
# 조회 대상 월 목록 생성
# ─────────────────────────────────────────
def get_deal_months(months: int = LOOKBACK_MONTHS) -> list[str]:
    """현재 기준으로 과거 N개월의 YYYYMM 목록을 반환."""
    now = datetime.now()
    result = []
    for i in range(months):
        dt = now - timedelta(days=30 * i)
        ym = dt.strftime("%Y%m")
        if ym not in result:
            result.append(ym)
    return result


# ─────────────────────────────────────────
# API 호출 + 캐싱
# ─────────────────────────────────────────
def _parse_deal_amount(raw) -> int | None:
    """거래금액 파싱. API 응답에 공백/콤마가 포함될 수 있음."""
    if raw is None:
        return None
    try:
        return int(str(raw).replace(",", "").replace(" ", "").strip())
    except (ValueError, TypeError):
        return None


def _parse_xml_items(xml_text: str) -> list[dict]:
    """XML 응답에서 item 목록을 파싱."""
    root = ET.fromstring(xml_text)

    # 에러 체크
    result_code = root.findtext(".//resultCode")
    if result_code and result_code not in ("00", "000"):
        msg = root.findtext(".//resultMsg") or "Unknown"
        log.warning(f"API 에러: {result_code} - {msg}")
        return []

    items = []
    for item in root.findall(".//item"):
        deal_amount = _parse_deal_amount(item.findtext("dealAmount"))

        # 면적: API별로 필드명이 다름
        #   오피스텔/아파트/연립다세대: excluUseAr (전용면적)
        #   상업업무용: buildingAr (건물면적)
        #   단독다가구: totalFloorAr (연면적)
        ar_raw = (
            item.findtext("excluUseAr")
            or item.findtext("buildingAr")
            or item.findtext("totalFloorAr")
        )
        ar_val = None
        if ar_raw and ar_raw.strip():
            try:
                ar_val = float(ar_raw)
            except (ValueError, TypeError):
                pass

        # 단가 계산
        unit_price = None
        if deal_amount and ar_val and ar_val > 0:
            unit_price = round(deal_amount / ar_val, 2)

        # 건물명: API별로 필드명이 다름
        #   오피스텔: offiNm, 아파트: aptNm, 연립다세대: mhouseNm
        #   상업업무용/단독다가구: 건물명 없음 → 용도로 대체
        bldg_nm = (
            item.findtext("offiNm")
            or item.findtext("aptNm")
            or item.findtext("mhouseNm")
            or ""
        ).strip()
        if not bldg_nm:
            bldg_nm = (item.findtext("buildingUse") or item.findtext("houseType") or "").strip()

        items.append({
            "dong_nm":      (item.findtext("umdNm") or "").strip(),
            "jibun":        (item.findtext("jibun") or "").strip() or None,
            "bldg_nm":      bldg_nm,
            "exclu_use_ar": ar_val,
            "deal_amount":  deal_amount,
            "floor":        (item.findtext("floor") or "").strip(),
            "build_year":   (item.findtext("buildYear") or "").strip(),
            "deal_day":     (item.findtext("dealDay") or "").strip(),
            "unit_price":   unit_price,
        })
    return items


def fetch_and_cache(conn: sqlite3.Connection, lawd_cd: str, deal_ymd: str,
                    api_type: str) -> int:
    """API 1회 호출 → MOLIT_TRADE_CACHE에 저장. 캐시 히트면 스킵.
    반환: 저장된 건수 (캐시 히트 시 -1).
    """
    # 캐시 체크
    row = conn.execute(
        """SELECT fetched_at FROM MOLIT_FETCH_LOG
           WHERE lawd_cd=? AND deal_ymd=? AND api_type=?""",
        (lawd_cd, deal_ymd, api_type),
    ).fetchone()

    if row:
        fetched_at = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S")
        if (datetime.now() - fetched_at).days < CACHE_EXPIRE_DAYS:
            return -1  # 캐시 유효

        # 캐시 만료 → 기존 데이터 삭제 후 재조회
        conn.execute(
            "DELETE FROM MOLIT_TRADE_CACHE WHERE lawd_cd=? AND deal_ymd=? AND api_type=?",
            (lawd_cd, deal_ymd, api_type),
        )
        conn.execute(
            "DELETE FROM MOLIT_FETCH_LOG WHERE lawd_cd=? AND deal_ymd=? AND api_type=?",
            (lawd_cd, deal_ymd, api_type),
        )

    url = API_URLS.get(api_type)
    if not url:
        log.warning(f"지원하지 않는 api_type: {api_type}")
        return 0

    params = {
        "serviceKey": SERVICE_KEY,
        "LAWD_CD":    lawd_cd,
        "DEAL_YMD":   deal_ymd,
        "numOfRows":  "9999",
        "pageNo":     "1",
    }

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        log.error(f"API 호출 실패 ({lawd_cd}/{deal_ymd}): {e}")
        return 0

    items = _parse_xml_items(resp.text)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for it in items:
        conn.execute(
            """INSERT INTO MOLIT_TRADE_CACHE
               (lawd_cd, deal_ymd, api_type, dong_nm, jibun, bldg_nm,
                exclu_use_ar, deal_amount, floor, build_year, deal_day,
                unit_price, fetched_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (lawd_cd, deal_ymd, api_type,
             it["dong_nm"], it.get("jibun"), it["bldg_nm"],
             it["exclu_use_ar"], it["deal_amount"],
             it["floor"], it["build_year"], it["deal_day"],
             it.get("unit_price"), now),
        )

    conn.execute(
        """INSERT OR REPLACE INTO MOLIT_FETCH_LOG
           (lawd_cd, deal_ymd, api_type, total_count, fetched_at)
           VALUES (?,?,?,?,?)""",
        (lawd_cd, deal_ymd, api_type, len(items), now),
    )
    conn.commit()

    log.info(f"수집 완료: {lawd_cd}/{deal_ymd}/{api_type} → {len(items)}건")
    return len(items)


# ─────────────────────────────────────────
# 매칭 알고리즘
# ─────────────────────────────────────────
def _normalize_name(name: str) -> str:
    """건물명 정규화: 공백/특수문자 제거, 소문자."""
    return re.sub(r"[\s·\-_()（）]", "", name).lower()


def _name_match(a: str | None, b: str | None) -> bool:
    """건물명 유사 매칭. 한쪽이 다른 쪽에 포함되면 매칭."""
    if not a or not b:
        return False
    na, nb = _normalize_name(a), _normalize_name(b)
    if not na or not nb:
        return False
    return na in nb or nb in na


def _area_match(onbid_area: float, trade_area: float) -> bool:
    """면적 범위 매칭. ±AREA_TOLERANCE 이내."""
    if not onbid_area or not trade_area:
        return False
    ratio = trade_area / onbid_area
    return (1 - AREA_TOLERANCE) <= ratio <= (1 + AREA_TOLERANCE)


def _jibun_match(a: str | None, b: str | None) -> bool:
    """지번 매칭. 본번이 같으면 매칭 (같은 필지).

    "302-8" vs "302-8" → True (정확 매칭)
    "302-8" vs "302"   → True (본번 매칭 — 부번 0 생략 케이스)
    "302-8" vs "302-3" → True (같은 본번, 같은 필지 가능성 높음)
    "302-8" vs "303-1" → False (본번 다름)
    """
    if not a or not b:
        return False
    bonbun_a = a.split("-")[0]
    bonbun_b = b.split("-")[0]
    return bonbun_a == bonbun_b


def match_trades(conn: sqlite3.Connection, lawd_cd: str,
                 dong_nm: str, bldg_name: str | None,
                 area: float | None,
                 jibun: str | None = None) -> dict:
    """캐시된 거래 데이터에서 3단계 폴백으로 유사 거래를 찾는다.
    모든 API 타입의 캐시를 통합 검색한다.

    Returns:
        {
            "status": "ok" | "no_data",
            "match_tier": 1~3,
            "match_tier_label": str,
            "transactions": [...],
            "summary": { avg_unit_price, estimated_market_price, latest_deal },
            "comparison": None  (API 엔드포인트에서 채움)
        }
    """
    months = get_deal_months()

    # 모든 API 타입의 캐시를 통합 검색
    all_trades = conn.execute(
        """SELECT dong_nm, jibun, bldg_nm, exclu_use_ar, deal_amount,
                  floor, build_year, deal_day, deal_ymd, unit_price
           FROM MOLIT_TRADE_CACHE
           WHERE lawd_cd=? AND deal_ymd IN ({})
           ORDER BY deal_ymd DESC, deal_day DESC""".format(
            ",".join("?" for _ in months)
        ),
        (lawd_cd, *months),
    ).fetchall()

    if not all_trades:
        return {"status": "no_data", "match_tier": None, "transactions": [],
                "summary": None, "comparison": None}

    cols = ["dong_nm", "jibun", "bldg_nm", "exclu_use_ar", "deal_amount",
            "floor", "build_year", "deal_day", "deal_ymd", "unit_price"]

    trades = [dict(zip(cols, row)) for row in all_trades]

    # Tier 0: 같은 읍면동 + 같은 지번 (면적 제한 없음 — 같은 건물 확정)
    if jibun:
        tier0 = [
            t for t in trades
            if t["dong_nm"] == dong_nm
            and _jibun_match(jibun, t.get("jibun"))
        ]
        if tier0:
            return _build_result(tier0, 0, "같은 읍면동 + 같은 지번 (같은 건물)", area)

    # Tier 1: 같은 읍면동 + 같은 건물명 + 면적 ±30%
    tier1 = [
        t for t in trades
        if t["dong_nm"] == dong_nm
        and _name_match(bldg_name, t["bldg_nm"])
        and (area is None or _area_match(area, t["exclu_use_ar"]))
    ]
    if tier1:
        return _build_result(tier1, 1, "같은 읍면동 + 같은 건물 + 유사면적", area)

    # Tier 2: 같은 읍면동 + 면적 ±30%
    tier2 = [
        t for t in trades
        if t["dong_nm"] == dong_nm
        and (area is None or _area_match(area, t["exclu_use_ar"]))
    ]
    if tier2:
        return _build_result(tier2, 2, "같은 읍면동 + 유사면적", area)

    # Tier 3: 같은 시군구(전체) + 면적 ±30%
    tier3 = [
        t for t in trades
        if area is None or _area_match(area, t["exclu_use_ar"])
    ]
    if tier3:
        return _build_result(tier3, 3, "같은 시군구 + 유사면적", area)

    return {"status": "no_data", "match_tier": None, "transactions": [],
            "summary": None, "comparison": None}


def _build_result(trades: list[dict], tier: int, label: str,
                  onbid_area: float | None) -> dict:
    """매칭된 거래 목록으로 응답 객체를 구성."""
    # ㎡당 단가 계산
    unit_prices = [t["unit_price"] for t in trades if t["unit_price"]]
    avg_up = round(sum(unit_prices) / len(unit_prices), 1) if unit_prices else None

    # 추정 시세 (㎡당 평균단가 × 온비드 물건 면적)
    estimated = None
    if avg_up and onbid_area:
        estimated = round(avg_up * onbid_area * 10000)  # 만원 → 원

    # 최근 거래월
    latest = None
    for t in trades:
        deal_date = f"{t['deal_ymd'][:4]}-{t['deal_ymd'][4:]}"
        if latest is None or deal_date > latest:
            latest = deal_date

    tx_list = []
    for t in trades[:20]:  # 최대 20건
        tx_list.append({
            "dong_nm":      t["dong_nm"],
            "bldg_nm":      t["bldg_nm"],
            "exclu_use_ar": t["exclu_use_ar"],
            "deal_amount":  t["deal_amount"],
            "floor":        t["floor"],
            "deal_date":    f"{t['deal_ymd'][:4]}-{t['deal_ymd'][4:]}-{t['deal_day'].zfill(2)}" if t["deal_day"] else f"{t['deal_ymd'][:4]}-{t['deal_ymd'][4:]}",
            "unit_price":   t["unit_price"],
        })

    return {
        "status": "ok",
        "match_tier": tier,
        "match_tier_label": label,
        "match_count": len(trades),
        "transactions": tx_list,
        "summary": {
            "avg_unit_price": avg_up,
            "estimated_market_price_won": estimated,
            "latest_deal": latest,
        },
        "comparison": None,  # API 엔드포인트에서 입찰가 비교 추가
    }


# ─────────────────────────────────────────
# 메인 함수: 물건 1건의 시세 조회
# ─────────────────────────────────────────
def get_market_price(conn: sqlite3.Connection,
                     sd_nm: str, sggn_nm: str, emd_nm: str,
                     usg_scls: str, bld_sqms: float | None,
                     cltr_nm: str | None) -> dict:
    """온비드 물건 정보로 시세를 조회한다.

    Args:
        conn:      DB 연결 (MOLIT 테이블이 init 되어 있어야 함)
        sd_nm:     시도명
        sggn_nm:   시군구명
        emd_nm:    읍면동명
        usg_scls:  용도소분류명 (오피스텔/업무시설/주·상용건물)
        bld_sqms:  건물면적 (㎡)
        cltr_nm:   물건명 (건물명 추출용)

    Returns: API 응답용 dict
    """
    # 1) LAWD_CD 변환
    lawd_cd = get_lawd_cd(sd_nm, sggn_nm)
    if not lawd_cd:
        return {"status": "no_mapping",
                "message": f"법정동코드 매핑 없음: {sd_nm} {sggn_nm}"}

    # 2) API 키 확인
    if not SERVICE_KEY:
        return {"status": "api_error",
                "message": "ONBID_API_KEY가 설정되지 않았습니다"}

    # 3) 우선순위 기반 단계적 조회
    #    온비드 분류에 맞는 API 먼저 → 매칭 성공하면 나머지 스킵
    months = get_deal_months()
    bldg_name = extract_building_name(cltr_nm)

    primary_types = USG_TO_PRIMARY.get(usg_scls, ["officetel", "commercial"])
    secondary_types = [t for t in ALL_API_TYPES if t not in primary_types]

    # 3a) 우선 API 수집
    api_called = 0
    for ym in months:
        for api_type in primary_types:
            cnt = fetch_and_cache(conn, lawd_cd, ym, api_type)
            if cnt >= 0:
                api_called += 1
                time.sleep(SLEEP_SEC)

    # 3b) 우선 API 결과로 매칭 시도
    result = match_trades(conn, lawd_cd, emd_nm, bldg_name, bld_sqms)

    if result["status"] == "ok" and result.get("match_tier") in (1, 2):
        log.info(f"우선 API {api_called}콜로 Tier {result['match_tier']} 매칭 ({lawd_cd})")
        return result

    # 3c) 매칭 실패 또는 Tier 3 → 나머지 API도 조회
    for ym in months:
        for api_type in secondary_types:
            cnt = fetch_and_cache(conn, lawd_cd, ym, api_type)
            if cnt >= 0:
                api_called += 1
                time.sleep(SLEEP_SEC)

    if api_called > 0:
        log.info(f"전체 API {api_called}콜 사용 ({lawd_cd})")

    # 3d) 전체 캐시로 재매칭
    result = match_trades(conn, lawd_cd, emd_nm, bldg_name, bld_sqms)

    return result


# ─────────────────────────────────────────
# CLI 테스트
# ─────────────────────────────────────────
if __name__ == "__main__":
    conn = sqlite3.connect(DB_PATH)
    init_molit_db(conn)

    # 테스트: 인천 미추홀구 숭의동 오피스텔 76.86㎡
    result = get_market_price(
        conn,
        sd_nm="인천광역시",
        sggn_nm="미추홀구",
        emd_nm="숭의동",
        usg_scls="오피스텔",
        bld_sqms=76.86,
        cltr_nm="인천광역시 미추홀구 숭의동 302-8 외 4필지 숭의엠타운 903호 오피스텔",
    )

    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))
    conn.close()
