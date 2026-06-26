"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp, Package, DollarSign, RefreshCw, BarChart3,
  Download, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  Users, Truck, Banknote,
} from "lucide-react"
import RevenueBarChart, { type RevenueTrendPoint } from "@/components/charts/RevenueBarChart"
import OrderStatusChart from "@/components/charts/OrderStatusChart"
import TopProductsChart from "@/components/charts/TopProductsChart"
import { useTranslations } from "next-intl"

interface AgingBucket { count: number; amount: number }

interface ReportData {
  revenue: { total: number; thisMonth: number; lastMonth: number }
  orders:  { total: number; delivered: number; pending: number; cancelled: number }
  products:{ total: number; lowStock: number; outOfStock: number }
  topProducts: { name: string; totalSold: number; revenue: number }[]
  monthlyTrend: RevenueTrendPoint[]
  pnl: {
    month:       string
    revenue:     number
    cogs:        number
    grossProfit: number
    grossMargin: number
    expenses:    number
    profit:      number
    margin:      number
    taxCollected:number
  }
  ar: {
    total: number
    aging: {
      current:   AgingBucket
      days1_30:  AgingBucket
      days31_60: AgingBucket
      days60plus:AgingBucket
    }
  }
  ap: {
    total:      number
    bySupplier: { name: string; outstanding: number }[]
  }
  cashFlow: {
    cashIn:           number
    cashOutSuppliers: number
    expenses:         number
    net:              number
  }
}

