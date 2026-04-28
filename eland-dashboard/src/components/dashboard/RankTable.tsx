'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { RankedItem } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  data: RankedItem[]
  title: string
}

type SortKey = keyof RankedItem
type SortDir = 'asc' | 'desc'

export default function RankTable({ data, title }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => toggleSort(k)}
      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
    >
      <span className="flex items-center gap-0.5">
        {label}
        {sortKey === k
          ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3 text-gray-200" />}
      </span>
    </th>
  )

  if (!data.length) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title} 순위</h3>
      <p className="text-sm text-gray-300 text-center py-8">데이터가 없습니다</p>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title} 순위</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <Th label="#" k="rank" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">이름</th>
              <Th label="매출액" k="sales_amount" />
              <Th label="달성률" k="achievement_rate" />
              <Th label="성장률" k="growth_rate" />
              <Th label="마진율" k="margin_rate" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.name} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-3 py-2 text-gray-400 font-medium">{row.rank}</td>
                <td className="px-3 py-2 font-medium text-gray-800">
                  {row.rank <= 3 && <span className="mr-1">{'🥇🥈🥉'[row.rank - 1]}</span>}
                  {row.name}
                </td>
                <td className="px-3 py-2 text-gray-700 tabular-nums">{formatCurrency(row.sales_amount)}</td>
                <td className="px-3 py-2 tabular-nums">
                  <span className={`font-medium ${row.achievement_rate >= 100 ? 'text-blue-600' : row.achievement_rate >= 85 ? 'text-gray-700' : 'text-red-500'}`}>
                    {row.achievement_rate}%
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  <span className={`font-medium ${row.growth_rate >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {row.growth_rate > 0 ? '+' : ''}{row.growth_rate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600 tabular-nums">{row.margin_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
