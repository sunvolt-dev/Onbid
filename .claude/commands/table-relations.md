# /table-relations 커맨드

DB 실제 스키마를 읽어 `docs/table_relations.md`를 생성·업데이트한다.

## 실행 조건

- `collector/onbid.db`가 존재해야 한다
- 스키마가 변경된 후 (테이블 추가, 컬럼 추가/삭제) 실행

## 실행 절차

1. `sqlite3 collector/onbid.db ".tables"` 로 전체 테이블 목록 조회
2. 각 테이블에 대해 `PRAGMA table_info(<table>)` 실행
3. 각 테이블에 대해 `PRAGMA foreign_key_list(<table>)` 실행 (외래키 관계)
4. 조회 결과를 바탕으로 아래 **출력 형식**에 맞게 `docs/table_relations.md` 작성
5. 파일이 이미 존재하면 덮어쓴다 (업데이트)

## 출력 형식

```markdown
# DB 테이블 관계도

> 마지막 업데이트: YYYY-MM-DD
> DB: collector/onbid.db

## 테이블 목록

| 테이블 | 설명 | 관계 |
|---|---|---|
...

## 관계 다이어그램 (텍스트)

BID_ITEMS (핵심)
├── BID_SQMS          (1:N, cltr_mng_no)
├── BID_APSL_EVL      (1:N, cltr_mng_no)
...

## 테이블별 컬럼 상세

### BID_ITEMS
| # | 컬럼명 | 타입 | NOT NULL | 기본값 | PK |
|---|---|---|---|---|---|
...
```

## 컬럼 설명 추가 규칙

CLAUDE.md의 DB 설계 섹션에 설명이 있는 컬럼은 설명을 추가한다.
설명이 없는 컬럼은 컬럼명 그대로 남긴다.

## 주의

- 코드를 작성하거나 실행하지 말고, Bash 툴로 sqlite3 명령을 직접 실행한다
- `docs/` 디렉토리가 없으면 먼저 생성한다
- 생성 완료 후 파일 경로를 알려준다
