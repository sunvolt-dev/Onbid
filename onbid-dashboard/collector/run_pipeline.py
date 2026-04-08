"""
run_pipeline.py
─────────────────────────────────────────────────────────────────────────────
온비드 수집 파이프라인 오케스트레이터

실행 순서:
  1단계: onbid_list_collector.py   — 물건 목록 수집
  2단계: onbid_detail_collector.py — 물건 상세 수집
  3단계: onbid_bid_collector.py    — 입찰정보 수집

중단 조건:
  - 1단계 실행 후 COLLECTION_LOG에 오늘 성공한 그룹이 하나도 없으면 중단
    (API 장애, 네트워크 오류 등으로 전체 실패한 경우 stale 데이터 기준으로
     2·3단계가 도는 것을 방지)

cron 등록 예시:
  0 6 * * * cd /path/to/onbid-dashboard/collector && python run_pipeline.py
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sqlite3
import subprocess
import logging
import sys
from datetime import datetime

# ─────────────────────────────────────────
# 설정
# ─────────────────────────────────────────
DB_PATH     = "onbid.db"
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("onbid_pipeline.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


def run_step(script_name: str) -> bool:
    """스크립트를 실행하고 성공 여부를 반환한다."""
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    log.info(f"[{script_name}] 시작")
    result = subprocess.run(
        [sys.executable, script_path],
        cwd=SCRIPTS_DIR,
    )
    if result.returncode != 0:
        log.error(f"[{script_name}] 비정상 종료 (exit code {result.returncode})")
        return False
    log.info(f"[{script_name}] 완료")
    return True


def check_step1_success() -> bool:
    """오늘 1단계 수집에서 성공한 그룹이 하나라도 있는지 확인한다."""
    if not os.path.exists(DB_PATH):
        log.error(f"DB 파일 없음: {DB_PATH}")
        return False

    today = datetime.now().strftime("%Y-%m-%d")
    conn = sqlite3.connect(DB_PATH)
    try:
        row = conn.execute(
            """
            SELECT COUNT(*) FROM COLLECTION_LOG
            WHERE status = 'success'
              AND run_at >= ?
            """,
            (today,),
        ).fetchone()
        success_count = row[0] if row else 0
    finally:
        conn.close()

    if success_count == 0:
        log.error(
            "1단계 수집 결과 없음 — 오늘 성공한 그룹이 없습니다. "
            "2·3단계 실행을 중단합니다."
        )
        return False

    log.info(f"1단계 수집 확인: 오늘 성공한 그룹 {success_count}개")
    return True


def main():
    log.info("=" * 55)
    log.info("온비드 수집 파이프라인 시작")
    log.info("=" * 55)

    # 1단계: 목록 수집
    run_step("onbid_list_collector.py")

    # 1단계 성공 여부 검증 — 실패 시 중단
    if not check_step1_success():
        log.error("파이프라인 중단")
        sys.exit(1)

    # 2단계: 물건 상세 수집
    run_step("onbid_detail_collector.py")

    # 3단계: 입찰정보 수집
    run_step("onbid_bid_collector.py")

    log.info("=" * 55)
    log.info("온비드 수집 파이프라인 완료")
    log.info("=" * 55)


if __name__ == "__main__":
    main()
