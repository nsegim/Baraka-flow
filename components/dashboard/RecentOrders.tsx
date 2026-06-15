import { RecentOrder } from "@/types"

// Format number as Rwandan Francs
// Example: 450000 → "RWF 450,000"
function formatRWF(amount: number): string {
  return `RWF ${amount.toLocaleString()}`
}

// Status badge — different color per status
function StatusBadge({ status }: { status: RecentOrder["status"] }) {
  const styles = {
    completed: "bg-emerald-100 text-emerald-700",
    pending:   "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
  }

  return (
    <span className={`
      px-2 py-1 rounded-full text-xs font-medium
      ${styles[status]}
    `}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

interface RecentOrdersProps {
  orders: RecentOrder[]
}

export default function RecentOrders({ orders }: RecentOrdersProps) {
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
        <h2 className="font-semibold text-[var(--foreground)]">
          Recent Orders
        </h2>
        <p className="text-sm text-[var(--muted)] mt-1">
          Latest transactions from your clients
        </p>
      </div>

      {/* Orders list */}
      <div className="divide-y divide-[var(--border)]">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-4 flex items-center justify-between hover:bg-[var(--background)] transition-colors"
          >
            {/* Left — order info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)] truncate">
                {order.product}
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                {order.customer}
              </p>
            </div>

            {/* Right — amount and status */}
            <div className="flex items-center gap-3 ml-4">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {formatRWF(order.amount)}
              </span>
              <StatusBadge status={order.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <button className="text-sm text-baraka-primary hover:text-baraka-dark font-medium transition-colors">
          View all orders →
        </button>
      </div>
    </div>
  )
}