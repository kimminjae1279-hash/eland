'use client'

import { RotateCcw } from 'lucide-react'
import { FilterState } from '@/types'

interface FilterBarProps {
  filters: FilterState
  options: {
    brands: string[]
    channels: string[]
    divisions: string[]
    stores: string[]
  }
  onChange: (f: FilterState) => void
  onReset: () => void
}

export default function FilterBar({ filters, options, onChange, onReset }: FilterBarProps) {
  const setField = <K extends keyof FilterState>(key: K, val: FilterState[K]) =>
    onChange({ ...filters, [key]: val })

  const toggleMulti = (key: 'brands' | 'channels' | 'divisions' | 'stores', val: string) => {
    const arr = filters[key] as string[]
    const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
    setField(key, next)
  }

  const MultiSelect = ({ label, optKey, values }: { label: string; optKey: 'brands' | 'channels' | 'divisions' | 'stores'; values: string[] }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase">{label}</label>
      <div className="flex flex-wrap gap-1">
        {values.map(v => {
          const active = (filters[optKey] as string[]).includes(v)
          return (
            <button
              key={v}
              onClick={() => toggleMulti(optKey, v)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors
                ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              {v}
            </button>
          )
        })}
        {values.length === 0 && <span className="text-xs text-gray-300">데이터 없음</span>}
      </div>
    </div>
  )

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">필터</span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> 초기화
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">시작일</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setField('date_from', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">종료일</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setField('date_to', e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      </div>

      <MultiSelect label="부문" optKey="divisions" values={options.divisions} />
      <MultiSelect label="채널" optKey="channels" values={options.channels} />
      <MultiSelect label="브랜드" optKey="brands" values={options.brands} />
      <MultiSelect label="지점" optKey="stores" values={options.stores} />
    </div>
  )
}
