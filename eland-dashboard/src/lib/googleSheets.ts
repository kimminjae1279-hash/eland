/**
 * Google Sheets 공유 URL → CSV export URL로 변환 후 데이터 파싱
 * 시트 공유 설정: "링크가 있는 모든 사용자 - 뷰어" 필요
 */

import Papa from 'papaparse'
import { SalesRecord } from '@/types'

const COLUMN_MAP: Record<string, keyof SalesRecord> = {
  '지점코드': 'store_code', 'store_code': 'store_code',
  '지점명': 'store_name', 'store_name': 'store_name',
  '부문': 'division', 'division': 'division',
  '브랜드': 'brand', 'brand': 'brand',
  '채널': 'channel', 'channel': 'channel',
  '매출일자': 'sale_date', '판매일자': 'sale_date', 'sale_date': 'sale_date',
  '매출액': 'sales_amount', 'sales_amount': 'sales_amount',
  '목표액': 'target_amount', '목표매출': 'target_amount', 'target_amount': 'target_amount',
  '마진액': 'margin_amount', '마진': 'margin_amount', 'margin_amount': 'margin_amount',
  '전년매출': 'ly_sales_amount', '전년동기': 'ly_sales_amount', 'ly_sales_amount': 'ly_sales_amount',
}

export function extractSheetId(url: string): { sheetId: string; gid: string } | null {
  // 지원 URL 형식:
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=GID
  // https://docs.google.com/spreadsheets/d/SHEET_ID/edit?usp=sharing
  const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) return null

  const sheetId = match[1]
  const gidMatch = url.match(/gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  return { sheetId, gid }
}

export function toCsvExportUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function normalizeRow(raw: Record<string, string>, source: string): SalesRecord | null {
  const record: Partial<SalesRecord> = { file_name: source }

  for (const [col, val] of Object.entries(raw)) {
    const key = COLUMN_MAP[col.trim()]
    if (!key) continue
    if (key === 'sales_amount' || key === 'target_amount' || key === 'margin_amount' || key === 'ly_sales_amount') {
      record[key] = Number(String(val).replace(/,/g, '')) || 0
    } else {
      record[key] = String(val ?? '').trim()
    }
  }

  if (!record.store_code || !record.sale_date || record.sales_amount === undefined) return null

  return {
    store_code: record.store_code ?? '',
    store_name: record.store_name ?? record.store_code ?? '',
    division: record.division ?? '',
    brand: record.brand ?? '',
    channel: record.channel ?? '',
    sale_date: record.sale_date ?? '',
    sales_amount: record.sales_amount ?? 0,
    target_amount: record.target_amount ?? 0,
    margin_amount: record.margin_amount ?? 0,
    ly_sales_amount: record.ly_sales_amount ?? 0,
    file_name: source,
  }
}

export async function fetchGoogleSheet(url: string): Promise<SalesRecord[]> {
  const parsed = extractSheetId(url)
  if (!parsed) throw new Error('올바른 Google Sheets URL이 아닙니다.')

  const csvUrl = toCsvExportUrl(parsed.sheetId, parsed.gid)

  // CORS 우회를 위해 Next.js API Route를 프록시로 사용
  const res = await fetch('/api/sheets-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvUrl }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? '구글 시트를 가져오지 못했습니다. 공유 설정을 확인해주세요.')
  }

  const csvText = await res.text()
  const source = `google_sheets_${parsed.sheetId}`

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const records = result.data
          .map(row => normalizeRow(row, source))
          .filter((r): r is SalesRecord => r !== null)
        resolve(records)
      },
      error: reject,
    })
  })
}
