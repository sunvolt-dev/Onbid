# 온비드 수의계약 자동 분석 대시보드 개발

## 프로젝트 개요
온비드(onbid.co.kr) 수의계약가능물건을 매일 자동 수집하고,
감정가 대비 현재 입찰가 비율을 자동 계산해 보여주는 내부 대시보드를 개발한다.
현재 대표가 주 수 시간씩 수동으로 온비드를 뒤지는 작업을 자동화하는 것이 목표다.

---

## 핵심 비즈니스 로직

### 감정가 대비 비율 계산
- 공식: (최저입찰가 / 감정평가액) × 100 = 감정가 대비 %
- A등급: 40% 이하 → 빨간색 하이라이트 + 이메일 알림
- B등급: 41~50% → 노란색 하이라이트
- C등급: 51~70% → 초록색 표시
- 70% 초과: 표시하되 관심 제외

### 회차 표시
- 수의계약가능물건은 이미 최종 회차 도달한 물건
- "유찰 N회 · 수의계약" 형태로 표시
- `fldMgmtNo` 필드 = 유찰 횟수

### D-day 계산
- `bidClsDt` 필드 기준
- D-3 이하: 빨간색, D-7 이하: 주황색, 이후: 회색

---

## 타겟 URL (수의계약가능물건)
https://www.onbid.co.kr/op/cta/cltrdtl/abryCollateralDetailRealEstateList.do

기본 필터 설정값 (온비드 화면 기준):
- 처분방식: 매각
- 지역: 도로명
- 면적: 건물 기준 30~200㎡
- 용도: 상가용및업무용 > 업무시설

---

## 온비드 오픈 API 명세

- 기본 URL: https://api.onbid.co.kr/openapi/services/OdBidInfoService
- 인증: serviceKey 파라미터 (공공데이터포털 발급)
- 포맷: JSON

### 주요 엔드포인트
| 엔드포인트 | 설명 |
|---|---|
| /getBidPbancList | 물건 목록 조회 |
| /getBidPbancInfo | 물건 상세 조회 |
| /getSbidResultList | 낙찰 이력 조회 |

### 핵심 응답 필드
| 필드명 | 타입 | 설명 |
|---|---|---|
| pbancNo | String | 물건번호 (고유 식별자) |
| clsNm | String | 물건 종류 |
| sido / sigungu | String | 소재지 |
| apprAmt | Long | 감정평가액 (원) |
| strtBidAmt | Long | 최저입찰가 (원) |
| fldMgmtNo | Integer | 유찰 횟수 |
| bidClsDt | String | 입찰 마감일시 |
| rdnAddr | String | 도로명 주소 |

### 호출 제한
- 일 1,000건 (기본)
- 페이지네이션 처리 필수 (pageNo, numOfRows)

---

## 기술 스택

### Backend
- Python 3.11+
- Flask (REST API 서버)
- SQLite → 추후 PostgreSQL 확장 가능하게 설계
- APScheduler 또는 cron (매일 오전 6시 자동 실행)
- requests, pandas

### Frontend
- React + Vite
- Tailwind CSS
- 별도 외부 UI 라이브러리 없이 직접 구현

### 인프라
- Docker Compose로 backend/frontend 함께 실행
- GitHub Actions로 스케줄러 대체 가능

---

## 파일 트리 (이 구조로 프로젝트를 초기화해줘)

onbid-dashboard/
├── .env                        # API 키 관리 (절대 커밋 금지)
├── .env.example
├── requirements.txt
├── README.md
│
├── collector/
│   ├── onbid_api.py            # 온비드 오픈 API 호출, 전체 물건 수집
│   ├── molit_api.py            # 국토부 실거래가 API (시세 비교용, 무료)
│   ├── scheduler.py            # 매일 오전 6시 자동 실행
│   └── paginator.py            # 페이지네이션 자동 처리
│
├── processor/
│   ├── calculator.py           # 감정가 대비 % 계산 핵심 로직
│   ├── grader.py               # A/B/C 등급 분류
│   ├── price_estimator.py      # 국토부 실거래가 기반 시세차익 추정
│   └── dday.py                 # 마감 D-day 계산
│
├── db/
│   ├── models.py               # SQLite 스키마 (SQLAlchemy)
│   ├── crud.py                 # 저장/조회/업데이트
│   ├── migrations/
│   └── onbid.db                # SQLite 파일
│
├── api/
│   ├── app.py                  # Flask 앱 진입점
│   ├── routes.py               # REST 엔드포인트
│   └── filters.py              # 조건별 필터 쿼리 로직
│
├── notifier/
│   ├── email_sender.py         # Gmail SMTP 알림
│   └── report.py               # 일일 요약 리포트 생성
│
├── tests/
│   ├── test_collector.py
│   └── test_calculator.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── FilterPanel.jsx     # 좌측 필터 패널
│       │   ├── PropertyTable.jsx   # 물건 목록 테이블
│       │   ├── SummaryBar.jsx      # 상단 요약 바 (총건수/A등급/B등급/신규)
│       │   ├── RatioBadge.jsx      # 감정가 % 컬러 뱃지
│       │   ├── GradeBadge.jsx      # A/B/C 등급 뱃지
│       │   ├── DdayBadge.jsx       # 마감 D-day 뱃지
│       │   └── Toolbar.jsx         # 정렬 툴바
│       ├── hooks/
│       │   ├── useProperties.js    # 물건 데이터 fetch
│       │   └── useFilters.js       # 필터 상태 관리
│       ├── utils/
│       │   ├── formatters.js       # 숫자/날짜 포맷 유틸
│       │   └── constants.js        # 등급 기준값, 색상 등 상수
│       └── api/
│           └── client.js           # Flask API 호출 함수
│
└── infra/
    ├── docker-compose.yml
    ├── Dockerfile.backend
    ├── nginx.conf
    └── cron.yml                    # GitHub Actions 스케줄러