function fmt(amount: number) {
  if (amount >= 1000000) return `RWF ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000)    return `RWF ${(amount / 1000).toFixed(0)}K`
  return `RWF ${amount.toLocaleString()}`
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
      {children}
    </h2>
  )
}

export default function ReportsPage() {
  const t       = useTranslations("reports")
  const tCommon = useTranslations("common")

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [data,      setData]      = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState("")
  const [pnlMonth,  setPnlMonth]  = useState(currentMonth)
  const [key,       setKey]       = useState(0)

  useEffect(() => {
    fetch(`/api/reports?month=${pnlMonth}`)
      .then(r => r.json())
      .then(json => { setData(json); setError(""); setIsLoading(false) })
      .catch(() => { setError(t("failedToLoad")); setIsLoading(false) })
  }, [pnlMonth, key, t])

  function triggerRefresh() { setIsLoading(true); setKey(k => k + 1) }
  function changeMonth(m: string) { setIsLoading(true); setPnlMonth(m) }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <BarChart3 size={40} className="text-baraka-sage/40" />
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={triggerRefresh}
          className="text-sm text-baraka-primary hover:underline"
        >
          {tCommon("tryAgain")}
        </button>
      </div>
    )
  }

  const deliveryRate = data.orders.total > 0
    ? Math.round((data.orders.delivered / data.orders.total) * 100)
    : 0

  const momChange = data.revenue.lastMonth > 0
    ? Math.round(((data.revenue.thisMonth - data.revenue.lastMonth) / data.revenue.lastMonth) * 100)
    : 0

  const { pnl, ar, ap, cashFlow } = data

  const EXPORT_ITEMS = [
    { label: t("exportProducts"),     type: "products"        },
    { label: t("exportOrders"),       type: "orders"          },
    { label: t("exportCustomers"),    type: "customers"       },
    { label: t("exportExpenses"),     type: "expenses"        },
    { label: t("exportStockLog"),     type: "stock-movements" },
    { label: t("exportCreditNotes"),  type: "credit-notes"    },
  ]

  return (
    <div className="space-y-8">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("performanceOverview")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {EXPORT_ITEMS.map(e => (
              <button
                key={e.type}
                onClick={() => window.open(`/api/export?type=${e.type}`, "_blank")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-baraka-primary hover:border-baraka-primary/40 transition-colors"
              >
                <Download size={12} />
                {e.label}
              </button>
            ))}
          </div>
          <button
            onClick={triggerRefresh}
            className="flex items-center gap-2 text-sm text-baraka-sage hover:text-baraka-primary transition-colors"
          >
            <RefreshCw size={15} />
            {tCommon("refresh")}
          </button>
        </div>
      </div>

      {/* ── REVENUE ── */}
      <div>
        <SectionTitle>{t("sectionRevenue")}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign size={18} className="text-emerald-600" />
              </div>
              <p className="text-sm text-[var(--muted)]">{t("revenueLabel")}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">{fmt(data.revenue.total)}</p>
            <p className="text-xs text-baraka-sage mt-1">{t("fromAllDelivered")}</p>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <p className="text-sm text-[var(--muted)]">{t("thisMonth")}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">{fmt(data.revenue.thisMonth)}</p>
            <p className={`text-xs mt-1 font-medium ${momChange >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {momChange >= 0 ? "+" : ""}{momChange}% {t("vsLastMonth")}
            </p>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-baraka-sage/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-baraka-primary" />
              </div>
              <p className="text-sm text-[var(--muted)]">{t("lastMonth")}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">{fmt(data.revenue.lastMonth)}</p>
            <p className="text-xs text-baraka-sage mt-1">{t("previousMonthTotal")}</p>
          </div>
        </div>
      </div>

      {/* ── ORDERS ── */}
      <div>
        <SectionTitle>{t("sectionOrders")}</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("totalOrders"),  value: data.orders.total,     color: "text-[var(--foreground)]" },
            { label: t("delivered"),    value: data.orders.delivered, color: "text-emerald-600" },
            { label: t("pending"),      value: data.orders.pending,   color: "text-yellow-600" },
            { label: t("cancelled"),    value: data.orders.cancelled, color: "text-red-500" },
          ].map(item => (
            <div key={item.label} className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <p className="text-xs text-[var(--muted)] mb-2">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-[var(--foreground)]">{t("deliveryRate")}</p>
            <span className="text-sm font-bold text-emerald-600">{deliveryRate}%</span>
          </div>
          <div className="w-full bg-[var(--background)] rounded-full h-2.5">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            {t("ordersDeliveredOf", { delivered: data.orders.delivered, total: data.orders.total })}
          </p>
        </div>
      </div>

      {/* ── INVENTORY ── */}
      <div>
        <SectionTitle>{t("sectionInventory")}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t("totalProducts"), value: data.products.total,      color: "text-[var(--foreground)]" },
            { label: t("lowStock"),      value: data.products.lowStock,   color: "text-yellow-600" },
            { label: t("outOfStock"),    value: data.products.outOfStock, color: "text-red-500" },
          ].map(item => (
            <div key={item.label} className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Package size={14} className="text-baraka-sage" />
                <p className="text-xs text-[var(--muted)]">{item.label}</p>
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── TOP PRODUCTS ── */}
      {data.topProducts.length > 0 && (
        <div>
          <SectionTitle>{t("sectionTopProducts")}</SectionTitle>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{t("topProductsByRevenue")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("units")}</th>
                  <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{t("revenueLabel")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.topProducts.map((product, index) => (
                  <tr key={product.name} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-baraka-sage/20 text-baraka-primary text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-[var(--foreground)]">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--foreground)]">{product.totalSold} {t("units")}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{fmt(product.revenue)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CHARTS ── */}
      <div>
        <SectionTitle>{t("sectionVisualAnalytics")}</SectionTitle>
        <div className="space-y-4">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
            <p className="text-sm font-medium text-[var(--foreground)] mb-4">{t("revenueTrend")}</p>
            <RevenueBarChart data={data.monthlyTrend} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
              <p className="text-sm font-medium text-[var(--foreground)] mb-4">{t("orderStatusBreakdown")}</p>
              <OrderStatusChart
                delivered={data.orders.delivered}
                pending={data.orders.pending}
                cancelled={data.orders.cancelled}
                total={data.orders.total}
              />
            </div>
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
              <p className="text-sm font-medium text-[var(--foreground)] mb-4">{t("topProductsByRevenue")}</p>
              <TopProductsChart data={data.topProducts} />
            </div>
          </div>
        </div>
      </div>

      {/* ── P&L STATEMENT ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>{t("sectionPnL")}</SectionTitle>
          <input
            type="month"
            value={pnlMonth}
            onChange={e => changeMonth(e.target.value)}
            className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] outline-none focus:border-baraka-primary transition-colors"
          />
        </div>

        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <tbody className="divide-y divide-[var(--border)]">
              {[
                { label: t("revenueLabel"),      value: pnl.revenue,     color: "text-emerald-600", indent: false },
                { label: t("cogsLabel"),          value: -pnl.cogs,       color: "text-red-500",     indent: true  },
                { label: t("grossProfitLabel"),   value: pnl.grossProfit, color: pnl.grossProfit >= 0 ? "text-emerald-600" : "text-red-500", indent: false, bold: true },
                { label: t("operatingExpenses"),  value: -pnl.expenses,   color: "text-red-500",     indent: true  },
                { label: t("netProfitLabel"),     value: pnl.profit,      color: pnl.profit >= 0 ? "text-emerald-700" : "text-red-600", indent: false, bold: true },
                { label: t("taxCollectedVAT"),    value: pnl.taxCollected,color: "text-[var(--muted)]", indent: true },
              ].map(row => (
                <tr key={row.label} className={row.bold ? "bg-[var(--background)]" : ""}>
                  <td className={`px-6 py-3 text-sm ${row.indent ? "pl-10 text-[var(--muted)]" : "font-medium text-[var(--foreground)]"} ${row.bold ? "font-semibold" : ""}`}>
                    {row.label}
                  </td>
                  <td className={`px-6 py-3 text-right text-sm font-medium ${row.color} ${row.bold ? "font-bold text-base" : ""}`}>
                    {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-baraka-sage/5 flex items-center justify-between border-t border-[var(--border)]">
            <span className="text-xs text-[var(--muted)]">{t("grossMargin")}</span>
            <span className="text-sm font-bold text-baraka-primary">{pnl.grossMargin}%</span>
            <span className="text-xs text-[var(--muted)]">{t("netMargin")}</span>
            <span className={`text-sm font-bold ${pnl.margin >= 0 ? "text-emerald-600" : "text-red-500"}`}>{pnl.margin}%</span>
          </div>
        </div>
      </div>

      {/* ── AR & AP ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Accounts Receivable */}
        <div>
          <SectionTitle>{t("sectionAR")}</SectionTitle>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-[var(--foreground)]">{t("totalOutstanding")}</span>
              </div>
              <span className="text-xl font-bold text-blue-600">{fmt(ar.total)}</span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">{t("agingBuckets")}</p>
              {[
                { label: t("agingCurrent"),  bucket: ar.aging.current,   color: "bg-emerald-400" },
                { label: t("aging1_30"),     bucket: ar.aging.days1_30,  color: "bg-yellow-400" },
                { label: t("aging31_60"),    bucket: ar.aging.days31_60, color: "bg-orange-400" },
                { label: t("aging60plus"),   bucket: ar.aging.days60plus,color: "bg-red-500" },
              ].map(({ label, bucket, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-[var(--muted)]">{label}</span>
                    <span className="text-xs text-[var(--muted)]">({bucket.count})</span>
                  </div>
                  <span className="font-medium text-[var(--foreground)]">{fmt(bucket.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Accounts Payable */}
        <div>
          <SectionTitle>{t("sectionAP")}</SectionTitle>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-amber-500" />
                <span className="text-sm font-medium text-[var(--foreground)]">{t("totalOwedSuppliers")}</span>
              </div>
              <span className="text-xl font-bold text-amber-600">{fmt(ap.total)}</span>
            </div>

            {ap.bySupplier.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">{t("bySupplier")}</p>
                {ap.bySupplier.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--muted)] truncate max-w-[60%]">{s.name}</span>
                    <span className="font-medium text-amber-700">{fmt(s.outstanding)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">{t("allSuppliersPaidUp")}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── CASH FLOW ── */}
      <div>
        <SectionTitle>{t("sectionCashFlow")} — {pnlMonth}</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t("cashCollected"),     value: cashFlow.cashIn,           icon: ArrowUpCircle,   color: "text-emerald-600", bg: "bg-emerald-100" },
            { label: t("paidToSuppliers"),   value: cashFlow.cashOutSuppliers, icon: ArrowDownCircle, color: "text-red-500",     bg: "bg-red-100" },
            { label: t("operatingExpenses"), value: cashFlow.expenses,         icon: TrendingDown,    color: "text-orange-600",  bg: "bg-orange-100" },
            { label: t("netCashFlow"),       value: cashFlow.net,              icon: Banknote,        color: cashFlow.net >= 0 ? "text-emerald-700" : "text-red-600", bg: cashFlow.net >= 0 ? "bg-emerald-100" : "bg-red-100" },
          ].map(item => (
            <div key={item.label} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <p className="text-xs text-[var(--muted)]">{item.label}</p>
              </div>
              <p className={`text-xl font-bold ${item.color}`}>
                {item.value < 0 ? `(${fmt(Math.abs(item.value))})` : fmt(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
