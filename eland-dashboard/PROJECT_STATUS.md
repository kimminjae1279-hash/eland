# 이랜드 유통 매출 대시보드 — 프로젝트 인수인계 문서

> 이 문서를 새 Claude 세션에 공유하면 이전 작업을 그대로 이어서 진행할 수 있습니다.

---

## 1. 프로젝트 개요

이랜드 유통 CSO실에서 사용하는 **매출 데이터 대시보드**입니다.
SAP에서 내보낸 월별 피벗 데이터를 Google Sheets에 붙여넣으면,
Google Sheets API로 자동으로 읽어와 DB에 적재하고 시각화합니다.

---

## 2. 기술 스택

| 항목 | 내용 |
|------|------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| 배포 | Vercel |
| 데이터 연동 | Google Sheets API (Service Account) |
| 차트 | Recharts |
| 패키지 | @supabase/supabase-js, googleapis, papaparse, xlsx, recharts |

---

## 3. 레포지토리

```
https://github.com/kimminjae1279-hash/eland.git
```

- 브랜치: `main`
- Next.js 프로젝트 위치: `/eland-dashboard/`

---

## 4. 배포 현황

| 항목 | 값 |
|------|-----|
| **Production URL** | https://eland-dashboard-gold.vercel.app |
| Vercel 프로젝트 | kimminjae1279-hashs-projects/eland-dashboard |

---

## 5. Supabase 현황

| 항목 | 값 |
|------|-----|
| 프로젝트명 | eland-dashboard |
| Project ID | vdxumwiukltbriyoxybh |
| 리전 | ap-northeast-2 (서울) |
| Dashboard | https://supabase.com/dashboard/project/vdxumwiukltbriyoxybh |

### 테이블 구조

```sql
-- 일별 매출 팩트 (핵심)
fact_sales (
  id, store_code, store_name, brand_code, brand_name,
  division, sale_date, year, month, sales_amount,
  UNIQUE(store_code, brand_code, sale_date)
)

-- 월별 목표액
fact_target (
  id, store_code, brand_code, year_month, target_amount,
  UNIQUE(store_code, brand_code, year_month)
)

-- 업로드 이력
upload_logs (id, file_name, row_count, year_month, status, error_msg)

-- 자동 계산 뷰
view_sales_yoy     -- 전년 대비 성장률 자동 계산 (LEFT JOIN 1년 전)
view_sales_monthly -- 월별 집계 (빠른 대시보드 조회용)
```

---

## 6. API 엔드포인트

| 경로 | 메서드 | 역할 |
|------|--------|------|
| `/api/sales` | GET | 매출 조회 (필터: from, to, brand, division, store, monthly) |
| `/api/import-sheets` | POST | Google Sheets API로 시트 읽기 → fact_sales upsert |
| `/api/sap-upload` | POST | Apps Script에서 직접 전송할 때 사용 |
| `/api/upload` | POST | CSV/Excel 파일 업로드 |
| `/api/sheets-proxy` | POST | CORS 우회용 공개 시트 CSV 가져오기 |

---

## 7. 데이터 구조 (SAP 피벗 포맷)

SAP에서 내보낸 월별 피벗 시트 구조:

```
Row 0: "총 매출액" 반복
Row 1: 빈칸, 빈칸, "일", "2025-01-01", "2025-01-02" ...
Row 2: "플랜트", "중계점명", "구매그룹", "브랜드(Now)", "상세분류", 합계, KRW ...
Row 3: "전체 결과" (합계행 - 스킵)
Row 4+: 실제 데이터
```

컬럼 매핑 (0-based index):
- 0: `store_code` (플랜트)
- 1: `store_name` (중계점명)
- 2: `division` (구매그룹: 잡화/여성/영캐/남성/스포츠/아동)
- 3: `brand_code` (브랜드(Now) 코드)
- 4: `brand_name` (상세분류, 실제 브랜드명)
- 5: 합계 (스킵)
- 6~: 날짜별 매출 (Wide 포맷)

### 데이터 규모
- 42개 지점 × ~275개 브랜드 × 31일 × 16개월 = **약 570만 행**
- 정규화 저장 시 **약 285MB** → Supabase 무료 티어 가능

---

## 8. 환경변수

### `.env.local` (로컬, gitignore 처리됨)
```env
NEXT_PUBLIC_SUPABASE_URL=https://vdxumwiukltbriyoxybh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GOOGLE_SERVICE_ACCOUNT_BASE64=<서비스 계정 JSON을 base64 인코딩한 값>
```

