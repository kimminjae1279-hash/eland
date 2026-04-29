import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface SapRecord {
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

export async function POST(req: NextRequest) {
  try {
    const { records, fileName } = await req.json() as { records: SapRecord[]; fileName: string }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: '업로드할 데이터가 없습니다.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('fact_sales')
      .upsert(records, {
        onConflict: 'store_code,brand_code,sale_date',
        ignoreDuplicates: false,
      })

    if (error) throw error

    await supabase.from('upload_logs').insert({
      file_name:  fileName,
      row_count:  records.length,
      year_month: records[0]
        ? `${records[0].year}-${String(records[0].month).padStart(2, '0')}`
        : null,
      status: 'success',
    })

    return NextResponse.json({ success: true, count: records.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
