'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Download } from 'lucide-react'
import FileUpload from '@/components/ui/FileUpload'
import FilterBar from '@/components/ui/FilterBar'
import KpiCard from '@/components/ui/KpiCard'
import TrendChart from '@/components/charts/TrendChart'
import StoreBarChart from '@/components/charts/StoreBarChart'
import DivisionDonut from '@/components/charts/DivisionDonut'
import RankTable from '@/components/dashboard/RankTable'
import InsightPanel from '@/components/dashboard/InsightPanel'
import {
  summarizeKpi, rankByStore, rankByDivision, rankByBrand,
  buildTrend, generateInsights, formatCurrency,
} from '@/lib/calculations'
import { SalesRecord, FilterState } from '@/types'
import { format, subDays } from 'date-fns'

const DEFAULT_FILTERS: FilterState = {
  date_from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  date_to: format(new Date(), 'yyyy-MM-dd'),
  brands: [],
  channels: [],
  divisions: [],
  stores: [],
}

export default function DashboardPage() {
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(false)
  const [uploadKey, setUploadKey] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.date_from) params.set('from', filters.date_from)
      if (filters.date_to) params.set('to', filters.date_to)
      filters.brands.forEach(b => params.append('brand', b))
      filters.channels.forEach(c => params.append('channel', c))
      filters.divisions.forEach(d => params.append('division', d))
      filters.stores.forEach(s => params.append('store', s))

      const res = await fetch(`/api/sales?${params.toString()}`)
      const json = await res.json()
      if (json.data) setRecords(json.data)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const filterOptions = useMemo(() => {
    const allRes = records
    return {
      brands: [...new Set(allRes.map(r => r.brand).filter(Boolean))].sort(),
      channels: [...new Set(allRes.map(r => r.channel).filter(Boolean))].sort(),
      divisions: [...new Set(allRes.map(r => r.division).filter(Boolean))].sort(),
      stores: [...new Set(allRes.map(r => r.store_name).filter(Boolean))].sort(),
    }
  }, [records])

  const kpi = useMemo(() => summarizeKpi(records), [records])
  const stores = useMemo(() => rankByStore(records), [records])
  const divisions = useMemo(() => rankByDivision(records), [records])
  const brands = useMemo(() => rankByBrand(records), [records])
  const trend = useMemo(() => buildTrend(records), [records])
  const insights = useMemo(() => generateInsights(kpi, stores, divisions, brands), [kpi, stores, divisions, brands])

  const handleUploadSuccess = () => {
    setUploadKey(k => k + 1)
    fetchData()
  }

  const handleReset = () => setFilters(DEFAULT_FILTERS)

  const handleCsvDownload = () => {
    if (!records.length) return
    const headers = ['지점코드', '지점명', '부문', '브랜드', '채널', '매출일자', '매출액', '목표액', '마진액', '전년매출']
    const rows = records.map(r => [
      r.store_code, r.store_name, r.division, r.brand, r.channel,
      r.sale_date, r.sales_amount, r.target_amount, r.margin_amount, r.ly_sales_amount,
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">이랜드 유통 매출 대시보드</h1>
            <p className="text-xs text-gray-400">CSO실 · 데이터 분석</p>
          </div>
          <button
            onClick={handleCsvDownload}
            disabled={!records.length}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV 다운로드
          </button>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 grid grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <FileUpload key={uploadKey} onSuccess={handleUploadSuccess} />
          <FilterBar
            filters={filters}
            options={filterOptions}
            onChange={setFilters}
            onReset={handleReset}
          />
        </aside>

        {/* Main content */}
        <main className="flex flex-col gap-6 min-w-0">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-sm text-gray-400">데이터 로딩 중...</span>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              title="총 매출"
              value={formatCurrency(kpi.total_sales) + '원'}
              sub={`목표 ${formatCurrency(kpi.total_target)}원`}
              trend="neutral"
            />
            <KpiCard
              title="목표 달성률"
              value={`${kpi.achievement_rate}%`}
              sub={kpi.achievement_rate >= 100 ? '목표 초과 달성' : `목표 대비 -${(100 - kpi.achievement_rate).toFixed(1)}%`}
              trend={kpi.achievement_rate >= 100 ? 'up' : 'down'}
              highlight={kpi.achievement_rate >= 100}
            />
            <KpiCard
              title="전년 대비 성장률"
              value={`${kpi.growth_rate > 0 ? '+' : ''}${kpi.growth_rate}%`}
              sub={`전년 ${formatCurrency(kpi.total_ly_sales)}원`}
              trend={kpi.growth_rate >= 0 ? 'up' : 'down'}
            />
            <KpiCard
              title="마진율"
              value={`${kpi.margin_rate}%`}
              sub={`마진 ${formatCurrency(kpi.total_margin)}원`}
              trend="neutral"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <TrendChart data={trend} />
            <StoreBarChart data={stores} title="지점별" />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-[1fr_2fr] gap-4">
            <DivisionDonut data={divisions} />
            <RankTable data={brands} title="브랜드별" />
          </div>

          {/* Store Rank Table */}
          <RankTable data={stores} title="지점별" />

          {/* Insights */}
          <InsightPanel insights={insights} />
        </main>
      </div>
    </div>
  )
}
