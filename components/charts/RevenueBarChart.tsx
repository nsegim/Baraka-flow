"use client"

import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts"

export interface RevenueTrendPoint {
  month:   string
  revenue: number
  orders:  number
}

function shortMonth(m: string) {
  const [y, mo] = m.split("-")
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString("en-RW", { month: "short", year: "2-digit" })
}

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export default function RevenueBarChart({ data }: { data: RevenueTrendPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-[var(--muted)]">
        No delivery data in the last 6 months
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={shortMonth}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtK}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v: unknown) => [`RWF ${Number(v ?? 0).toLocaleString()}`, "Revenue"]}
          labelFormatter={(label: unknown) => shortMonth(String(label ?? ""))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="revenue" fill="#2A9D8F" radius={[4, 4, 0, 0]} maxBarSize={52} />
      </BarChart>
    </ResponsiveContainer>
  )
}
