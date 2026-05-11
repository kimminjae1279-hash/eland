import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseSapPivot, DEFAULT_CONFIG, ParseConfig } from '@/lib/parseSapPivot'
import { google } from 'googleapis'

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

/**
 * POST /api/reprocess
 * body: { batchId?: string }
 *
 * batchId 없으면 → 모든 raw_sap_data를 fact_sales로 재변환
 * batchId 있으면 → 해당 batch만 재변환
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { batchId, config } = body as { batchId?: string; config?: Partial<ParseConfig> }

    const parseConfig: ParseConfig = { ...DEFAULT_CONFIG, ...config }

    // 1. raw_sap_data 조회
    let query = supabase.from('raw_sap_data').select('*').order('year_month')
    if (batchId) query = query.eq('batch_id', batchId)

    const { data: rawRows, error: fetchErr } = await query
    if (fetchErr) throw new Error('RAW 데이터 조회 실패: ' + fetchErr.message)
    if (!rawRows || rawRows.length === 0) {
      return NextResponse.json({ error: '재처리할 RAW 데이터가 없습니다.' }, { status: 404 })
    }

    // 2. JSONB daily_sales → fact_sales Long 형식으로 변환
    const factRecords: {
      store_code: string
      store_name: string
      brand_code: string
      brand_name: string
      division: string
      sale_date: string
      year: number
      month: number
      sales_amount: number
    }[] = []

    for (const raw of rawRows) {
      const dailySales = raw.daily_sales as Record<string, number>
      for (const [dateStr, amount] of Object.entries(dailySales)) {
        const [year, month] = dateStr.split('-').map(Number)
        factRecords.push({
          store_code:   raw.store_code,
          store_name:   raw.store_name,
          brand_code:   raw.brand_code,
          brand_name:   raw.brand_name,
          division:     raw.division,
          sale_date:    dateStr,
          year,
          month,
          sales_amount: amount,
        })
      }
    }

    // 3. fact_sales upsert (배치 1000건씩)
    const BATCH = 1000
    let upserted = 0
    for (let i = 0; i < factRecords.length; i += BATCH) {
      const slice = factRecords.slice(i, i + BATCH)
      const { error } = await supabase
        .from('fact_sales')
        .upsert(slice, { onConflict: 'store_code,brand_code,sale_date' })
      if (error) throw new Error('fact_sales upsert 실패: ' + error.message)
      upserted += slice.length
    }

    // 4. batch 상태 업데이트
    if (batchId) {
      await supabase.from('raw_upload_batches')
        .update({ status: 'processed', fact_count: upserted, updated_at: new Date().toISOString() })
        .eq('id', batchId)
    }

    return NextResponse.json({
      success:      true,
      rawRowCount:  rawRows.length,
      factCount:    upserted,
      batchId:      batchId ?? 'all',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[reprocess]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/reprocess
 * 업로드 배치 목록 조회
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('raw_upload_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)

    return NextResponse.json({ batches: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