---

## UI 레이아웃 요구사항

- 좌우 분리 레이아웃: 좌측 필터 패널(230px 고정) + 우측 결과 테이블
- 온비드 기존 UI처럼 상하로 쌓이는 구조 금지

### 테이블 컬럼 순서
1. 체크박스
2. 물건번호 (클릭 시 새 탭으로 온비드 상세페이지 이동)
3. 물건정보 (종류 + 면적)
4. 소재지
5. 입찰기간
6. 감정평가액
7. 최저입찰가
8. **감정가 대비 %** ← 기본 오름차순 정렬 기준
9. **회차정보** (유찰 N회 · 수의계약)
10. **등급** (A/B/C)
11. **마감까지 D-day** ← 임박순 강조
12. 공고/상세 링크

### 상단 요약 바
- 전체 물건 수 / A등급 수 / B등급 수 / 오늘 신규 등록 수

### 필터 패널 항목
- 처분방식 (라디오: 전체/매각/임대)
- 용도 (드롭다운 2단계)
- 지역 (시/도 → 시/군/구)
- 면적 범위 (㎡)
- 감정가 대비 비율 상한 (%)
- 유찰 횟수 최소값
- 자산구분 (체크박스)
- 물건관리번호 / 물건명 검색

---

## 개발 순서 (이 순서대로 진행해줘)

### 1단계: API 연동 확인
collector/onbid_api.py 작성
- .env에서 ONBID_API_KEY 로드
- /getBidPbancList 호출 (clsNm=업무시설, type=json)
- 페이지네이션으로 전체 물건 수집
- 샘플 응답 10건 출력해서 필드 확인

### 2단계: 핵심 계산 로직
processor/calculator.py 작성
- calc_ratio(appr_amt, strt_bid_amt) → float
- get_grade(ratio) → 'A' | 'B' | 'C' | None
- calc_dday(bid_cls_dt) → int

### 3단계: DB 설계 및 저장
db/models.py → Property 테이블 스키마
db/crud.py → upsert 로직 (pbancNo 기준 중복 방지)

### 4단계: Flask API 서버
api/app.py + routes.py
- GET /api/properties?grade=A&ratio_max=70&region=서울
- GET /api/summary (요약 통계)

### 5단계: 프론트엔드
FilterPanel → PropertyTable → 뱃지 컴포넌트 순서로

### 6단계: 스케줄러 + 알림
scheduler.py → 매일 오전 6시 수집 자동 실행
notifier/email_sender.py → A등급 신규 물건 발견 시 이메일

---

## 환경변수 (.env.example)

ONBID_API_KEY=여기에_온비드_서비스키
MOLIT_API_KEY=여기에_국토부_서비스키
ALERT_EMAIL=수신할_이메일@gmail.com
GMAIL_APP_PASSWORD=앱_비밀번호
FLASK_PORT=5000
DATABASE_URL=sqlite:///onbid.db

---

## 주의사항

- API 키는 절대 코드에 하드코딩 금지, 반드시 .env에서 로드
- 온비드 API 일 1,000건 제한 → 페이지당 100건, 요청 간 0.5초 딜레이 적용
- pbancNo 기준으로 upsert 처리 (중복 저장 방지)
- 수의계약가능물건은 bidClsDt가 없거나 "수의계약"으로 표기될 수 있음 → 예외처리 필요
- 감정평가액(apprAmt)이 0이거나 null인 경우 비율 계산 스킵 후 별도 표시

---

지금 당장 1단계부터 시작해줘.
collector/onbid_api.py 작성하고,
테스트 실행해서 실제 응답 필드 10건 출력하는 것까지 완성해줘.