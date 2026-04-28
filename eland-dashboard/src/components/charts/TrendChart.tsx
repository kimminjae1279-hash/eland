'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendPoint } from '@/types'
import { formatCurrency } from '@/lib/calculations'

interface Props {
  data: TrendPoint[]
}

export default function TrendChart({ data }: Props) {
  if (!data.length) return <Empty />

  const fmt = (v: number) => formatCurrency(v)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-bold text-gray-700 mb-4">매출 추이</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={60} />
          <Tooltip formatter={(v) => formatCurrency(Number(v)) + '원'} labelFormatter={l => l + ' 매출'} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="sales_amount" name="당기 매출" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ly_sales_amount" name="전년 매출" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Empty() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-center h-[296px]">
      <p className="text-sm text-gray-300">데이터가 없습니다</p>
    </div>
  )
}
