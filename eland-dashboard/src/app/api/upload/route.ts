import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { records, fileName } = await req.json()

    if (!records || records.length === 0) {
      return NextResponse.json({ error: '업로드할 데이터가 없습니다.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('sales_records')
      .upsert(records, {
        onConflict: 'store_code,sale_date,brand',
        ignoreDuplicates: false,
      })

    if (error) throw error

    await supabase.from('upload_logs').insert({
      file_name: fileName,
      row_count: records.length,
      status: 'success',
    })

    return NextResponse.json({ success: true, count: records.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
