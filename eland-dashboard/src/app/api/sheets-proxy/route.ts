import { NextRequest, NextResponse } from 'next/server'

// 브라우저에서 구글 시트를 직접 fetch하면 CORS 오류가 발생하므로
// 서버(Next.js API Route)에서 대신 가져와 클라이언트에 전달
export async function POST(req: NextRequest) {
  try {
    const { csvUrl } = await req.json()

    if (!csvUrl?.startsWith('https://docs.google.com/spreadsheets/')) {
      return NextResponse.json({ error: '허용되지 않는 URL입니다.' }, { status: 400 })
    }

    const res = await fetch(csvUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `구글 시트를 가져오지 못했습니다 (${res.status}). 공유 설정을 확인해주세요.` },
        { status: 400 }
      )
    }

    const text = await res.text()

    // 빈 응답 또는 HTML(로그인 페이지) 반환 시 공유 설정 오류로 처리
    if (!text || text.trim().startsWith('<!DOCTYPE')) {
      return NextResponse.json(
        { error: '시트가 비공개 상태입니다. "링크가 있는 모든 사용자 - 뷰어"로 공유 설정을 변경해주세요.' },
        { status: 403 }
      )
    }

    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
