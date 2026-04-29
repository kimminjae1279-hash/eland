import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { parseSapPivot, DEFAULT_CONFIG, ParseConfig } from '@/lib/parseSapPivot'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Service Account 인증 (환경변수에서 base64 디코딩)
function getGoogleAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_BASE64 환경변수가 설정되지 않았습니다.')

  const credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

// Google Sheets URL에서 spreadsheetId 추출
function extractSheetId(url: string): { spreadsheetId: string; gid: string } | null {
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return null
  const gidMatch = url.match(/gid=(\d+)/)
  return {
    spreadsheetId: match[1],
    gid: gidMatch ? gidMatch[1] : '0',
  }
}

// gid → 시트 이름 변환
async function getSheetName(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  gid: string
): Promise<string | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheet = meta.data.sheets?.find(
    s => String(s.properties?.sheetId) === gid
  )
  return sheet?.properties?.title ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      url,
      config,
      batchStart = 0,
      batchSize  = 2000,
    } = body as {
      url: string
      config?: Partial<ParseConfig>
      batchStart?: number
      batchSize?: number
    }

    if (!url) {
      return NextResponse.json({ error: 'Google Sheets URL이 필요합니다.' }, { status: 400 })
    }

    const parsed = extractSheetId(url)
    if (!parsed) {
      return NextResponse.json({ error: '올바른 Google Sheets URL이 아닙니다.' }, { status: 400 })
    }

    const { spreadsheetId, gid } = parsed

    // Google Sheets API 인증
    const auth   = getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })

    // 시트 이름 조회
    const sheetName = await getSheetName(sheets, spreadsheetId, gid) ?? 'Sheet1'

    // 전체 데이터 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
      valueRenderOption: 'UNFORMATTED_VALUE',   // 숫자를 그대로 숫자로 받음
      dateTimeRenderOption: 'FORMATTED_STRING',  // 날짜를 문자열로 받음
    })

    const rawRows = (response.data.values ?? []) as unknown[][]

    if (rawRows.length === 0) {
      return NextResponse.json({ error: '시트에 데이터가 없습니다.' }, { status: 400 })
    }

    // SAP 피벗 → Long 변환
    const parseConfig: ParseConfig = { ...DEFAULT_CONFIG, ...config }
    const allRecords = parseSapPivot(rawRows, parseConfig)

    if (allRecords.length === 0) {
      return NextResponse.json({
        error: '변환된 데이터가 없습니다. 컬럼 설정을 확인해주세요.',
        totalRows: rawRows.length,
      }, { status: 400 })
    }

    // 배치 단위로 Supabase upsert
    const batch = allRecords.slice(batchStart, batchStart + batchSize)
    const hasMore = batchStart + batchSize < allRecords.length

    const { error: dbError } = await supabase
      .from('fact_sales')
      .upsert(batch, { onConflict: 'store_code,brand_code,sale_date' })

    if (dbError) throw dbError

    // 첫 배치에서만 업로드 로그 기록
    if (batchStart === 0) {
      await supabase.from('upload_logs').insert({
        file_name:  `sheets:${spreadsheetId}/${sheetName}`,
        row_count:  allRecords.length,
        year_month: allRecords[0]
          ? `${allRecords[0].year}-${String(allRecords[0].month).padStart(2, '0')}`
          : null,
        status: 'success',
      })
    }

    return NextResponse.json({
      success:    true,
      count:      batch.length,
      total:      allRecords.length,
      batchStart,
      batchEnd:   batchStart + batch.length,
      hasMore,
      sheetName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[import-sheets]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
