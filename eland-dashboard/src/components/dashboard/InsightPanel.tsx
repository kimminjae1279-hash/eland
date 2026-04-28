'use client'

import { useState } from 'react'
import { Copy, Check, Lightbulb } from 'lucide-react'

interface Props {
  insights: string[]
}

export default function InsightPanel({ insights }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(insights.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!insights.length) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-bold text-gray-700">인사이트 요약</h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <ul className="space-y-2">
        {insights.map((text, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {i + 1}
            </span>
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
