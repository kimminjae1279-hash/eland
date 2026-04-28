'use client'

import { useCallback, useState } from 'react'
import { UploadCloud, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { parseFile } from '@/lib/parseFile'
import { SalesRecord } from '@/types'

interface FileUploadProps {
  onSuccess: (count: number) => void
}

type Status = 'idle' | 'parsing' | 'uploading' | 'success' | 'error'

export default function FileUpload({ onSuccess }: FileUploadProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setStatus('parsing')
    setMessage('파일을 분석하는 중...')
    try {
      const records: SalesRecord[] = await parseFile(file)
      setStatus('uploading')
      setMessage(`${records.length}건 업로드 중...`)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, fileName: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setStatus('success')
      setMessage(`${json.count}건 업로드 완료`)
      onSuccess(json.count)
    } catch (e) {
      setStatus('error')
      setMessage(e instanceof Error ? e.message : '업로드 실패')
    }
  }, [onSuccess])

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

  const isLoading = status === 'parsing' || status === 'uploading'

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer
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
        {isLoading && <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />}
        {status === 'success' && <CheckCircle className="w-8 h-8 text-green-500" />}
        {status === 'error' && <XCircle className="w-8 h-8 text-red-500" />}
        {status === 'idle' && <UploadCloud className="w-8 h-8 text-gray-400" />}
        <p className="text-sm font-medium text-gray-600">
          {status === 'idle' ? 'CSV 또는 Excel 파일을 드래그하거나 클릭하여 업로드' : message}
        </p>
        {status !== 'idle' && !isLoading && (
          <button
            className="pointer-events-auto text-xs text-blue-500 underline mt-1"
            onClick={() => setStatus('idle')}
          >
            다시 업로드
          </button>
        )}
      </div>
    </div>
  )
}
