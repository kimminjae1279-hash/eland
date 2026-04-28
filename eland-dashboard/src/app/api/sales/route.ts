import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const brands = searchParams.getAll('brand')
  const channels = searchParams.getAll('channel')
  const divisions = searchParams.getAll('division')
  const stores = searchParams.getAll('store')

  let query = supabase.from('sales_records').select('*')

  if (from) query = query.gte('sale_date', from)
  if (to) query = query.lte('sale_date', to)
  if (brands.length) query = query.in('brand', brands)
  if (channels.length) query = query.in('channel', channels)
  if (divisions.length) query = query.in('division', divisions)
  if (stores.length) query = query.in('store_name', stores)

  query = query.order('sale_date', { ascending: true })

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
