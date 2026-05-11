'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sheet, Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, Database } from 'lucide-react'

interface Props {
  onSuccess: (count: number) => void
}

type Status = 'idle' | 'loading' | 'success' | 'error'

interface Progress {
  current: number
  total:   number
  batches: number
  done:    number
}

interface BatchRecord {
  id:          string
  source_file: string
  year_month:  string
  row_count:   number
  fact_count:  number
  status:      string
  created_at:  string
}

export default function SheetsImporter({ onSuccess }: Props) {
  const [url, setUrl]         = useState('')
  const [status, setStatus]   = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showBatches, setShowBatches]   = useState(false)
  const [batches, setBatches]           = useState<BatchRecord[]>([])
  const [reprocessingId, setReprocessingId] = useState<string | null>(null)

  // 컬럼 인덱스 설정 (기본값)
  const [cfg, setCfg] = useState({
    storeCodeCol: 0,
    storeNameCol: 1,
    divisionCol:  2,
    brandCodeCol: 3,
    brandNameCol: 4,
    totalCol:     5,
  })

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch('/api/reprocess')
      const json = await res.json()
      if (json.batches) setBatches(json.batches)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (showBatches) fetchBatches()
  }, [showBatches, fetchBatches])

  const handleImport = useCallback(async () => {
    if (!url.trim()) return
    setStatus('loading')
    setMessage('시트 데이터를 읽는 중...')
    setProgress(null)

    try {
      // 첫 요청으로 전체 건수 파악
      const first = await fetch('/api/import-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), config: cfg, batchStart: 0, batchSize: 2000 }),
      })
      const firstJson = await first.json()
      if (!first.ok) throw new Error(firstJson.error)

      const total   = firstJson.total  as number
      const batches = Math.ceil(total / 2000)

      setProgress({ current: firstJson.rawCount ?? firstJson.count, total, batches, done: 1 })
      setMessage(`${(firstJson.rawCount ?? firstJson.count).toLocaleString()} / ${total.toLocaleString()}건 저장 중...`)

      // 남은 배치 순차 처리
      let uploaded = firstJson.rawCount ?? firstJson.count
      for (let b = 1; b < batches; b++) {
        const res = await fetch('/api/import-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.trim(), config: cfg,
            batchStart: b * 2000, batchSize: 2000,
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        uploaded += json.rawCount ?? json.count
        setProgress({ current: uploaded, total, batches, done: b + 1 })
        setMessage(`${uploaded.toLocaleString()} / ${total.toLocaleString()}건 저장 중...`)
      }

      setStatus('success')
      setMessage(`✅ ${uploaded.toLocaleString()}건 저장 완료`)
      onSuccess(uploaded)
      if (showBatches) fetchBatches()
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '가져오기 실패')
    }
  }, [url, cfg, onSuccess, showBatches, fetchBatches])

  const handleReprocess = useCallback(async (batchId: string) => {
    setReprocessingId(batchId)
    try {
      const res = await fetch('/api/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await fetchBatches()
      onSuccess(json.factCount ?? 0)
    } catch (e) {
      alert(e instanceof Error ? e.message : '재처리 실패')
    } finally {
      setReprocessingId(null)
    }
  }, [fetchBatches, onSuccess])

  const isLoading = status === 'loading'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
          <Sheet className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Google Sheets API 연동</p>
          <p className="text-xs text-gray-400">서비스 계정으로 직접 읽기</p>
        </div>
      </div>

      {/* URL 입력 */}
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        disabled={isLoading}
        placeholder="https://docs.google.com/spreadsheets/d/..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700
          placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50"
      />

      {/* 진행률 */}
      {progress && (
        <div className="flex flex-col gap-1">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((progress.current / progress.total) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right">
            배치 {progress.done}/{progress.batches} · {progress.current.toLocaleString()}건
          </p>
        </div>
      )}

      {/* 상태 메시지 */}
      {status !== 'idle' && (
        <div className={`flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2
          ${status === 'success' ? 'bg-green-50 text-green-600'
          : status === 'error'   ? 'bg-red-50 text-red-500'
          : 'bg-blue-50 text-blue-500'}`}
        >
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
          {status === 'success' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          {status === 'error'   && <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* 고급 설정 (컬럼 인덱스) */}
      <button
        onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        컬럼 인덱스 설정 (기본값: SAP 표준 포맷)
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-3">
          {([
            ['지점코드 열 번호', 'storeCodeCol'],
            ['지점명 열 번호',   'storeNameCol'],
            ['구매그룹 열 번호 (-1=없음)', 'divisionCol'],
            ['브랜드코드 열 번호', 'brandCodeCol'],
            ['브랜드명 열 번호',   'brandNameCol'],
            ['합계 열 번호 (스킵)', 'totalCol'],
          ] as [string, keyof typeof cfg][]).map(([label, key]) => (
            <label key={key} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-500">{label}</span>
              <input
                type="number"
                value={cfg[key]}
                onChange={e => setCfg(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="border border-gray-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-green-300"
              />
            </label>
          ))}
          <p className="col-span-2 text-xs text-gray-400">※ 0부터 시작하는 열 번호 (A열=0, B열=1 ...)</p>
        </div>
      )}

      {/* 가져오기 버튼 */}
      <button
        onClick={status !== 'idle' && !isLoading ? () => { setStatus('idle'); setMessage(''); setProgress(null) } : handleImport}
        disabled={isLoading || !url.trim()}
        className={`w-full py-2 text-xs font-semibold text-white rounded-lg transition-colors
          flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed
          ${status === 'error' ? 'bg-gray-500 hover:bg-gray-600'
          : status === 'success' ? 'bg-gray-500 hover:bg-gray-600'
          : 'bg-green-600 hover:bg-green-700'}`}
      >
        {isLoading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 가져오는 중...</>
        ) : status === 'success' || status === 'error' ? (
          '다시 가져오기'
        ) : (
          <><Sheet className="w-3.5 h-3.5" /> 데이터 가져오기</>
        )}
      </button>

      {/* 업로드 배치 이력 */}
      <button
        onClick={() => setShowBatches(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Database className="w-3 h-3" />
        {showBatches ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        RAW 업로드 이력 {batches.length > 0 && `(${batches.length}건)`}
      </button>

      {showBatches && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {batches.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">업로드 이력이 없습니다.</p>
          ) : batches.map(b => (
            <div key={b.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{b.source_file}</p>
                <p className="text-xs text-gray-400">
                  {b.year_month} · RAW {b.row_count?.toLocaleString()}행 · fact {b.fact_count?.toLocaleString() ?? '-'}건
                </p>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0
                ${b.status === 'processed' ? 'bg-green-100 text-green-600'
                : b.status === 'error'     ? 'bg-red-100 text-red-500'
                : 'bg-yellow-100 text-yellow-600'}`}>
                {b.status === 'processed' ? '완료' : b.status === 'error' ? '오류' : '저장됨'}
              </span>
              <button
                onClick={() => handleReprocess(b.id)}
                disabled={reprocessingId === b.id}
                title="fact_sales 재변환"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-500 disabled:opacity-40 transition-colors"
              >
                {reprocessingId === b.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
