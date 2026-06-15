import { AlertTriangle } from "lucide-react"
import { LowStockItem } from "@/types"

interface LowStockAlertProps {
  items: LowStockItem[]
}

export default function LowStockAlert({ items }: LowStockAlertProps) {
  return (
    <div className="
      bg-[var(--card)]
      rounded-xl
      border border-[var(--border)]
      shadow-sm
      overflow-hidden
    ">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="font-semibold text-[var(--foreground)]">
            Low Stock Alerts
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)] mt-1">
          Products that need urgent restocking
        </p>
      </div>

      {/* Items list */}
      <div className="divide-y divide-[var(--border)]">
        {items.map((item) => {
          // Calculate how critical the stock level is
          // If stock <= 1 it's critical (red), otherwise warning (yellow)
          const isCritical = item.stock <= 1

          return (
            <div
              key={item.id}
              className="p-4 flex items-center justify-between hover:bg-[var(--background)] transition-colors"
            >
              {/* Left */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {item.name}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {item.category}
                </p>
              </div>

              {/* Right — stock level */}
              <div className="ml-4 text-right">
                <span className={`
                  text-sm font-bold
                  ${isCritical ? "text-red-500" : "text-yellow-500"}
                `}>
                  {item.stock} left
                </span>
                <p className="text-xs text-[var(--muted)]">
                  Min: {item.minStock}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <button className="text-sm text-baraka-primary hover:text-baraka-dark font-medium transition-colors">
          View all alerts →
        </button>
      </div>
    </div>
  )
}