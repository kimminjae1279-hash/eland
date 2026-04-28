export interface SalesRecord {
  id?: string
  store_code: string
  store_name: string
  division: string
  brand: string
  channel: string
  sale_date: string
  sales_amount: number
  target_amount: number
  margin_amount: number
  ly_sales_amount: number
  uploaded_at?: string
  file_name?: string
}

export interface KpiSummary {
  total_sales: number
  total_target: number
  total_margin: number
  total_ly_sales: number
  achievement_rate: number
  growth_rate: number
  margin_rate: number
}

export interface RankedItem {
  name: string
  sales_amount: number
  target_amount: number
  margin_amount: number
  ly_sales_amount: number
  achievement_rate: number
  growth_rate: number
  margin_rate: number
  rank: number
}

export interface TrendPoint {
  date: string
  sales_amount: number
  ly_sales_amount: number
}

export interface FilterState {
  date_from: string
  date_to: string
  brands: string[]
  channels: string[]
  divisions: string[]
  stores: string[]
}

export interface UploadLog {
  id: string
  file_name: string
  row_count: number
  uploaded_at: string
  status: 'success' | 'error'
  error_msg?: string
}
