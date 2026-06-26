"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, ShoppingCart, RefreshCw,
  ChevronDown, Trash2, CreditCard, FileText,
  Truck, X, RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import OrderModal from "@/components/orders/OrderModal"
import Link from "next/link"
import { useTranslations } from "next-intl"

interface OrderItem {
  id:        string
  quantity:  number
  unitPrice: number
  product: { id: string; name: string }
}

interface Payment {
  id:        string
  amount:    number
  method:    "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | "CREDIT"
  reference: string | null
  paidAt:    string
}

type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID"

interface Order {
  id:            string
  orderNumber:   string
  customerName:  string
  customerPhone: string | null
  status:        "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED"
  totalAmount:   number
  amountPaid:    number
  paymentStatus: PaymentStatus
  notes:         string | null
  customerId:    string | null
  createdAt:     string
  items:         OrderItem[]
  payments:      Payment[]
  user:          { name: string }
}

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  UNPAID:  "bg-red-100 text-red-700",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  PAID:    "bg-emerald-100 text-emerald-700",
}

const statusStyles = {
  PENDING:   "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
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

interface OrderMeta {
  total: number
  page:  number
  limit: number
  pages: number
}

export default function OrdersPage() {
  const t       = useTranslations("orders")
  const tCommon = useTranslations("common")

  const [orders,         setOrders]         = useState<Order[]>([])
  const [meta,           setMeta]           = useState<OrderMeta>({ total: 0, page: 1, limit: 50, pages: 0 })
  const [isLoading,      setIsLoading]      = useState(true)
  const [error,          setError]          = useState("")
  const [showModal,      setShowModal]      = useState(false)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [updatingId,     setUpdatingId]     = useState<string | null>(null)
  const [deletingId,     setDeletingId]     = useState<string | null>(null)
  const [page,           setPage]           = useState(1)
  const [key,            setKey]            = useState(0)
  const [deliverOrder,   setDeliverOrder]   = useState<Order | null>(null)
  const [deliveryNotes,  setDeliveryNotes]  = useState("")
  const [delivering,     setDelivering]     = useState(false)
  const [returnOrder,    setReturnOrder]    = useState<Order | null>(null)
  const [returnReason,   setReturnReason]   = useState("")
  const [returnCredit,   setReturnCredit]   = useState(true)
  const [returning,      setReturning]      = useState(false)
  const [returnError,    setReturnError]    = useState("")
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null)
  const [payAmount,      setPayAmount]      = useState("")
  const [payMethod,      setPayMethod]      = useState<Payment["method"]>("CASH")
  const [payRef,         setPayRef]         = useState("")
  const [payLoading,     setPayLoading]     = useState(false)
  const [payError,       setPayError]       = useState("")

  const METHOD_LABELS = {
    CASH:          tCommon("type") === "Type" ? "Cash" : "Cash",
    MOBILE_MONEY:  "Mobile Money",
    BANK_TRANSFER: t("paymentMethod.BANK_TRANSFER"),
    CREDIT:        t("paymentMethod.CREDIT"),
  }

  const nextStatuses: Record<string, { label: string; value: string }[]> = {
    PENDING:   [
      { label: t("confirmOrder"),  value: "CONFIRMED" },
      { label: t("cancelOrder"),   value: "CANCELLED" },
    ],
    CONFIRMED: [
      { label: t("markDelivered"), value: "DELIVERED" },
      { label: t("cancelOrder"),   value: "CANCELLED" },
    ],
    DELIVERED: [],
    CANCELLED: [],
  }

  useEffect(() => {
    fetch(`/api/orders?page=${page}&limit=50`)
      .then(r => r.json())
      .then(json => {
        setOrders(json.data)
        setMeta(json.meta)
        setError("")
        setIsLoading(false)
      })
      .catch(() => {
        setError(t("failedToLoad"))
        setIsLoading(false)
      })
  }, [page, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = useCallback((newPage: number) => {
    setIsLoading(true)
    setPage(newPage)
  }, [])

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

  async function handleStatusChange(orderId: string, status: string, notes?: string | null) {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, deliveryNotes: notes ?? null }),
      })
      if (!res.ok) throw new Error("Failed to update")
      const updated = await res.json()
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o))
    } catch {
      setError(t("failedToLoad"))
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleReturn() {
    if (!returnOrder) return
    if (!returnReason.trim()) { setReturnError(tCommon("required")); return }
    setReturning(true)
    setReturnError("")
    try {
      const res = await fetch(`/api/orders/${returnOrder.id}/return`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: returnReason.trim(), issueCreditNote: returnCredit }),
      })
      const json = await res.json()
      if (!res.ok) { setReturnError(json.error || tCommon("somethingWrong")); return }
      setOrders(prev => prev.map(o => o.id === returnOrder.id ? json.order : o))
      setReturnOrder(null)
      setReturnReason("")
      setReturnCredit(true)
    } catch {
      setReturnError(tCommon("somethingWrong"))
    } finally {
      setReturning(false)
    }
  }

  async function handleConfirmDelivery() {
    if (!deliverOrder) return
    setDelivering(true)
    await handleStatusChange(deliverOrder.id, "DELIVERED", deliveryNotes.trim() || null)
    setDelivering(false)
    setDeliverOrder(null)
    setDeliveryNotes("")
  }

  async function handlePayment(orderId: string) {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { setPayError(tCommon("required")); return }
    setPayLoading(true)
    setPayError("")
    const res = await fetch("/api/payments", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ orderId, amount: amt, method: payMethod, reference: payRef || null }),
    })
    if (!res.ok) {
      const err = await res.json()
      setPayError(err.error || tCommon("somethingWrong"))
      setPayLoading(false)
      return
    }
    const refreshed = await fetch(`/api/orders/${orderId}`).then(r => r.json())
    setOrders(prev => prev.map(o => o.id === orderId ? refreshed : o))
    setPaymentOrderId(null)
    setPayAmount("")
    setPayRef("")
    setPayMethod("CASH")
    setPayLoading(false)
  }

  async function handleDelete(orderId: string) {
    setDeletingId(orderId)
    try {
      await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } catch {
      setError(tCommon("somethingWrong"))
    } finally {
      setDeletingId(null)
    }
  }

  const totalRevenue   = orders.filter(o => o.status === "DELIVERED").reduce((sum, o) => sum + o.totalAmount, 0)
  const pendingCount   = orders.filter(o => o.status === "PENDING").length
  const deliveredCount = orders.filter(o => o.status === "DELIVERED").length

  const from = Math.min((meta.page - 1) * meta.limit + 1, meta.total)
  const to   = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{meta.total} {t("title").toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIsLoading(true); setKey(k => k + 1) }}
            className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
            title={tCommon("refresh")}
          >
            <RefreshCw size={16} className="text-[var(--muted)]" />
          </button>
          <Button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={18} />
            {t("newOrder")}
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("totalRevenue")}</p>
          <p className="text-xl font-bold text-[var(--foreground)]">{formatRWF(totalRevenue)}</p>
          <p className="text-xs text-baraka-sage mt-1">{t("fromDeliveredOrders")}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("pendingOrders")}</p>
          <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-baraka-sage mt-1">{t("awaitingConfirmation")}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("status.DELIVERED")}</p>
          <p className="text-xl font-bold text-emerald-600">{deliveredCount}</p>
          <p className="text-xs text-baraka-sage mt-1">{t("successfullyCompleted")}</p>
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
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* ── EMPTY ── */}
      {!isLoading && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <ShoppingCart size={40} className="text-baraka-sage/40" />
          <p className="text-sm font-medium text-[var(--foreground)]">{t("noOrdersYet")}</p>
          <p className="text-xs text-[var(--muted)]">{t("createFirstOrderHint")}</p>
          <Button
            onClick={() => setShowModal(true)}
            className="mt-2 flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus size={16} />
            {t("createFirstOrder")}
          </Button>
        </div>
      )}

      {/* ── ORDERS LIST ── */}
      {!isLoading && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">

              {/* Order row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--background)] transition-colors"
                onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--foreground)]">{order.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[order.status]}`}>
                        {t(`status.${order.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--muted)] mt-0.5">
                      {order.customerName}
                      {order.customerPhone && ` · ${order.customerPhone}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--foreground)]">{formatRWF(order.totalAmount)}</p>
                    <p className="text-xs text-[var(--muted)]">{formatDate(order.createdAt)}</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-baraka-sage transition-transform ${expandedId === order.id ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === order.id && (
                <div className="px-4 pb-4 border-t border-[var(--border)] pt-4 space-y-4">

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
                      {t("orderItems")}
                    </p>
                    <div className="space-y-1">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between text-sm py-1">
                          <span className="text-[var(--foreground)]">
                            {item.product.name}
                            <span className="text-[var(--muted)] ml-2">× {item.quantity}</span>
                          </span>
                          <span className="font-medium text-[var(--foreground)]">
                            {formatRWF(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Payment summary */}
                    <div className="mt-2 pt-2 border-t border-dashed border-[var(--border)] flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PAYMENT_STATUS_STYLES[order.paymentStatus]}`}>
                          {t(`payment.${order.paymentStatus}`)}
                        </span>
                        {(order.amountPaid ?? 0) > 0 && (
                          <span className="text-xs text-[var(--muted)]">
                            {t("paidOf", { paid: formatRWF(order.amountPaid), total: formatRWF(order.totalAmount) })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/orders/${order.id}/invoice`} className="flex items-center gap-1 text-xs text-baraka-sage hover:text-baraka-primary transition-colors">
                          <FileText size={13} /> Invoice
                        </Link>
                        {order.status !== "CANCELLED" && order.paymentStatus !== "PAID" && (
                          <button
                            onClick={() => {
                              setPaymentOrderId(paymentOrderId === order.id ? null : order.id)
                              setPayAmount("")
                              setPayRef("")
                              setPayError("")
                            }}
                            className="flex items-center gap-1 text-xs bg-baraka-primary/10 text-baraka-primary hover:bg-baraka-primary hover:text-white px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <CreditCard size={13} /> {t("recordPayment")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline payment form */}
                  {paymentOrderId === order.id && (
                    <div className="bg-[var(--background)] rounded-lg p-4 border border-[var(--border)] space-y-3">
                      <p className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">
                        {t("recordPaymentTitle")}
                      </p>
                      {payError && <p className="text-xs text-red-600">{payError}</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="number" min="0" step="0.01"
                          value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          placeholder={`Amount (max ${formatRWF(order.totalAmount - (order.amountPaid ?? 0))})`}
                          className="col-span-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary"
                        />
                        <select
                          value={payMethod}
                          onChange={e => setPayMethod(e.target.value as Payment["method"])}
                          className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] outline-none focus:border-baraka-primary"
                        >
                          {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input
                          type="text"
                          value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                          placeholder="Ref / MoMo ID (optional)"
                          className="px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handlePayment(order.id)} disabled={payLoading} className="bg-baraka-primary hover:bg-baraka-dark text-white text-xs px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                          {payLoading ? t("savingPayment") : t("savePayment")}
                        </Button>
                        <Button onClick={() => setPaymentOrderId(null)} className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-xs px-4 py-2 rounded-lg hover:bg-[var(--border)] transition-colors">
                          {tCommon("cancel")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Payment history */}
                  {order.payments && order.payments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
                        {t("paymentsLabel")}
                      </p>
                      <div className="space-y-1">
                        {order.payments.map(p => (
                          <div key={p.id} className="flex justify-between text-sm py-1">
                            <span className="text-[var(--muted)]">
                              {METHOD_LABELS[p.method]}
                              {p.reference && <span className="ml-1 text-xs">· {p.reference}</span>}
                              <span className="ml-2 text-xs">{formatDate(p.paidAt)}</span>
                            </span>
                            <span className="font-medium text-emerald-600">{formatRWF(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {order.notes && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted)] mb-1 uppercase tracking-wide">
                        {tCommon("notes")}
                      </p>
                      <p className="text-sm text-[var(--foreground)]">{order.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                    <div className="flex gap-2">
                      {nextStatuses[order.status].map(next => (
                        <Button
                          key={next.value}
                          onClick={() =>
                            next.value === "DELIVERED"
                              ? setDeliverOrder(order)
                              : handleStatusChange(order.id, next.value)
                          }
                          disabled={updatingId === order.id}
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            next.value === "CANCELLED"
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-baraka-primary text-white hover:bg-baraka-dark"
                          }`}
                        >
                          {updatingId === order.id ? tCommon("updating") : next.label}
                        </Button>
                      ))}
                      {order.status === "DELIVERED" && (
                        <Button
                          onClick={() => { setReturnOrder(order); setReturnReason(""); setReturnCredit(true); setReturnError("") }}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                        >
                          <RotateCcw size={13} />
                          {t("returnOrder")}
                        </Button>
                      )}
                    </div>
                    {(order.status === "CANCELLED" || order.status === "PENDING") && (
                      <button
                        onClick={() => handleDelete(order.id)}
                        disabled={deletingId === order.id}
                        className="flex items-center gap-1.5 text-xs text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {deletingId === order.id ? tCommon("deleting") : tCommon("delete")}
                      </button>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── PAGINATION ── */}
      {!isLoading && meta.pages > 1 && (
        <div className="flex items-center justify-between px-1 py-2">
          <p className="text-sm text-[var(--muted)]">
            {t("showingOfOrders", { from, to, total: meta.total })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {tCommon("previous")}
            </button>
            <span className="text-sm text-[var(--muted)] px-2">
              {tCommon("pageOf", { page: meta.page, pages: meta.pages })}
            </span>
            <button
              onClick={() => goToPage(meta.page + 1)}
              disabled={meta.page >= meta.pages}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {tCommon("next")}
            </button>
          </div>
        </div>
      )}

      {/* ── ORDER MODAL ── */}
      <OrderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      {/* ── RETURN ORDER MODAL ── */}
      {returnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setReturnOrder(null)}>
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                  <RotateCcw size={18} className="text-orange-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--foreground)]">{t("returnOrderTitle")}</h2>
                  <p className="text-xs text-[var(--muted)]">{returnOrder.orderNumber} · {returnOrder.customerName}</p>
                </div>
              </div>
              <button onClick={() => setReturnOrder(null)} className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[var(--muted)]">
                {t("returnWarning")} <strong className="text-[var(--foreground)]">RWF {Number(returnOrder.totalAmount).toLocaleString()}</strong>
              </p>
              {returnError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{returnError}</p>}
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                  {t("returnReasonLabel")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  rows={3}
                  placeholder={t("returnReasonPlaceholder")}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary resize-none placeholder:text-[var(--muted)]"
                />
              </div>
              {returnOrder.customerId && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnCredit}
                    onChange={e => setReturnCredit(e.target.checked)}
                    className="w-4 h-4 accent-baraka-primary"
                  />
                  <span className="text-sm text-[var(--foreground)]">{t("issueCreditNote")}</span>
                </label>
              )}
              <div className="flex gap-3">
                <button onClick={() => setReturnOrder(null)} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--background)] transition-colors">
                  {tCommon("cancel")}
                </button>
                <button onClick={handleReturn} disabled={returning} className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <RotateCcw size={15} />
                  {returning ? t("processing") : t("confirmReturn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELIVERY CONFIRMATION MODAL ── */}
      {deliverOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setDeliverOrder(null); setDeliveryNotes("") }}>
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Truck size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--foreground)]">{t("markAsDelivered")}</h2>
                  <p className="text-xs text-[var(--muted)]">{deliverOrder.orderNumber} · {deliverOrder.customerName}</p>
                </div>
              </div>
              <button onClick={() => { setDeliverOrder(null); setDeliveryNotes("") }} className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                  {t("deliveryNotesLabel")}
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  rows={3}
                  placeholder={t("deliveryNotesPlaceholder")}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary resize-none placeholder:text-[var(--muted)]"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setDeliverOrder(null); setDeliveryNotes("") }} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--background)] transition-colors">
                  {tCommon("cancel")}
                </button>
                <button onClick={handleConfirmDelivery} disabled={delivering} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Truck size={15} />
                  {delivering ? tCommon("updating") : t("confirmDelivery")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
