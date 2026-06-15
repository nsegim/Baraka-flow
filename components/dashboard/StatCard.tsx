// No "use client" needed — this component just displays data
// It receives everything it needs through props
// Props are like function arguments for components

import { TrendingUp, TrendingDown, Package, AlertTriangle, ShoppingCart, DollarSign } from "lucide-react"

// Define what props this component accepts
interface StatCardProps {
  title: string
  value: string
  change: string
  positive: boolean
  icon: "products" | "alerts" | "orders" | "revenue"
}

// Map icon names to actual Lucide components
const icons = {
  products: Package,
  alerts:   AlertTriangle,
  orders:   ShoppingCart,
  revenue:  DollarSign,
}

// Map icon names to background colors
const iconColors = {
  products: "bg-blue-100 text-blue-600",
  alerts:   "bg-red-100 text-red-600",
  orders:   "bg-baraka-sage/30 text-baraka-primary",
  revenue:  "bg-emerald-100 text-emerald-600",
}

export default function StatCard({
  title,
  value,
  change,
  positive,
  icon,
}: StatCardProps) {
  const Icon = icons[icon]
  const colorClass = iconColors[icon]

  return (
    <div className="
      bg-[var(--card)]
      rounded-xl
      p-6
      border border-[var(--border)]
      shadow-sm
      hover:shadow-md
      transition-shadow duration-200
    ">
      {/* Top row — title and icon */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-[var(--muted)]">
          {title}
        </p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon size={20} />
        </div>
      </div>

      {/* Value — the big number */}
      <p className="text-2xl font-bold text-[var(--foreground)] mb-2">
        {value}
      </p>

      {/* Change indicator */}
      <div className="flex items-center gap-1">
        {positive
          ? <TrendingUp size={14} className="text-emerald-500" />
          : <TrendingDown size={14} className="text-red-500" />
        }
        <span className={`text-xs font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>
          {change}
        </span>
      </div>
    </div>
  )
}