# 온비드 공매 대시보드

한국자산관리공사 온비드(Onbid) 공공데이터 API를 활용해 부동산 공매 물건을 자동 수집하고, 투자 판단에 유용한 정보를 대시보드로 제공하는 시스템.

## 기술 스택

| 구성요소 | 기술 |
|---|---|
| 데이터 수집 | Python (requests) |
| 데이터베이스 | SQLite |
| 백엔드 API | Flask |
| 프론트엔드 | Next.js (React) |
| 스케줄러 | cron |

## 프로젝트 구조

```
onbid-dashboard/
├── collector/
│   ├── onbid_list_collector.py   # 01 API — 목록 수집, BID_ITEMS 저장
│   ├── onbid_detail_collector.py # 04 API — 물건 상세, 9개 서브 테이블 저장
│   ├── onbid_bid_collector.py    # 07 API — 입찰정보, BID_QUAL/BID_HIST 저장
│   └── onbid_api_list.py         # 테스트/샘플 출력용
├── server/
│   └── app.py                    # Flask API 서버 (미구현)
├── client/                       # Next.js 프론트엔드 (미구현)
│   ├── app/
│   │   ├── page.tsx              # 목록 대시보드
│   │   └── items/[id]/page.tsx   # 물건 상세 페이지
│   └── components/
│       ├── ItemTable.tsx
│       ├── FilterBar.tsx
│       └── ItemDetail.tsx
└── docs/
    ├── 01_온비드_부동산_물건목록_조회서비스.md   # 목록 API 공식 문서
    ├── 04_온비드_부동산_물건상세_조회서비스.md   # 상세 API 공식 문서
    └── 07_온비드_물건상세_입찰정보_조회서비스.md # 입찰 API 공식 문서
```

## 수집 파이프라인 (3단계)

```
[매일 cron 실행]

1단계: onbid_list_collector.py — 뭐가 있는지 훑는 파일
   QUERY_GROUPS 3개 카테고리 × 페이지 단위 API 호출
   → 신규 물건: INSERT (first_collected_at 기록)
   → 기존 물건: UPDATE (first_collected_at 유지)
   → 이번 수집에 안 잡힌 물건: status = 'closed' (삭제 안 함, 이력 보존)
   → COLLECTION_LOG 기록
   → 저장: BID_ITEMS

2단계: onbid_detail_collector.py — 각 물건 속을 파는 파일
   BID_ITEMS에서 detail_fetched_at IS NULL 또는 crtn_yn='Y' 물건 대상
   ratio_pct 낮은(유망한) 것 먼저 처리
   API 10 tps 제한 → 호출마다 0.15초 대기
   → 저장: BID_SQMS, BID_APSL_EVL, BID_LEAS_INF, BID_RGST_PRMR,
           BID_DTBT_RQR, BID_OCPY_REL, BID_BATC_CLTR, BID_CRTN_LST, BID_PAPS_INF

3단계: onbid_bid_collector.py — 입찰 회차 정보를 파는 파일
   BID_ITEMS에서 bid_fetched_at IS NULL 물건 대상
   ratio_pct 낮은 것 먼저 처리
   API 10 tps 제한 → 호출마다 0.15초 대기
   → 저장: BID_QUAL (회차별 입찰정보), BID_HIST (이전 입찰 내역)
```

## 수집 조건

**카테고리 (QUERY_GROUPS):**
- 상가용및업무용건물 > 업무시설
- 용도복합용건물 > 주/상용건물
- 용도복합용건물 > 오피스텔

**API 파라미터:**
- 처분방식: 매각 (`dspsMthodCd=0001`)
- 입찰방식: 인터넷 입찰 (`bidDivCd=0001`)
- 건물면적: 30㎡ ~ 200㎡

**대상 지역 (TARGET_REGIONS, Python 필터링):**
- 서울특별시, 경기도, 인천광역시
- 부산광역시, 대구광역시, 광주광역시, 대전광역시, 울산광역시
- 세종특별자치시
- API의 `lctnSdnm`은 단일값만 지원하므로 전체 수집 후 Python에서 필터링

## Flask API 엔드포인트 (미구현)

| 메서드 | 경로 | 설명 | 출처 |
|---|---|---|---|
| GET | `/api/items` | 목록 조회 (필터/정렬) | DB |
| GET | `/api/items/<id>/detail` | 물건 상세 | DB |
| GET | `/api/items/<id>/bid` | 입찰 회차 정보 | DB |
| POST | `/api/items/<id>/bookmark` | 북마크 토글 | DB |

**GET /api/items 파라미터:** `ratio_max`, `usbd_min`, `sd_nm`, `bookmarked`, `limit`

## DB 설계

