/**
 * 이랜드 유통 매출 대시보드 - Google Apps Script
 *
 * [사용 방법]
 * 1. 구글 시트 열기 → 확장 프로그램 → Apps Script
 * 2. 이 코드 전체를 붙여넣기
 * 3. CONFIG 설정값 확인 후 저장
 * 4. 시트로 돌아가서 상단 메뉴 [대시보드 업로드] → [이번 달 데이터 업로드] 클릭
 *
 * [SAP 피벗 시트 컬럼 구조 (0-based index)]
 * 0: 플랜트 (지점코드)
 * 1: 중계점명 (지점명)
 * 2: 구매그룹 (부문)   ← 없으면 CONFIG.DIVISION_COL = -1 로 설정
 * 3: 브랜드(Now) 코드
 * 4: 상세분류 (브랜드명)
 * 5: 합계 (스킵)
 * 6~: 날짜별 매출 (2025-01-01, 2025-01-02 ...)
 */

// ===== 설정 =====
const CONFIG = {
  API_URL: 'https://eland-dashboard-gold.vercel.app/api/sap-upload',

  // SAP 시트 컬럼 인덱스 (0부터 시작)
  STORE_CODE_COL:  0,   // 플랜트
  STORE_NAME_COL:  1,   // 중계점명
  DIVISION_COL:    2,   // 구매그룹 (없으면 -1)
  BRAND_CODE_COL:  3,   // 브랜드(Now) 코드
  BRAND_NAME_COL:  4,   // 상세분류 (브랜드명)
  TOTAL_COL:       5,   // 합계 컬럼 (스킵)
  DATE_START_COL:  6,   // 첫 번째 날짜 컬럼 시작 인덱스

  // 헤더 탐지용 키워드 (이 값이 있는 행을 헤더로 인식)
  HEADER_KEYWORD:  '플랜트',

  // 스킵할 행 키워드 (합계/소계 행)
  SKIP_KEYWORDS: ['전체 결과', '결과', 'Total', '합계', '소계'],

  // 배치 크기 (한 번에 전송할 행 수 - 너무 크면 timeout)
  BATCH_SIZE: 500,
}

// 부문 매핑 (구매그룹 값 → 표준 부문명)
const DIVISION_MAP = {
  '잡화': '잡화', '여성': '여성', '영캐': '영캐',
  '남성': '남성', '스포츠': '스포츠', '아동': '아동',
  // 추가 매핑이 필요하면 여기에 입력
}

// ===== 메뉴 생성 =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📊 대시보드 업로드')
    .addItem('✅ 현재 시트 데이터 업로드', 'uploadCurrentSheet')
    .addSeparator()
    .addItem('⚙️ 컬럼 구조 자동 감지 (테스트)', 'detectColumns')
    .addItem('📋 업로드 미리보기 (5행)', 'previewData')
    .addToUi()
}

// ===== 컬럼 자동 감지 =====
function detectColumns() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  const data = sheet.getDataRange().getValues()

  let headerRow = -1
  let dateStartCol = -1
  const dates = []

  // 헤더 행 찾기
  for (let r = 0; r < Math.min(10, data.length); r++) {
    for (let c = 0; c < data[r].length; c++) {
      if (String(data[r][c]).includes(CONFIG.HEADER_KEYWORD)) {
        headerRow = r
        break
      }
    }
    if (headerRow !== -1) break
  }

  if (headerRow === -1) {
    SpreadsheetApp.getUi().alert('❌ 헤더 행을 찾지 못했습니다.\n"' + CONFIG.HEADER_KEYWORD + '" 텍스트가 있는 행이 필요합니다.')
    return
  }

  // 날짜 컬럼 찾기 (2025-XX-XX 또는 날짜 형식)
  for (let r = 0; r < Math.min(5, data.length); r++) {
    for (let c = 0; c < data[r].length; c++) {
      const val = String(data[r][c])
      if (/^\d{4}-\d{2}-\d{2}$/.test(val) || (data[r][c] instanceof Date)) {
        if (dateStartCol === -1) dateStartCol = c
        dates.push(val)
      }
    }
    if (dates.length > 0) break
  }

  const msg = [
    '✅ 컬럼 감지 결과',
    '헤더 행: ' + (headerRow + 1) + '행',
    '날짜 시작 컬럼: ' + dateStartCol + '번째',
    '날짜 개수: ' + dates.length + '개',
    '첫 날짜: ' + dates[0],
    '마지막 날짜: ' + dates[dates.length - 1],
  ].join('\n')

  SpreadsheetApp.getUi().alert(msg)
}

// ===== 데이터 미리보기 =====
function previewData() {
  const records = parseSheet(5)
  if (!records) return

  const preview = records.slice(0, 5).map((r, i) =>
    `${i+1}. ${r.store_code} ${r.store_name} | ${r.brand_code} ${r.brand_name} | ${r.division} | ${r.sale_date} | ${r.sales_amount.toLocaleString()}원`
  ).join('\n')

  SpreadsheetApp.getUi().alert(
    `✅ 변환 미리보기 (상위 5건)\n총 ${records.length}건 감지\n\n${preview}`
  )
}

