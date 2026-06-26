"use client"

import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import StatCard from "@/components/dashboard/StatCard"
import RecentOrders from "@/components/dashboard/RecentOrders"
import LowStockAlert from "@/components/dashboard/LowStockAlert"

interface DashboardData {
  stats: {
    totalProducts:       number
    lowStockCount:       number
    outOfStock:          number
    todayOrders:         number
    totalRevenue:        number
    monthlyRevenue:      number
    arOutstanding:       number
    apOutstanding:       number
    cashCollectedToday:  number
    cashCollectedMonth:  number
    overdueOrders:       number
  }
  lowStockItems: {
    id:       string
    name:     string
    stock:    number
    minStock: number
    category: { name: string } | null
  }[]
  recentOrders: {
    id:           string
    orderNumber:  string
    customerName: string
    totalAmount:  number
    status:       "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED"
    createdAt:    string
    items: { product: { name: string } }[]
  }[]
}

function fmt(amount: number): string {
  if (amount >= 1000000) return `RWF ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000)    return `RWF ${(amount / 1000).toFixed(0)}K`
  return `RWF ${amount.toLocaleString()}`
}

export default function DashboardPage() {
  const t       = useTranslations("dashboard")
  const tCommon = useTranslations("common")

  const [data,      setData]      = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState("")
  const [key,       setKey]       = useState(0)

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(json => { setData(json); setError(""); setIsLoading(false) })
      .catch(() => { setError(t("failedToLoad")); setIsLoading(false) })
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefresh() { setIsLoading(true); setKey(k => k + 1) }

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
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={handleRefresh} className="text-sm text-baraka-primary hover:underline">
          {tCommon("tryAgain")}
        </button>
      </div>
    )
  }

  const { stats } = data

  const recentOrdersMapped = data.recentOrders.map(order => ({
    id:       order.id,
    customer: order.customerName,
    product:  order.items[0]?.product.name || t("multipleItems"),
    amount:   order.totalAmount,
    status:   order.status.toLowerCase() as "pending" | "completed" | "cancelled",
    date:     order.createdAt,
  }))

  const lowStockMapped = data.lowStockItems.map(item => ({
    id:       item.id,
    name:     item.name,
    category: item.category?.name || t("uncategorized"),
    stock:    item.stock,
    minStock: item.minStock,
  }))

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-sm text-baraka-sage hover:text-baraka-primary transition-colors"
        >
          <RefreshCw size={15} />
          {tCommon("refresh")}
        </button>
      </div>

      {/* ── INVENTORY & ORDERS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t("totalProducts")}
          value={String(stats.totalProducts)}
          change={`${stats.outOfStock} ${t("outOfStockCount")}`}
          positive={stats.outOfStock === 0}
          icon="products"
        />
        <StatCard
          title={t("lowStockAlerts")}
          value={String(stats.lowStockCount)}
          change={stats.lowStockCount > 0 ? t("needsRestocking") : t("allStockHealthy")}
          positive={stats.lowStockCount === 0}
          icon="alerts"
        />
        <StatCard
          title={t("ordersToday")}
          value={String(stats.todayOrders)}
          change={t("newOrdersToday")}
          positive={stats.todayOrders > 0}
          icon="orders"
        />
        <StatCard
          title={t("revenueThisMonth")}
          value={fmt(stats.monthlyRevenue)}
          change={`Total: ${fmt(stats.totalRevenue)}`}
          positive={true}
          icon="revenue"
        />
      </div>

      {/* ── FINANCIAL KPIs ── */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
          {t("financialPosition")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* AR outstanding */}
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">{t("arOutstanding")}</p>
            <p className={`text-xl font-bold ${stats.arOutstanding > 0 ? "text-blue-600" : "text-emerald-600"}`}>
              {fmt(stats.arOutstanding)}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {stats.arOutstanding > 0 ? t("customersOweYou") : t("allCustomersPaid")}
            </p>
            {stats.overdueOrders > 0 && (
              <p className="text-xs text-red-500 font-medium mt-1">
                {stats.overdueOrders} {t("overdueLabel")}
              </p>
            )}
          </div>

          {/* AP outstanding */}
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">{t("apOutstanding")}</p>
            <p className={`text-xl font-bold ${stats.apOutstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {fmt(stats.apOutstanding)}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {stats.apOutstanding > 0 ? t("youOweSuppliers") : t("allSuppliersPaid")}
            </p>
          </div>

          {/* Cash collected today */}
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">{t("collectedToday")}</p>
            <p className={`text-xl font-bold ${stats.cashCollectedToday > 0 ? "text-emerald-600" : "text-[var(--foreground)]"}`}>
              {fmt(stats.cashCollectedToday)}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">{t("paymentsReceived")}</p>
          </div>

          {/* Cash collected this month */}
          <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-1">{t("collectedThisMonth")}</p>
            <p className="text-xl font-bold text-emerald-600">
              {fmt(stats.cashCollectedMonth)}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">{t("totalPaymentsReceived")}</p>
          </div>

        </div>
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrders orders={recentOrdersMapped} />
        <LowStockAlert items={lowStockMapped} />
      </div>

    </div>
  )
}
