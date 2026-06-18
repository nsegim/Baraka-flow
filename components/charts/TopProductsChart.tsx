"use client"

import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip,
} from "recharts"

export interface TopProductPoint {
  name:      string
  revenue:   number
  totalSold: number
}

const COLORS = ["#2A9D8F", "#0E3A43", "#68abaf", "#10b981", "#6366f1"]

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

export default function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-[var(--muted)]">
        No sales data yet
      </div>
    )
  }

  const coloredData = data.map((item, i) => ({
    ...item,
    fill: COLORS[i % COLORS.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 46)}>
      <BarChart
        data={coloredData}
        layout="vertical"
        margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
      >
        <XAxis
          type="number"
          tickFormatter={fmtK}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 11, fill: "#374151" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: unknown) => [`RWF ${Number(v ?? 0).toLocaleString()}`, "Revenue"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}
