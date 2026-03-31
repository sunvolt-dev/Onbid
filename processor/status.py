"""물건 상태 관리 (종료 감지)."""

import sqlite3


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
