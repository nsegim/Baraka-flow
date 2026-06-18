"use client"

import {
  ResponsiveContainer, PieChart, Pie,
  Tooltip, Legend,
} from "recharts"

interface Props {
  delivered: number
  pending:   number
  cancelled: number
  total:     number
}

export default function OrderStatusChart({ delivered, pending, cancelled, total }: Props) {
  if (!total) {
    return (
      <div className="flex items-center justify-center h-52 text-sm text-[var(--muted)]">
        No orders yet
      </div>
    )
  }

  const data = [
    { name: "Delivered", value: delivered, fill: "#10b981" },
    { name: "Pending",   value: pending,   fill: "#f59e0b" },
    { name: "Cancelled", value: cancelled, fill: "#ef4444" },
  ].filter(d => d.value > 0)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
        />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [Number(v ?? 0), String(name ?? "")]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  )
}
