'use client'

interface KpiCardProps {
  title: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  highlight?: boolean
}

export default function KpiCard({ title, value, sub, trend, highlight }: KpiCardProps) {
  const trendColor =
    trend === 'up' ? 'text-blue-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 flex flex-col gap-1 ${highlight ? 'border-blue-400' : 'border-gray-100'}`}>
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className={`text-sm font-medium ${trendColor}`}>{sub}</span>}
    </div>
  )
}
