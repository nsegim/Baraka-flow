"use client"

import { useState, useEffect } from "react"
import {
  X, BarChart2, ArrowUp, ArrowDown,
  Package, Loader2, CheckCircle,
} from "lucide-react"

interface Product {
  id:    string
  name:  string
  stock: number
  unit:  string
}

interface Movement {
  id:        string
  type:      string
  quantity:  number
  reason:    string | null
  createdAt: string
  user:      { name: string } | null
}

const MOVEMENT_COLORS: Record<string, string> = {
  ADJUSTMENT: "bg-blue-100 text-blue-700",
  DAMAGE:     "bg-red-100 text-red-700",
  RETURN:     "bg-emerald-100 text-emerald-700",
  IMPORT:     "bg-purple-100 text-purple-700",
  SALE:       "bg-gray-100 text-gray-600",
}
const MOVEMENT_LABELS: Record<string, string> = {
  ADJUSTMENT: "Adjust",
  DAMAGE:     "Damage",
  RETURN:     "Return",
  IMPORT:     "Import",
  SALE:       "Sale",
}

function MovementBadge({ type }: { type: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${MOVEMENT_COLORS[type] ?? "bg-gray-100 text-gray-600"}`}>
      {MOVEMENT_LABELS[type] ?? type}
    </span>
  )
}

export default function StockAdjustModal({
  product,
  onClose,
  onAdjusted,
}: {
  product:    Product
  onClose:    () => void
  onAdjusted: () => void
}) {
  const [tab,       setTab]       = useState<"adjust" | "history">("adjust")
  const [type,      setType]      = useState<"ADJUSTMENT" | "DAMAGE" | "RETURN">("ADJUSTMENT")
  const [direction, setDirection] = useState<"add" | "remove">("add")
  const [quantity,  setQuantity]  = useState("1")
  const [reason,    setReason]    = useState("")
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState(false)
  const [history,   setHistory]   = useState<Movement[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const qty      = Math.max(0, parseInt(quantity) || 0)
  const isAdd    = type === "RETURN" || (type === "ADJUSTMENT" && direction === "add")
  const delta    = type === "DAMAGE" ? -qty : isAdd ? qty : -qty
  const newStock = product.stock + delta

  useEffect(() => {
    setLoadingHistory(true)
    fetch(`/api/products/${product.id}/adjustments`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoadingHistory(false) })
      .catch(() => setLoadingHistory(false))
  }, [product.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (qty <= 0)         { setError("Quantity must be at least 1"); return }
    if (!reason.trim())   { setError("Please provide a reason"); return }
    if (newStock < 0)     { setError(`Cannot remove ${qty} — only ${product.stock} in stock`); return }

    setSaving(true)
    setError("")

    const res  = await fetch(`/api/products/${product.id}/adjustments`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, quantity: qty, direction, reason: reason.trim() }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error || "Failed to save adjustment"); return }

    setSuccess(true)
    setHistory(prev => [data, ...prev])
    setTimeout(() => { onAdjusted(); onClose() }, 1200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-baraka-sage/20 rounded-lg flex items-center justify-center">
              <BarChart2 size={18} className="text-baraka-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Stock Adjustment</h2>
              <p className="text-xs text-[var(--muted)]">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current stock pill */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between bg-[var(--background)] rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-[var(--muted)]" />
              <span className="text-sm text-[var(--muted)]">Current stock</span>
            </div>
            <span className="text-lg font-bold text-[var(--foreground)]">
              {product.stock}{" "}
              <span className="text-sm font-normal text-[var(--muted)]">{product.unit}s</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {(["adjust", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-baraka-primary text-white"
                  : "text-[var(--muted)] hover:bg-[var(--background)]"
              }`}
            >
              {t === "adjust" ? "Adjust Stock" : "History"}
            </button>
          ))}
        </div>

        {/* ── Adjust form ── */}
        {tab === "adjust" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {/* Type selector */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Adjustment Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "ADJUSTMENT", icon: "±", label: "Correct",  sub: "count fix"   },
                  { value: "DAMAGE",     icon: "−", label: "Damage",   sub: "remove stock" },
                  { value: "RETURN",     icon: "+", label: "Return",   sub: "add back"    },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`p-3 rounded-xl border text-center transition-colors ${
                      type === opt.value
                        ? "border-baraka-primary bg-baraka-primary/10"
                        : "border-[var(--border)] hover:border-baraka-sage"
                    }`}
                  >
                    <div className={`text-lg font-bold ${type === opt.value ? "text-baraka-primary" : "text-[var(--muted)]"}`}>
                      {opt.icon}
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 ${type === opt.value ? "text-baraka-primary" : "text-[var(--foreground)]"}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direction — only for ADJUSTMENT type */}
            {type === "ADJUSTMENT" && (
              <div>
                <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                  Direction
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection("add")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      direction === "add"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <ArrowUp size={14} /> Add (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection("remove")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      direction === "remove"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    <ArrowDown size={14} /> Remove (−)
                  </button>
                </div>
              </div>
            )}

            {/* Quantity + live preview */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary"
                  placeholder="0"
                />
                {qty > 0 && (
                  <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-lg whitespace-nowrap ${
                    delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                    {delta >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    {product.stock} → {Math.max(0, newStock)}
                  </div>
                )}
              </div>
              {newStock < 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Cannot remove more than available stock ({product.stock})
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Physical count shows 3 fewer, 2 units dropped and broken..."
                rows={2}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary resize-none placeholder:text-[var(--muted)]"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {success ? (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-medium">
                <CheckCircle size={18} /> Adjustment saved!
              </div>
            ) : (
              <button
                type="submit"
                disabled={saving || qty <= 0 || !reason.trim() || newStock < 0}
                className="w-full bg-baraka-primary hover:bg-baraka-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? <Loader2 size={16} className="animate-spin mx-auto" />
                  : "Save Adjustment"
                }
              </button>
            )}
          </form>
        )}

        {/* ── History tab ── */}
        {tab === "history" && (
          <div className="p-5">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-baraka-sage" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center py-8 text-sm text-[var(--muted)]">
                No stock movements recorded yet
              </p>
            ) : (
              <div className="space-y-2">
                {history.map(m => (
                  <div key={m.id} className="flex items-start justify-between p-3 bg-[var(--background)] rounded-xl gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <MovementBadge type={m.type} />
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--foreground)] break-words">
                          {m.reason || "No reason recorded"}
                        </p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {new Date(m.createdAt).toLocaleDateString("en-RW", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                          {m.user && ` · ${m.user.name}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap pt-1 ${
                      m.quantity >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {m.quantity >= 0 ? "+" : ""}{m.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
