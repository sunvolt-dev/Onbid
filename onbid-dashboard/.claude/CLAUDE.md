# 온비드 공매 대시보드

한국자산관리공사 온비드(Onbid) 공공데이터 API를 활용해 부동산 공매 물건을 자동 수집하고, 투자 판단에 유용한 정보를 대시보드로 제공하는 시스템.

## 기술 스택

| 구성요소 | 기술 |
|---|---|
| 데이터 수집 | Python (requests) |
| 데이터베이스 | SQLite (`collector/onbid.db`) |
| 백엔드 API | Flask (`api/app.py`) |
| 프론트엔드 | Next.js + TypeScript (`frontend/`) |
| 스케줄러 | cron |

## 참고 문서

작업 전 반드시 관련 문서를 확인할 것.

- **DB 스키마**: [`docs/table_relations.md`](../docs/table_relations.md) — 테이블 구조, 관계, 컬럼 설명
- **ADR (의사결정 기록)**: [`docs/adr/`](../docs/adr/) — 설계 결정과 근거. 작업 완료 후 새 ADR 작성
- **와이어프레임**: [`docs/wire_frame_html/`](../docs/wire_frame_html/) — UI 구현 시 참고할 HTML 목업
- **온비드 API 공식 문서**: [`docs/api_docs/`](../docs/api_docs/) — 01(목록), 04(상세), 07(입찰) API 레퍼런스

## 수집 파이프라인 (3단계)

```
[매일 cron 07:00 / 18:00 실행]

1단계: onbid_list_collector.py — 뭐가 있는지 훑는 파일
   QUERY_GROUPS 3개 카테고리 × 페이지 단위 API 호출
   → 신규: INSERT / 기존: UPDATE / 미수집: status='closed' (삭제 안 함)
   → 저장: BID_ITEMS

2단계: onbid_detail_collector.py — 각 물건 속을 파는 파일
   detail_fetched_at IS NULL 또는 crtn_yn='Y' 물건 대상
   ratio_pct 낮은(유망한) 것 먼저, API 10 tps 제한 (0.15초 대기)
   → 저장: 9개 서브 테이블 (BID_SQMS, BID_APSL_EVL 등)

3단계: onbid_bid_collector.py — 입찰 회차 정보를 파는 파일
   bid_fetched_at IS NULL 물건 대상
   → 저장: BID_QUAL, BID_HIST
```

cron 시간 근거: 오전 10~12시, 오후 2~5시에 입찰 마감 집중 → 7시에 당일 마감 확인, 18시에 결과 반영.

## 수집 조건

- **카테고리**: 업무시설, 주/상용건물, 오피스텔
- **처분방식**: 매각 / **입찰방식**: 인터넷 입찰
- **건물면적**: 30~200㎡
- **대상 지역**: 서울, 경기, 인천, 부산, 대구, 광주, 대전, 울산, 세종 (API 한계로 전체 수집 후 Python 필터링)

## 물건 상태 관리

낙찰/취소된 물건은 온비드 API 응답에서 사라짐. 수집 시 응답에 없는 active 물건을 `status='closed'`로 마킹. 삭제 없이 이력 보존.