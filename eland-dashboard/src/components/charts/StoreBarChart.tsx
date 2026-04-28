'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { RankedItem } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  data: RankedItem[]
  title: string
}

export default function StoreBarChart({ data, title }: Props) {
  if (!data.length) return <Empty title={title} />

  const top10 = data.slice(0, 10)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title} 매출 순위 (Top 10)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
          <Tooltip
            formatter={(v) => formatCurrency(Number(v)) + '원'}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as RankedItem
              return (
                <div className="bg-white border border-gray-100 shadow rounded p-3 text-xs space-y-1">
                  <p className="font-bold text-gray-800">{d.name}</p>
                  <p>매출: {formatCurrency(d.sales_amount)}원</p>
                  <p>달성률: <span className={d.achievement_rate >= 100 ? 'text-blue-600' : 'text-red-500'}>{d.achievement_rate}%</span></p>
                  <p>성장률: <span className={d.growth_rate >= 0 ? 'text-blue-600' : 'text-red-500'}>{d.growth_rate > 0 ? '+' : ''}{d.growth_rate}%</span></p>
                </div>
              )
            }}
          />
          <Bar dataKey="sales_amount" radius={[0, 4, 4, 0]}>
            {top10.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.achievement_rate >= 100 ? '#2563eb' : entry.achievement_rate >= 85 ? '#60a5fa' : '#fca5a5'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Empty({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-center h-[332px]">
      <p className="text-sm text-gray-300">{title} 데이터가 없습니다</p>
    </div>
  )
}
