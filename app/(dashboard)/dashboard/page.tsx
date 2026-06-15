"use client"

import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"
import StatCard from "@/components/dashboard/StatCard"
import RecentOrders from "@/components/dashboard/RecentOrders"
import LowStockAlert from "@/components/dashboard/LowStockAlert"

interface DashboardData {
  stats: {
    totalProducts:  number
    lowStockCount:  number
    outOfStock:     number
    todayOrders:    number
    totalRevenue:   number
    monthlyRevenue: number
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
    items: {
      product: { name: string }
    }[]
  }[]
}

function formatRWF(amount: number): string {
  if (amount >= 1000000) {
    return `RWF ${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `RWF ${(amount / 1000).toFixed(0)}K`
  }
  return `RWF ${amount.toLocaleString()}`
}

export default function DashboardPage() {
  const [data,      setData]      = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState("")

  async function fetchDashboard() {
    try {
      setIsLoading(true)
      setError("")
      const res  = await fetch("/api/dashboard")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
    } catch {
      setError("Failed to load dashboard data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin" />
          <span className="text-sm">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={fetchDashboard}
          className="text-sm text-baraka-primary hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // Map real data to RecentOrders component format
  const recentOrdersMapped = data.recentOrders.map(order => ({
    id:           order.id,
    customer:     order.customerName,
    product:      order.items[0]?.product.name || "Multiple items",
    amount:       order.totalAmount,
    status:       order.status.toLowerCase() as "pending" | "completed" | "cancelled",
    date:         order.createdAt,
  }))

  // Map real data to LowStockAlert component format
  const lowStockMapped = data.lowStockItems.map(item => ({
    id:       item.id,
    name:     item.name,
    category: item.category?.name || "Uncategorized",
    stock:    item.stock,
    minStock: item.minStock,
  }))

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Here's what's happening in your business today.
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="
            flex items-center gap-2 text-sm
            text-baraka-sage hover:text-baraka-primary
            transition-colors
          "
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={String(data.stats.totalProducts)}
          change={`${data.stats.outOfStock} out of stock`}
          positive={data.stats.outOfStock === 0}
          icon="products"
        />
        <StatCard
          title="Low Stock Alerts"
          value={String(data.stats.lowStockCount)}
          change={data.stats.lowStockCount > 0
            ? "Needs restocking"
            : "All stock healthy"
          }
          positive={data.stats.lowStockCount === 0}
          icon="alerts"
        />
        <StatCard
          title="Orders Today"
          value={String(data.stats.todayOrders)}
          change="New orders today"
          positive={data.stats.todayOrders > 0}
          icon="orders"
        />
        <StatCard
          title="Revenue This Month"
          value={formatRWF(data.stats.monthlyRevenue)}
          change={`Total: ${formatRWF(data.stats.totalRevenue)}`}
          positive={true}
          icon="revenue"
        />
      </div>

      {/* ── BOTTOM ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrders orders={recentOrdersMapped} />
        <LowStockAlert items={lowStockMapped} />
      </div>

    </div>
  )
}