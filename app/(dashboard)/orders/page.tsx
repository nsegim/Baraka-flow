"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, ShoppingCart, RefreshCw,
  AlertTriangle, ChevronDown, Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import OrderModal from "@/components/orders/OrderModal"

interface OrderItem {
  id:        string
  quantity:  number
  unitPrice: number
  product: {
    id:   string
    name: string
  }
}

interface Order {
  id:            string
  orderNumber:   string
  customerName:  string
  customerPhone: string | null
  status:        "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED"
  totalAmount:   number
  notes:         string | null
  createdAt:     string
  items:         OrderItem[]
  user: { name: string }
}

// Status badge colors
const statusStyles = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

// Next possible statuses for each current status
const nextStatuses: Record<string, { label: string; value: string }[]> = {
  PENDING:   [
    { label: "Confirm Order",  value: "CONFIRMED" },
    { label: "Cancel Order",   value: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Mark Delivered", value: "DELIVERED" },
    { label: "Cancel Order",   value: "CANCELLED" },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

function formatRWF(amount: number) {
  return `RWF ${amount.toLocaleString()}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-RW", {
    day:   "numeric",
    month: "short",
    year:  "numeric"
  })
}

export default function OrdersPage() {
  const [orders,     setOrders]     = useState<Order[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [showModal,  setShowModal]  = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError("")
      const res  = await fetch("/api/orders")
      const data = await res.json()
      setOrders(data)
    } catch {
      setError("Failed to load orders")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Create new order
  async function handleSave(data: {
    customerName:  string
    customerPhone: string
    notes:         string
    items: {
      productId:   string
      productName: string
      quantity:    number
      unitPrice:   number
    }[]
  }) {
    const res = await fetch("/api/orders", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data)
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error)
    }

    const newOrder = await res.json()
    setOrders(prev => [newOrder, ...prev])
  }

  // Update order status
  async function handleStatusChange(orderId: string, status: string) {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status })
      })

      if (!res.ok) throw new Error("Failed to update")

      const updated = await res.json()
      setOrders(prev =>
        prev.map(o => o.id === orderId ? updated : o)
      )
    } catch {
      setError("Failed to update order status")
    } finally {
      setUpdatingId(null)
    }
  }

  // Delete order
  async function handleDelete(orderId: string) {
    setDeletingId(orderId)
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } catch {
      setError("Failed to delete order")
    } finally {
      setDeletingId(null)
    }
  }

  // Summary numbers
  const totalRevenue  = orders
    .filter(o => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.totalAmount, 0)

  const pendingCount  = orders.filter(o => o.status === "PENDING").length
  const deliveredCount = orders.filter(o => o.status === "DELIVERED").length

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Orders
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {orders.length} total orders
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="
            flex items-center gap-2
            bg-baraka-primary hover:bg-baraka-dark
            text-white px-4 py-2.5 rounded-lg
            transition-colors
          "
        >
          <Plus size={18} />
          New Order
        </Button>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">Total Revenue</p>
          <p className="text-xl font-bold text-[var(--foreground)]">
            {formatRWF(totalRevenue)}
          </p>
          <p className="text-xs text-baraka-sage mt-1">From delivered orders</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">Pending Orders</p>
          <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-baraka-sage mt-1">Awaiting confirmation</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">Delivered</p>
          <p className="text-xl font-bold text-emerald-600">{deliveredCount}</p>
          <p className="text-xs text-baraka-sage mt-1">Successfully completed</p>
        </div>
      </div>

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-baraka-sage" />
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ── EMPTY ── */}
      {!isLoading && orders.length === 0 && (
        <div className="
          flex flex-col items-center justify-center
          py-16 gap-3
          bg-[var(--card)] rounded-xl border border-[var(--border)]
        ">
          <ShoppingCart size={40} className="text-baraka-sage/40" />
          <p className="text-sm font-medium text-[var(--foreground)]">
            No orders yet
          </p>
          <p className="text-xs text-[var(--muted)]">
            Create your first order when a client makes a purchase
          </p>
          <Button
            onClick={() => setShowModal(true)}
            className="
              mt-2 flex items-center gap-2
              bg-baraka-primary hover:bg-baraka-dark
              text-white px-4 py-2 rounded-lg text-sm
            "
          >
            <Plus size={16} />
            Create First Order
          </Button>
        </div>
      )}

      {/* ── ORDERS LIST ── */}
      {!isLoading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map(order => (
            <div
              key={order.id}
              className="
                bg-[var(--card)] rounded-xl
                border border-[var(--border)]
                overflow-hidden
              "
            >
              {/* Order row */}
              <div className="
                flex items-center justify-between
                p-4 cursor-pointer
                hover:bg-[var(--background)]
                transition-colors
              "
                onClick={() =>
                  setExpandedId(
                    expandedId === order.id ? null : order.id
                  )
                }
              >
                {/* Left — order info */}
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        {order.orderNumber}
                      </span>
                      <span className={`
                        text-xs px-2 py-0.5 rounded-full font-medium
                        ${statusStyles[order.status]}
                      `}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)] mt-0.5">
                      {order.customerName}
                      {order.customerPhone && ` · ${order.customerPhone}`}
                    </p>
                  </div>
                </div>

                {/* Right — amount + date + expand */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {formatRWF(order.totalAmount)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`
                      text-baraka-sage transition-transform
                      ${expandedId === order.id ? "rotate-180" : ""}
                    `}
                  />
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === order.id && (
                <div className="
                  px-4 pb-4
                  border-t border-[var(--border)]
                  pt-4 space-y-4
                ">
                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
                      Order Items
                    </p>
                    <div className="space-y-1">
                      {order.items.map(item => (
                        <div
                          key={item.id}
                          className="
                            flex justify-between
                            text-sm py-1
                          "
                        >
                          <span className="text-[var(--foreground)]">
                            {item.product.name}
                            <span className="text-[var(--muted)] ml-2">
                              × {item.quantity}
                            </span>
                          </span>
                          <span className="font-medium text-[var(--foreground)]">
                            {formatRWF(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted)] mb-1 uppercase tracking-wide">
                        Notes
                      </p>
                      <p className="text-sm text-[var(--foreground)]">
                        {order.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">

                    {/* Status change buttons */}
                    <div className="flex gap-2">
                      {nextStatuses[order.status].map(next => (
                        <Button
                          key={next.value}
                          onClick={() => handleStatusChange(order.id, next.value)}
                          disabled={updatingId === order.id}
                          className={`
                            text-xs px-3 py-1.5 rounded-lg
                            transition-colors disabled:opacity-50
                            ${next.value === "CANCELLED"
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-baraka-primary text-white hover:bg-baraka-dark"
                            }
                          `}
                        >
                          {updatingId === order.id
                            ? "Updating..."
                            : next.label
                          }
                        </Button>
                      ))}
                    </div>

                    {/* Delete — only for CANCELLED or PENDING orders */}
                    {(order.status === "CANCELLED" ||
                      order.status === "PENDING") && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        disabled={deletingId === order.id}
                        className="
                          flex items-center gap-1.5 text-xs
                          text-baraka-sage hover:text-red-500
                          transition-colors disabled:opacity-50
                        "
                      >
                        <Trash2 size={13} />
                        {deletingId === order.id ? "Deleting..." : "Delete"}
                      </button>
                    )}

                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL ── */}
      <OrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

    </div>
  )
}