### Vercel 등록 현황
- `NEXT_PUBLIC_SUPABASE_URL` ✅ 등록됨
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ 등록됨
- `GOOGLE_SERVICE_ACCOUNT_BASE64` ❌ **아직 미등록 → 최우선 작업**

---

## 9. 현재 미완성 작업 (다음 세션에서 이어서)

### ❗ 최우선: Google Sheets API Service Account 설정

아직 완료되지 않은 핵심 작업입니다.

#### 9-1. 사용자가 직접 해야 하는 작업 (Google Cloud Console)

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성 (예: `eland-dashboard`)
3. **API 및 서비스** → **라이브러리** → `Google Sheets API` 검색 → **사용** 클릭
4. **API 및 서비스** → **사용자 인증 정보** → **사용자 인증 정보 만들기** → **서비스 계정**
5. 서비스 계정 이름 입력 (예: `eland-sheets-reader`) → **완료**
6. 생성된 서비스 계정 클릭 → **키** 탭 → **키 추가** → **JSON** → 다운로드
7. 다운로드한 JSON 파일의 `client_email` 값을 복사
8. 데이터가 있는 Google Sheets를 열고 → **공유** → 위 이메일 주소 추가 (뷰어 권한)

#### 9-2. 환경변수 등록 (Claude가 도와줄 수 있음)

다운로드한 서비스 계정 JSON 파일을 base64로 변환해서 Vercel에 등록:

```bash
# PowerShell에서 실행
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\service-account.json"))
```

또는:
```bash
# CMD에서 실행
certutil -encode service-account.json encoded.txt
```

Vercel 환경변수 등록:
```bash
cd eland-dashboard
echo "<base64값>" | vercel env add GOOGLE_SERVICE_ACCOUNT_BASE64 production
```

#### 9-3. 테스트할 구글 시트 URL
```
https://docs.google.com/spreadsheets/d/1_emZayHRcvqfCnP4A0EYGE_56PiijKpaRg4oSkqStu4/edit?gid=788340876
```

---

## 10. 주요 파일 위치

```
eland-dashboard/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 메인 대시보드
│   │   └── api/
│   │       ├── import-sheets/route.ts  # ⭐ Google Sheets API 핵심
│   │       ├── sap-upload/route.ts     # Apps Script 수신용
│   │       ├── sales/route.ts          # 매출 조회
│   │       └── sheets-proxy/route.ts   # 공개시트 CORS 우회
│   ├── components/
│   │   ├── ui/
│   │   │   ├── SheetsImporter.tsx      # ⭐ Google Sheets 가져오기 UI
│   │   │   ├── FileUpload.tsx          # CSV/Excel 업로드
│   │   │   ├── FilterBar.tsx           # 필터
│   │   │   └── KpiCard.tsx             # KPI 카드
│   │   ├── charts/
│   │   │   ├── TrendChart.tsx          # 매출 추이 라인차트
│   │   │   ├── StoreBarChart.tsx       # 지점별 바차트
│   │   │   └── DivisionDonut.tsx       # 부문별 도넛차트
│   │   └── dashboard/
│   │       ├── RankTable.tsx           # 순위 테이블
│   │       └── InsightPanel.tsx        # 인사이트 요약
│   └── lib/
│       ├── parseSapPivot.ts            # ⭐ SAP 피벗 파싱 핵심 로직
│       ├── calculations.ts             # KPI 계산 (달성률/성장률/마진)
│       ├── parseFile.ts                # CSV/Excel 파싱
│       └── supabase.ts                 # Supabase 클라이언트
└── supabase/
    ├── schema.sql                      # DB 스키마
    └── apps-script.js                  # Google Apps Script (대안)
```

---

## 11. 로컬 실행 방법

```bash
cd eland-dashboard
npm install
# .env.local 파일에 환경변수 설정 후
npm run dev
# → http://localhost:3000
```

---

## 12. 다음 세션 시작 멘트 예시

> "이랜드 유통 매출 대시보드 프로젝트를 이어서 진행해줘.
> 레포: https://github.com/kimminjae1279-hash/eland.git
> PROJECT_STATUS.md 파일을 먼저 읽고 현재 상태를 파악한 뒤,
> Google Sheets API Service Account 환경변수 등록부터 시작해줘."
