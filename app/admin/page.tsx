"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Building2, Users, HeadphonesIcon, RefreshCw, Calendar, Activity } from "lucide-react"

interface Stats {
  totalBusinesses:      number
  activeBusinesses:     number
  suspendedBusinesses:  number
  totalUsers:           number
  activeSupportSessions: number
  recentBusinesses: {
    id: string; name: string; email: string; status: string; plan: string; createdAt: string
    _count: { users: number; branches: number }
  }[]
  monthlySignups: { month: string; count: string }[]
}

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color: string
  href?: string
}) {
  const inner = (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function AdminOverviewPage() {
  const [stats,     setStats]     = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState("")

  function load() {
    setIsLoading(true)
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(data => { setStats(data); setIsLoading(false) })
      .catch(() => { setError("Failed to load stats"); setIsLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  if (error || !stats) {
    return <p className="text-red-400 text-sm">{error || "No data"}</p>
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control room · tenant registry</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI cards — platform metadata only, no tenant financial data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2} label="Total Tenants" value={stats.totalBusinesses}
          sub={`${stats.activeBusinesses} active · ${stats.suspendedBusinesses} suspended`}
          color="bg-blue-500/20 text-blue-400" href="/admin/businesses"
        />
        <StatCard
          icon={Users} label="Total Staff Users" value={stats.totalUsers}
          sub="Across all tenants"
          color="bg-purple-500/20 text-purple-400" href="/admin/users"
        />
        <StatCard
          icon={HeadphonesIcon} label="Active Support Sessions" value={stats.activeSupportSessions}
          sub={stats.activeSupportSessions > 0 ? "Access in progress" : "No active sessions"}
          color={stats.activeSupportSessions > 0 ? "bg-amber-500/20 text-amber-400" : "bg-gray-700/40 text-gray-500"}
          href="/admin/support"
        />
        <StatCard
          icon={Activity} label="Platform Events" value="View logs"
          sub="All admin actions"
          color="bg-emerald-500/20 text-emerald-400" href="/admin/platform-logs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent signups */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Building2 size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-white">Recent Businesses</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {stats.recentBusinesses.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-500 text-center">No businesses yet</p>
            ) : stats.recentBusinesses.map(biz => (
              <div key={biz.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{biz.name}</p>
                  <p className="text-xs text-gray-500">{biz.email}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{biz._count.users} users</span>
                    <span>·</span>
                    <span>{biz._count.branches} branches</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">{biz.plan}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(biz.createdAt).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly signups */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
            <Calendar size={16} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-white">Monthly Signups (last 6 months)</h2>
          </div>
          <div className="p-5 space-y-3">
            {stats.monthlySignups.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No signups yet</p>
            ) : (() => {
              const max = Math.max(...stats.monthlySignups.map(m => Number(m.count)), 1)
              return stats.monthlySignups.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(Number(m.count) / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-white w-6 text-right">{m.count}</span>
                </div>
              ))
            })()}
          </div>
        </div>

      </div>
    </div>
  )
}
