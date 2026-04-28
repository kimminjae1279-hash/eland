import { SalesRecord, KpiSummary, RankedItem, TrendPoint } from '@/types'

export function calcAchievementRate(sales: number, target: number): number {
  if (!target) return 0
  return Math.round((sales / target) * 1000) / 10
}

export function calcGrowthRate(sales: number, ly: number): number {
  if (!ly) return 0
  return Math.round(((sales - ly) / ly) * 1000) / 10
}

export function calcMarginRate(margin: number, sales: number): number {
  if (!sales) return 0
  return Math.round((margin / sales) * 1000) / 10
}

export function summarizeKpi(records: SalesRecord[]): KpiSummary {
  const total_sales = records.reduce((s, r) => s + r.sales_amount, 0)
  const total_target = records.reduce((s, r) => s + r.target_amount, 0)
  const total_margin = records.reduce((s, r) => s + r.margin_amount, 0)
  const total_ly_sales = records.reduce((s, r) => s + r.ly_sales_amount, 0)

  return {
    total_sales,
    total_target,
    total_margin,
    total_ly_sales,
    achievement_rate: calcAchievementRate(total_sales, total_target),
    growth_rate: calcGrowthRate(total_sales, total_ly_sales),
    margin_rate: calcMarginRate(total_margin, total_sales),
  }
}

function groupBy(records: SalesRecord[], key: keyof SalesRecord): RankedItem[] {
  const map = new Map<string, { sales: number; target: number; margin: number; ly: number }>()

  for (const r of records) {
    const k = String(r[key])
    const cur = map.get(k) ?? { sales: 0, target: 0, margin: 0, ly: 0 }
    map.set(k, {
      sales: cur.sales + r.sales_amount,
      target: cur.target + r.target_amount,
      margin: cur.margin + r.margin_amount,
      ly: cur.ly + r.ly_sales_amount,
    })
  }

  return Array.from(map.entries())
    .map(([name, v]) => ({
      name,
      sales_amount: v.sales,
      target_amount: v.target,
      margin_amount: v.margin,
      ly_sales_amount: v.ly,
      achievement_rate: calcAchievementRate(v.sales, v.target),
      growth_rate: calcGrowthRate(v.sales, v.ly),
      margin_rate: calcMarginRate(v.margin, v.sales),
      rank: 0,
    }))
    .sort((a, b) => b.sales_amount - a.sales_amount)
    .map((item, i) => ({ ...item, rank: i + 1 }))
}

export const rankByStore = (records: SalesRecord[]) => groupBy(records, 'store_name')
export const rankByDivision = (records: SalesRecord[]) => groupBy(records, 'division')
export const rankByBrand = (records: SalesRecord[]) => groupBy(records, 'brand')

export function buildTrend(records: SalesRecord[]): TrendPoint[] {
  const map = new Map<string, { sales: number; ly: number }>()

  for (const r of records) {
    const cur = map.get(r.sale_date) ?? { sales: 0, ly: 0 }
    map.set(r.sale_date, {
      sales: cur.sales + r.sales_amount,
      ly: cur.ly + r.ly_sales_amount,
    })
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      sales_amount: v.sales,
      ly_sales_amount: v.ly,
    }))
}

export function generateInsights(
  kpi: KpiSummary,
  stores: RankedItem[],
  divisions: RankedItem[],
  brands: RankedItem[]
): string[] {
  const insights: string[] = []

  if (kpi.achievement_rate >= 100) {
    insights.push(`전체 달성률 ${kpi.achievement_rate}%로 목표를 초과 달성했습니다.`)
  } else {
    insights.push(`전체 달성률 ${kpi.achievement_rate}%로 목표 대비 ${(100 - kpi.achievement_rate).toFixed(1)}% 미달입니다.`)
  }

  if (kpi.growth_rate > 0) {
    insights.push(`전년 대비 +${kpi.growth_rate}% 성장했습니다.`)
  } else if (kpi.growth_rate < 0) {
    insights.push(`전년 대비 ${kpi.growth_rate}% 감소했습니다.`)
  }

  const topStore = stores[0]
  const bottomStore = stores[stores.length - 1]
  if (topStore) insights.push(`지점 매출 1위: ${topStore.name} (${topStore.achievement_rate}% 달성)`)
  if (bottomStore && stores.length > 1) insights.push(`지점 매출 최하위: ${bottomStore.name} (${bottomStore.achievement_rate}% 달성)`)

  const topBrand = brands[0]
  if (topBrand) insights.push(`브랜드 매출 1위: ${topBrand.name} (성장률 ${topBrand.growth_rate > 0 ? '+' : ''}${topBrand.growth_rate}%)`)

  const lowAchievers = stores.filter(s => s.achievement_rate < 85)
  if (lowAchievers.length > 0) {
    insights.push(`달성률 85% 미만 지점 ${lowAchievers.length}개: ${lowAchievers.slice(0, 3).map(s => s.name).join(', ')}`)
  }

  return insights
}

export function formatCurrency(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억`
  if (amount >= 10_000) return `${(amount / 10_000).toFixed(0)}만`
  return amount.toLocaleString()
}
