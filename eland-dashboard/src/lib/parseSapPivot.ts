/**
 * SAP 피벗 형식 파싱 (Wide → Long 변환)
 *
 * SAP 내보내기 구조:
 * Row 0: "총 매출액" 반복
 * Row 1: (빈칸) / "일" / 날짜들 (2025-01-01 ...)
 * Row 2: "플랜트" / "브랜드(Now)" / "KRW" ...
 * Row 3: "전체 결과" (합계행 - 스킵)
 * Row 4+: 실제 데이터
 */

export interface SapRow {
  store_code:   string
  store_name:   string
  brand_code:   string
  brand_name:   string
  division:     string
  sale_date:    string
  year:         number
  month:        number
  sales_amount: number
}

const DIVISION_MAP: Record<string, string> = {
  '잡화': '잡화', '여성': '여성', '영캐': '영캐',
  '남성': '남성', '스포츠': '스포츠', '아동': '아동',
}

const SKIP_KEYWORDS = ['전체 결과', '결과', 'Total', '합계', '소계']

// 셀 값 → YYYY-MM-DD 문자열 변환
function toDateStr(val: unknown): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
  // 숫자 시리얼(Excel date) 처리
  const n = Number(s)
  if (!isNaN(n) && n > 40000 && n < 50000) {
    const d = new Date((n - 25569) * 86400 * 1000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    if (y >= 2020 && y <= 2030) return `${y}-${m}-${day}`
  }
  return null
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const n = Number(String(val).replace(/[,\s₩]/g, ''))
  return isNaN(n) ? 0 : n
}

function shouldSkip(val: unknown): boolean {
  const s = String(val ?? '').trim()
  return !s || SKIP_KEYWORDS.some(kw => s.includes(kw))
}

export interface ParseConfig {
  storeCodeCol:  number   // 플랜트 컬럼 인덱스
  storeNameCol:  number   // 중계점명 컬럼 인덱스
  divisionCol:   number   // 구매그룹 컬럼 인덱스 (-1이면 없음)
  brandCodeCol:  number   // 브랜드(Now) 컬럼 인덱스
  brandNameCol:  number   // 상세분류 컬럼 인덱스
  totalCol:      number   // 합계 컬럼 인덱스 (스킵용)
}

export const DEFAULT_CONFIG: ParseConfig = {
  storeCodeCol:  0,
  storeNameCol:  1,
  divisionCol:   2,   // -1로 바꾸면 부문 컬럼 없는 경우
  brandCodeCol:  3,
  brandNameCol:  4,
  totalCol:      5,
}

export function parseSapPivot(
  rows: unknown[][],
  config: ParseConfig = DEFAULT_CONFIG
): SapRow[] {
  if (!rows || rows.length === 0) return []

  // 1. 날짜 컬럼 맵 탐지 { colIndex → 'YYYY-MM-DD' }
  const dateColMap = new Map<number, string>()
  let dataStartRow = 0

  for (let r = 0; r < Math.min(8, rows.length); r++) {
    const row = rows[r]
    let foundDateInRow = false
    for (let c = 0; c < row.length; c++) {
      const d = toDateStr(row[c])
      if (d) {
        dateColMap.set(c, d)
        foundDateInRow = true
      }
    }
    if (foundDateInRow) dataStartRow = r + 1
  }

  if (dateColMap.size === 0) {
    throw new Error('날짜 컬럼을 찾지 못했습니다. 시트에 YYYY-MM-DD 형식의 날짜가 있는지 확인해주세요.')
  }

  // 2. 데이터 행 순회 → Wide → Long 변환
  const result: SapRow[] = []

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r]

    const storeCode  = String(row[config.storeCodeCol] ?? '').trim()
    const storeName  = String(row[config.storeNameCol] ?? '').trim()
    const brandCode  = String(row[config.brandCodeCol] ?? '').trim()
    const brandName  = String(row[config.brandNameCol] ?? '').trim()
    const divRaw     = config.divisionCol >= 0
      ? String(row[config.divisionCol] ?? '').trim()
      : ''
    const division   = DIVISION_MAP[divRaw] ?? divRaw

    // 스킵: 빈 행, 합계 행, 코드 없는 행
    if (!storeCode || !brandCode) continue
    if (shouldSkip(storeCode) || shouldSkip(brandCode)) continue

    for (const [col, dateStr] of dateColMap.entries()) {
      if (col === config.totalCol) continue   // 합계 컬럼 스킵

      const salesAmount = toNumber(row[col])
      const [year, month] = dateStr.split('-').map(Number)

      result.push({
        store_code:   storeCode,
        store_name:   storeName,
        brand_code:   brandCode,
        brand_name:   brandName,
        division,
        sale_date:    dateStr,
        year,
        month,
        sales_amount: salesAmount,
      })
    }
  }

  return result
}
