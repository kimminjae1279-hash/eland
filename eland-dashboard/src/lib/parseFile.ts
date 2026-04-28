import Papa from 'papaparse'
import * as XLSX from 'xlsx'
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

function normalizeRow(raw: Record<string, unknown>, fileName: string): SalesRecord | null {
  const record: Partial<SalesRecord> = { file_name: fileName }

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
    file_name: fileName,
  }
}

export async function parseFile(file: File): Promise<SalesRecord[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const records = (result.data as Record<string, unknown>[])
            .map(row => normalizeRow(row, file.name))
            .filter((r): r is SalesRecord => r !== null)
          resolve(records)
        },
        error: reject,
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    return rows
      .map(row => normalizeRow(row, file.name))
      .filter((r): r is SalesRecord => r !== null)
  }

  throw new Error('지원하지 않는 파일 형식입니다. CSV 또는 Excel 파일을 업로드해주세요.')
}
