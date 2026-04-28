'use client'

import { useCallback, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle, XCircle, Link } from 'lucide-react'
import { parseFile } from '@/lib/parseFile'
import { fetchGoogleSheet } from '@/lib/googleSheets'
import { SalesRecord } from '@/types'

interface FileUploadProps {
  onSuccess: (count: number) => void
}

type Status = 'idle' | 'parsing' | 'uploading' | 'success' | 'error'
type Tab = 'file' | 'sheets'

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [tab, setTab] = useState<Tab>('file')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [sheetsUrl, setSheetsUrl] = useState('')

  const uploadRecords = useCallback(async (records: SalesRecord[], fileName: string) => {
    if (records.length === 0) throw new Error('불러올 데이터가 없습니다. 컬럼명을 확인해주세요.')

    setStatus('uploading')
    setMessage(`${records.length}건 업로드 중...`)

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, fileName }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)

    setStatus('success')
    setMessage(`${json.count}건 업로드 완료`)
    onSuccess(json.count)
  }, [onSuccess])

  const handleFile = useCallback(async (file: File) => {
    setStatus('parsing')
    setMessage('파일을 분석하는 중...')
    try {
      const records: SalesRecord[] = await parseFile(file)
      await uploadRecords(records, file.name)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '업로드 실패')
    }
  }, [uploadRecords])

  const handleSheetsImport = useCallback(async () => {
    if (!sheetsUrl.trim()) return
    setStatus('parsing')
    setMessage('구글 시트를 불러오는 중...')
    try {
      const records = await fetchGoogleSheet(sheetsUrl.trim())
      await uploadRecords(records, `google_sheets_import`)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '가져오기 실패')
    }
  }, [sheetsUrl, uploadRecords])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const reset = () => { setStatus('idle'); setMessage('') }
  const isLoading = status === 'parsing' || status === 'uploading'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 탭 */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => { setTab('file'); reset() }}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
            ${tab === 'file' ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <UploadCloud className="w-3.5 h-3.5" /> 파일 업로드
        </button>
        <button
          onClick={() => { setTab('sheets'); reset() }}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors
            ${tab === 'sheets' ? 'text-green-600 border-b-2 border-green-500 bg-green-50/50' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <Link className="w-3.5 h-3.5" /> Google Sheets
        </button>
      </div>

      <div className="p-4">
        {/* 파일 업로드 탭 */}
        {tab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-gray-50'}`}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onInputChange}
              disabled={isLoading}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <StatusIcon status={status} defaultIcon={<UploadCloud className="w-7 h-7 text-gray-400" />} />
              <p className="text-xs font-medium text-gray-500">
                {status === 'idle' ? 'CSV · Excel 드래그 또는 클릭' : message}
              </p>
              {status !== 'idle' && !isLoading && (
                <button className="pointer-events-auto text-xs text-blue-500 underline" onClick={reset}>
                  다시 업로드
                </button>
              )}
            </div>
          </div>
        )}

        {/* 구글 시트 탭 */}
        {tab === 'sheets' && (
          <div className="flex flex-col gap-3">
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-700 leading-relaxed">
              <p className="font-semibold mb-1">사전 설정 필요</p>
              구글 시트 우상단 <strong>공유</strong> → <strong>링크가 있는 모든 사용자</strong> → <strong>뷰어</strong>로 설정 후 링크 복사
            </div>

            <input
              type="url"
              value={sheetsUrl}
              onChange={e => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={isLoading}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-300
                focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50"
            />

            {status !== 'idle' && (
              <div className={`flex items-center gap-2 text-xs font-medium rounded-lg px-3 py-2
                ${status === 'success' ? 'bg-green-50 text-green-600' : status === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                <StatusIcon status={status} defaultIcon={null} />
                {message}
              </div>
            )}

            <button
              onClick={handleSheetsImport}
              disabled={isLoading || !sheetsUrl.trim()}
              className="w-full py-2 text-xs font-semibold text-white bg-green-600 rounded-lg
                hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {isLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 가져오는 중...</>
                : '시트 데이터 가져오기'}
            </button>

            {status !== 'idle' && !isLoading && (
              <button className="text-xs text-gray-400 hover:text-blue-500 underline text-center" onClick={reset}>
                초기화
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status, defaultIcon }: { status: Status; defaultIcon: React.ReactNode }) {
  if (status === 'parsing' || status === 'uploading') return <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
  if (status === 'success') return <CheckCircle className="w-7 h-7 text-green-500" />
  if (status === 'error') return <XCircle className="w-7 h-7 text-red-400" />
  return <>{defaultIcon}</>
}