// ===== 메인: 현재 시트 업로드 =====
function uploadCurrentSheet() {
  const ui = SpreadsheetApp.getUi()
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  const sheetName = sheet.getName()

  const confirm = ui.alert(
    '📊 데이터 업로드',
    `시트 "${sheetName}"의 데이터를 대시보드에 업로드하시겠습니까?\n\n(중복 데이터는 자동으로 덮어씁니다)`,
    ui.ButtonSet.OK_CANCEL
  )
  if (confirm !== ui.Button.OK) return

  try {
    ui.alert('⏳ 데이터 변환 중... (잠시 기다려주세요)')

    const records = parseSheet()
    if (!records || records.length === 0) {
      ui.alert('❌ 변환된 데이터가 없습니다. 컬럼 설정을 확인해주세요.')
      return
    }

    // 배치 전송
    const batches = []
    for (let i = 0; i < records.length; i += CONFIG.BATCH_SIZE) {
      batches.push(records.slice(i, i + CONFIG.BATCH_SIZE))
    }

    let totalUploaded = 0
    for (let i = 0; i < batches.length; i++) {
      const result = sendBatch(batches[i], sheetName)
      if (!result.success) {
        ui.alert(`❌ ${i+1}번째 배치 전송 실패\n${result.error}`)
        return
      }
      totalUploaded += result.count
      // 진행률 로그
      Logger.log(`배치 ${i+1}/${batches.length} 완료 (${totalUploaded}건)`)
    }

    ui.alert(`✅ 업로드 완료!\n\n총 ${totalUploaded.toLocaleString()}건이 대시보드 DB에 저장되었습니다.`)

  } catch (e) {
    ui.alert('❌ 오류 발생\n' + e.message)
    Logger.log('Error: ' + e.toString())
  }
}

// ===== SAP 피벗 시트 파싱 (Wide → Long 변환) =====
function parseSheet(maxRows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
  const data = sheet.getDataRange().getValues()

  // 1. 헤더 행 찾기
  let headerRow = -1
  let dateRow = -1
  const dateColMap = {}  // { colIndex: 'YYYY-MM-DD' }

  for (let r = 0; r < Math.min(10, data.length); r++) {
    // 날짜 행 탐지
    for (let c = 0; c < data[r].length; c++) {
      const val = data[r][c]
      const dateStr = toDateString(val)
      if (dateStr) {
        dateColMap[c] = dateStr
        if (dateRow === -1) dateRow = r
      }
    }
    // 헤더 행 탐지
    if (String(data[r][CONFIG.STORE_CODE_COL]).includes(CONFIG.HEADER_KEYWORD)) {
      headerRow = r
    }
  }

  if (Object.keys(dateColMap).length === 0) {
    SpreadsheetApp.getUi().alert('❌ 날짜 컬럼을 찾지 못했습니다.')
    return null
  }

  const dataStartRow = Math.max(headerRow, dateRow) + 1
  const records = []
  const limit = maxRows ? dataStartRow + maxRows : data.length

  // 2. 데이터 행 순회
  for (let r = dataStartRow; r < Math.min(limit, data.length); r++) {
    const row = data[r]

    const storeCode  = String(row[CONFIG.STORE_CODE_COL] || '').trim()
    const storeName  = String(row[CONFIG.STORE_NAME_COL] || '').trim()
    const brandCode  = String(row[CONFIG.BRAND_CODE_COL] || '').trim()
    const brandName  = String(row[CONFIG.BRAND_NAME_COL] || '').trim()
    const divisionRaw = CONFIG.DIVISION_COL >= 0
      ? String(row[CONFIG.DIVISION_COL] || '').trim()
      : ''
    const division = DIVISION_MAP[divisionRaw] || divisionRaw

    // 스킵 조건: 합계행, 빈 행, 코드 없는 행
    if (!storeCode || !brandCode) continue
    if (CONFIG.SKIP_KEYWORDS.some(kw => storeCode.includes(kw) || brandCode.includes(kw))) continue
    if (brandCode === '결과' || brandCode === 'Total') continue

    // 3. 날짜별 Wide → Long 변환
    for (const [colStr, dateStr] of Object.entries(dateColMap)) {
      const col = parseInt(colStr)
      if (col === CONFIG.TOTAL_COL) continue  // 합계 컬럼 스킵

      const rawVal = row[col]
      const salesAmount = parseNumber(rawVal)

      // 0원도 저장 (영업일 데이터 보존)
      const [year, month] = dateStr.split('-').map(Number)

      records.push({
        store_code:   storeCode,
        store_name:   storeName,
        brand_code:   brandCode,
        brand_name:   brandName,
        division:     division,
        sale_date:    dateStr,
        year:         year,
        month:        month,
        sales_amount: salesAmount,
      })
    }
  }

  return records
}

// ===== API 배치 전송 =====
function sendBatch(records, fileName) {
  try {
    const payload = JSON.stringify({ records, fileName })
    const response = UrlFetchApp.fetch(CONFIG.API_URL, {
      method: 'POST',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true,
    })

    const code = response.getResponseCode()
    const body = JSON.parse(response.getContentText())

    if (code !== 200) {
      return { success: false, error: body.error || '서버 오류 ' + code }
    }
    return { success: true, count: body.count }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ===== 유틸리티 =====
function toDateString(val) {
  if (!val) return null
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    if (y < 2020 || y > 2030) return null
    return `${y}-${m}-${d}`
  }
  const str = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-')
  return null
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const n = Number(String(val).replace(/[,\s₩]/g, ''))
  return isNaN(n) ? 0 : n
}