### BID_ITEMS (핵심 테이블 — 01 API)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `cltr_mng_no` | TEXT PK | 물건관리번호 |
| `pbct_cdtn_no` | INTEGER | 공매조건번호 — 상세/입찰 API 호출 시 필요 |
| `onbid_cltr_nm` | TEXT | 물건명 |
| `prpt_div_nm` | TEXT | 재산유형 (압류재산 / 기타일반재산 등) |
| `cltr_usg_mcls_nm` | TEXT | 용도 중분류 |
| `cltr_usg_scls_nm` | TEXT | 용도 소분류 |
| `lctn_sd_nm` | TEXT | 소재지 시도 |
| `lctn_sggn_nm` | TEXT | 소재지 시군구 |
| `lctn_emd_nm` | TEXT | 소재지 읍면동 |
| `land_sqms` | REAL | 토지면적 (㎡) |
| `bld_sqms` | REAL | 건물면적 (㎡) |
| `apsl_evl_amt` | INTEGER | 감정평가금액 (원) |
| `lowst_bid_prc` | INTEGER | 현재 회차 최저입찰가 (원) |
| `ratio_pct` | REAL | 감정가 대비 최저입찰가 비율 (%) — 핵심 투자 지표 |
| `frst_ratio_pct` | REAL | 최초 최저입찰가 대비 현재 비율 (%) — 하락폭 파악용 |
| `usbd_nft` | INTEGER | 유찰 횟수 |
| `pbct_nsq` | TEXT | 현재 공매 회차 |
| `pvct_trgt_yn` | TEXT | 수의계약 가능여부 (Y/N) |
| `batc_bid_yn` | TEXT | 일괄입찰 여부 |
| `alc_yn` | TEXT | 지분물건 여부 |
| `crtn_yn` | TEXT | 정정 이력 여부 |
| `rqst_org_nm` | TEXT | 공고기관명 |
| `exct_org_nm` | TEXT | 집행기관명 |
| `cltr_bid_bgng_dt` | TEXT | 입찰 시작일시 (YYYY-MM-DD HH:MM) |
| `cltr_bid_end_dt` | TEXT | 입찰 마감일시 (YYYY-MM-DD HH:MM) |
| `thnl_img_url` | TEXT | 썸네일 이미지 URL |
| `status` | TEXT | active: 진행중 / closed: 낙찰·취소 종료 |
| `is_bookmarked` | INTEGER | 관심목록 등록 여부 (0/1) |
| `first_collected_at` | TEXT | 최초 수집 일시 |
| `collected_at` | TEXT | 마지막 수집 일시 |
| `detail_fetched_at` | TEXT | 상세 API 마지막 수집 일시 |
| `bid_fetched_at` | TEXT | 입찰 API 마지막 수집 일시 |

### 상세 서브 테이블 (04 API — onbid_detail_collector.py)

| 테이블 | 설명 | 비고 |
|---|---|---|
| `BID_SQMS` | 면적정보 | 1:N |
| `BID_APSL_EVL` | 감정평가정보 | 1:N |
| `BID_LEAS_INF` | 임대차정보 | 1:N, 압류재산만 |
| `BID_RGST_PRMR` | 등기사항증명서 주요정보 | 1:N, 압류재산만 |
| `BID_DTBT_RQR` | 배분요구사항 | 1:N, 압류재산만 |
| `BID_OCPY_REL` | 점유관계 | 1:N, 압류재산만 |
| `BID_BATC_CLTR` | 일괄입찰물건목록 | 1:N |
| `BID_CRTN_LST` | 정정내역 | 1:N |
| `BID_PAPS_INF` | 공매재산명세서 | 1:1 |

### 입찰 서브 테이블 (07 API — onbid_bid_collector.py)

| 테이블 | 설명 | 비고 |
|---|---|---|
| `BID_QUAL` | 회차별 입찰정보 (입찰기간, 최저가, 보증금 등) | 1:N |
| `BID_HIST` | 이전 입찰 내역 (유찰/낙찰 이력) | BID_QUAL 하위 1:N |

### 관리 테이블

| 테이블 | 설명 |
|---|---|
| `COLLECTION_LOG` | 수집 실행 이력 (`run_at`, `query_label`, `total/new/updated_count`, `status`, `error_msg`) |
| `ALERT_LOG` | 알림 발송 이력 (`cltr_mng_no`, `alert_type`: ratio/deadline/pvct, `triggered_ratio`, `sent_at`, `status`) |

## 물건 상태 관리

낙찰/취소된 물건은 온비드 API 응답에서 사라짐. 매 수집 완료 후 `all_collected_ids`에 없는 `active` 물건을 `status='closed'`로 마킹. 삭제 없이 이력 보존.
