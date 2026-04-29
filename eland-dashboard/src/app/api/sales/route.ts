import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')
  const brands     = searchParams.getAll('brand')
  const divisions  = searchParams.getAll('division')
  const stores     = searchParams.getAll('store')
  const monthly    = searchParams.get('monthly') === 'true'

  // 월별 집계가 필요할 때는 view_sales_monthly 사용 (빠름)
  // 일별 상세가 필요할 때는 view_sales_yoy 사용 (YoY 자동 계산 포함)
  const viewName = monthly ? 'view_sales_monthly' : 'view_sales_yoy'

  let query = supabase.from(viewName).select('*')

  if (from) query = query.gte('sale_date', from)
  if (to)   query = query.lte('sale_date', to)
  if (brands.length)    query = query.in('brand_code', brands)
  if (divisions.length) query = query.in('division', divisions)
  if (stores.length)    query = query.in('store_code', stores)

  // 월별은 연/월 정렬, 일별은 날짜 정렬
  query = monthly
    ? query.order('year').order('month')
    : query.order('sale_date', { ascending: true })

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
