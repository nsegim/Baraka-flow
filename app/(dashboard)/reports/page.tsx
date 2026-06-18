"use client"

import { useState, useEffect } from "react"
import {
  TrendingUp, Package,
  DollarSign, RefreshCw, BarChart3, Download, TrendingDown
} from "lucide-react"
import RevenueBarChart, { type RevenueTrendPoint } from "@/components/charts/RevenueBarChart"
import OrderStatusChart from "@/components/charts/OrderStatusChart"
import TopProductsChart from "@/components/charts/TopProductsChart"

interface ReportData {
  revenue: {
    total:     number
    thisMonth: number
    lastMonth: number
  }
  orders: {
    total:     number
    delivered: number
    pending:   number
    cancelled: number
  }
  products: {
    total:      number
    lowStock:   number
    outOfStock: number
  }
  topProducts: {
    name:      string
    totalSold: number
    revenue:   number
  }[]
  monthlyTrend: RevenueTrendPoint[]
  pnl: {
    month:    string
    revenue:  number
    expenses: number
    profit:   number
    margin:   number
  }
}

function formatRWF(amount: number) {
  if (amount >= 1000000) return `RWF ${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000)    return `RWF ${(amount / 1000).toFixed(0)}K`
  return `RWF ${amount.toLocaleString()}`
}

export default function ReportsPage() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [data,       setData]       = useState<ReportData | null>(null)
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [pnlMonth,   setPnlMonth]   = useState(currentMonth)
  const [key,        setKey]        = useState(0)

  useEffect(() => {
    fetch(`/api/reports?month=${pnlMonth}`)
      .then(r => r.json())
      .then(json => {
        setData(json)
        setError("")
        setIsLoading(false)
      })
      .catch(() => {
        setError("Failed to load reports")
        setIsLoading(false)
      })
  }, [pnlMonth, key])

  function handleMonthChange(m: string) {
    setIsLoading(true)
    setPnlMonth(m)
  }

  function handleExport(type: string) {
    window.open(`/api/export?type=${type}`, "_blank")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading reports...</span>
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
          onClick={() => { setIsLoading(true); setKey(k => k + 1) }}
          className="text-sm text-baraka-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // Delivery rate percentage
  const deliveryRate = data.orders.total > 0
    ? Math.round((data.orders.delivered / data.orders.total) * 100)
    : 0

  // Month over month change
  const momChange = data.revenue.lastMonth > 0
    ? Math.round(
        ((data.revenue.thisMonth - data.revenue.lastMonth)
          / data.revenue.lastMonth) * 100
      )
    : 0

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Reports
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Business performance overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "Products",      type: "products"        },
              { label: "Orders",        type: "orders"          },
              { label: "Customers",     type: "customers"       },
              { label: "Expenses",      type: "expenses"        },
              { label: "Stock Log",     type: "stock-movements" },
              { label: "Credit Notes",  type: "credit-notes"    },
            ].map(e => (
              <button
                key={e.type}
                onClick={() => handleExport(e.type)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-baraka-primary hover:border-baraka-primary/40 transition-colors"
              >
                <Download size={12} />
                {e.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setIsLoading(true); setKey(k => k + 1) }}
            className="flex items-center gap-2 text-sm text-baraka-sage hover:text-baraka-primary transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── REVENUE SECTION ── */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
          Revenue
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign size={18} className="text-emerald-600" />
              </div>
              <p className="text-sm text-[var(--muted)]">Total Revenue</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatRWF(data.revenue.total)}
            </p>
            <p className="text-xs text-baraka-sage mt-1">
              From all delivered orders
            </p>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-blue-600" />
              </div>
              <p className="text-sm text-[var(--muted)]">This Month</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatRWF(data.revenue.thisMonth)}
            </p>
            <p className={`text-xs mt-1 font-medium ${
              momChange >= 0 ? "text-emerald-500" : "text-red-500"
            }`}>
              {momChange >= 0 ? "+" : ""}{momChange}% vs last month
            </p>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-baraka-sage/20 rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-baraka-primary" />
              </div>
              <p className="text-sm text-[var(--muted)]">Last Month</p>
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)]">
              {formatRWF(data.revenue.lastMonth)}
            </p>
            <p className="text-xs text-baraka-sage mt-1">
              Previous month total
            </p>
          </div>

        </div>
      </div>

      {/* ── ORDERS SECTION ── */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
          Orders
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {[
            { label: "Total Orders",  value: data.orders.total,     color: "text-[var(--foreground)]" },
            { label: "Delivered",     value: data.orders.delivered, color: "text-emerald-600" },
            { label: "Pending",       value: data.orders.pending,   color: "text-yellow-600" },
            { label: "Cancelled",     value: data.orders.cancelled, color: "text-red-500" },
          ].map(item => (
            <div
              key={item.label}
              className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]"
            >
              <p className="text-xs text-[var(--muted)] mb-2">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}

        </div>

        {/* Delivery rate bar */}
        <div className="
          mt-4 bg-[var(--card)] rounded-xl p-5
          border border-[var(--border)]
        ">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              Order Delivery Rate
            </p>
            <span className="text-sm font-bold text-emerald-600">
              {deliveryRate}%
            </span>
          </div>
          <div className="w-full bg-[var(--background)] rounded-full h-2.5">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-700"
              style={{ width: `${deliveryRate}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            {data.orders.delivered} of {data.orders.total} orders delivered
          </p>
        </div>

      </div>

      {/* ── INVENTORY SECTION ── */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
          Inventory
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {[
            { label: "Total Products", value: data.products.total,      color: "text-[var(--foreground)]", icon: Package },
            { label: "Low Stock",      value: data.products.lowStock,   color: "text-yellow-600",          icon: Package },
            { label: "Out of Stock",   value: data.products.outOfStock, color: "text-red-500",             icon: Package },
          ].map(item => (
            <div
              key={item.label}
              className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]"
            >
              <p className="text-xs text-[var(--muted)] mb-2">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}

        </div>
      </div>

      {/* ── TOP PRODUCTS ── */}
      {data.topProducts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
            Top Selling Products
          </h2>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                    Product
                  </th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                    Units Sold
                  </th>
                  <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.topProducts.map((product, index) => (
                  <tr
                    key={product.name}
                    className="hover:bg-[var(--background)] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="
                          w-6 h-6 rounded-full
                          bg-baraka-sage/20
                          text-baraka-primary
                          text-xs font-bold
                          flex items-center justify-center
                        ">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--foreground)]">
                        {product.totalSold} units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-[var(--foreground)]">
                        {formatRWF(product.revenue)}
                      </span>
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
        <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
          Visual Analytics
        </h2>
        <div className="space-y-4">

          {/* Revenue trend — full width */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
            <p className="text-sm font-medium text-[var(--foreground)] mb-4">
              Revenue Trend — Last 6 Months
            </p>
            <RevenueBarChart data={data.monthlyTrend} />
          </div>

          {/* Order status + Top products — side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
              <p className="text-sm font-medium text-[var(--foreground)] mb-4">
                Order Status Breakdown
              </p>
              <OrderStatusChart
                delivered={data.orders.delivered}
                pending={data.orders.pending}
                cancelled={data.orders.cancelled}
                total={data.orders.total}
              />
            </div>
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
              <p className="text-sm font-medium text-[var(--foreground)] mb-4">
                Top Products by Revenue
              </p>
              <TopProductsChart data={data.topProducts} />
            </div>
          </div>

        </div>
      </div>

      {/* ── P&L SECTION ── */}
      {data.pnl && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide">
              Profit & Loss
            </h2>
            <input
              type="month"
              value={pnlMonth}
              onChange={e => handleMonthChange(e.target.value)}
              className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] outline-none focus:border-baraka-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} className="text-emerald-500" />
                <p className="text-xs text-[var(--muted)]">Revenue</p>
              </div>
              <p className="text-xl font-bold text-emerald-600">{formatRWF(data.pnl.revenue)}</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={15} className="text-red-500" />
                <p className="text-xs text-[var(--muted)]">Expenses</p>
              </div>
              <p className="text-xl font-bold text-red-600">{formatRWF(data.pnl.expenses)}</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={15} className={data.pnl.profit >= 0 ? "text-emerald-500" : "text-red-500"} />
                <p className="text-xs text-[var(--muted)]">Net Profit</p>
              </div>
              <p className={`text-xl font-bold ${data.pnl.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {data.pnl.profit < 0 ? "−" : ""}{formatRWF(Math.abs(data.pnl.profit))}
              </p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={15} className="text-baraka-primary" />
                <p className="text-xs text-[var(--muted)]">Margin</p>
              </div>
              <p className={`text-xl font-bold ${data.pnl.margin >= 0 ? "text-baraka-primary" : "text-red-600"}`}>
                {data.pnl.margin}%
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}