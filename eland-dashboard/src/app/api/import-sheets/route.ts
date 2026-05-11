import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { parseSapPivot, DEFAULT_CONFIG, ParseConfig } from '@/lib/parseSapPivot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_BASE64 환경변수가 설정되지 않았습니다.')
  const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function extractSheetId(url: string) {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return null
  const gidMatch = url.match(/gid=(\d+)/)
  return { spreadsheetId: match[1], gid: gidMatch?.[1] ?? '0' }
}

async function getSheetName(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  gid: string
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  return (
    meta.data.sheets?.find(s => String(s.properties?.sheetId) === gid)
      ?.properties?.title ?? 'Sheet1'
  )
}

// Wide 포맷 RAW 행 → { "YYYY-MM-DD": amount } JSONB + total 생성
function buildDailySalesJson(
  row: unknown[],
  dateColMap: Map<number, string>,
  totalCol: number
): { dailySales: Record<string, number>; total: number } {
  const dailySales: Record<string, number> = {}
  let total = 0

  for (const [col, dateStr] of dateColMap.entries()) {
    if (col === totalCol) continue
    const val = row[col]
    const amount = typeof val === 'number' ? val : Number(String(val ?? '').replace(/,/g, '')) || 0
    dailySales[dateStr] = amount
  }

  const rawTotal = row[totalCol]
  total = typeof rawTotal === 'number' ? rawTotal : Number(String(rawTotal ?? '').replace(/,/g, '')) || 0

  return { dailySales, total }
}

// SAP 피벗 → RAW 행 배열 (Wide 유지, JSONB)
function toRawRows(
  rows: unknown[][],
  config: ParseConfig,
  batchId: string,
  sourceFile: string
) {
  const SKIP = ['전체 결과', '결과', 'Total', '합계', '소계']
  const DIVISION_MAP: Record<string, string> = {
    '잡화': '잡화', '여성': '여성', '영캐': '영캐',
    '남성': '남성', '스포츠': '스포츠', '아동': '아동',
  }

  // 날짜 컬럼 탐지
  const dateColMap = new Map<number, string>()
  let dataStartRow = 0

  for (let r = 0; r < Math.min(8, rows.length); r++) {
    let found = false
    for (let c = 0; c < rows[r].length; c++) {
      const s = String(rows[r][c] ?? '').trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        dateColMap.set(c, s); found = true
      }
    }
    if (found) dataStartRow = r + 1
  }

  if (dateColMap.size === 0) throw new Error('날짜 컬럼을 찾지 못했습니다.')

  // year_month 추출 (첫 날짜 기준)
  const firstDate = dateColMap.values().next().value as string
  const yearMonth = firstDate.slice(0, 7) // '2025-01'

  const rawRows = []
  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r]
    const storeCode = String(row[config.storeCodeCol] ?? '').trim()
    const storeName = String(row[config.storeNameCol] ?? '').trim()
    const brandCode = String(row[config.brandCodeCol] ?? '').trim()
    const brandName = String(row[config.brandNameCol] ?? '').trim()
    const divRaw    = config.divisionCol >= 0
      ? String(row[config.divisionCol] ?? '').trim() : ''
    const division  = DIVISION_MAP[divRaw] ?? divRaw

    if (!storeCode || !brandCode) continue
    if (SKIP.some(k => storeCode.includes(k) || brandCode.includes(k))) continue

    const { dailySales, total } = buildDailySalesJson(row, dateColMap, config.totalCol)

    rawRows.push({
      batch_id:     batchId,
      store_code:   storeCode,
      store_name:   storeName,
      brand_code:   brandCode,
      brand_name:   brandName,
      division,
      year_month:   yearMonth,
      daily_sales:  dailySales,
      total_amount: total,
      source_file:  sourceFile,
    })
  }

  return { rawRows, yearMonth }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, config, batchStart = 0, batchSize = 500 } = body as {
      url: string
      config?: Partial<ParseConfig>
      batchStart?: number
      batchSize?: number
    }

    if (!url) return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 })

    const parsed = extractSheetId(url)
    if (!parsed) return NextResponse.json({ error: '올바른 Google Sheets URL이 아닙니다.' }, { status: 400 })

    const auth   = getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const sheetName = await getSheetName(sheets, parsed.spreadsheetId, parsed.gid)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId:       parsed.spreadsheetId,
      range:               sheetName,
      valueRenderOption:   'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })

    const rawRows2D = (response.data.values ?? []) as unknown[][]
    if (!rawRows2D.length) return NextResponse.json({ error: '시트에 데이터가 없습니다.' }, { status: 400 })

    const parseConfig: ParseConfig = { ...DEFAULT_CONFIG, ...config }

    // ── 1단계: RAW 저장 ──────────────────────────────────
    const batchId = crypto.randomUUID()
    const { rawRows, yearMonth } = toRawRows(rawRows2D, parseConfig, batchId, sheetName)

    if (rawRows.length === 0) {
      return NextResponse.json({ error: '변환된 데이터가 없습니다. 컬럼 설정을 확인해주세요.' }, { status: 400 })
    }

    // RAW 배치 메타 등록
    await supabase.from('raw_upload_batches').insert({
      id:          batchId,
      source_url:  url,
      source_file: sheetName,
      year_month:  yearMonth,
      row_count:   rawRows.length,
      status:      'raw_saved',
    })

    // RAW 데이터 upsert (배치 단위)
    const rawBatch = rawRows.slice(batchStart, batchStart + batchSize)
    const { error: rawErr } = await supabase
      .from('raw_sap_data')
      .upsert(rawBatch, { onConflict: 'store_code,brand_code,year_month' })

    if (rawErr) throw new Error('RAW 저장 실패: ' + rawErr.message)

    // ── 2단계: fact_sales 변환 저장 ───────────────────────
    const factRecords = parseSapPivot(rawRows2D, parseConfig)
    const factBatch   = factRecords.slice(batchStart * 31, (batchStart + batchSize) * 31)

    const { error: factErr } = await supabase
      .from('fact_sales')
      .upsert(factBatch, { onConflict: 'store_code,brand_code,sale_date' })

    if (factErr) throw new Error('fact_sales 저장 실패: ' + factErr.message)

    const hasMore = batchStart + batchSize < rawRows.length

    // 마지막 배치에서 배치 상태 업데이트
    if (!hasMore) {
      await supabase.from('raw_upload_batches')
        .update({ status: 'processed', fact_count: factRecords.length })
        .eq('id', batchId)
    }

    return NextResponse.json({
      success:    true,
      batchId,
      rawCount:   rawBatch.length,
      factCount:  factBatch.length,
      total:      rawRows.length,
      batchStart,
      batchEnd:   batchStart + rawBatch.length,
      hasMore,
      yearMonth,
      sheetName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[import-sheets]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
