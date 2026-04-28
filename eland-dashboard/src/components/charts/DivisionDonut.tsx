'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RankedItem } from '@/types'
import { formatCurrency } from '@/lib/calculations'

const COLORS = ['#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#1e40af', '#1d4ed8', '#3b82f6']

interface Props {
  data: RankedItem[]
}

export default function DivisionDonut({ data }: Props) {
  if (!data.length) return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-center h-[280px]">
      <p className="text-sm text-gray-300">데이터가 없습니다</p>
    </div>
  )

  const chartData = data.map(d => ({ name: d.name, value: d.sales_amount }))
  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">부문별 매출 비중</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [formatCurrency(Number(v)) + '원', '매출']} />
          <Legend
            formatter={(value, entry) => {
              const pct = total ? ((entry.payload as { value: number }).value / total * 100).toFixed(1) : 0
              return `${value} (${pct}%)`
            }}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
