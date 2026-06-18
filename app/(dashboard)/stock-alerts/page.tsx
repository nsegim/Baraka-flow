"use client"

import { useState, useEffect, useCallback } from "react"
import {
  AlertTriangle, RefreshCw, Loader2,
  Package, X, Plus, ChevronDown, CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface AlertItem {
  id:              string
  name:            string
  stock:           number
  minStock:        number
  unit:            string
  sku:             string | null
  supplierId:      string | null
  supplierName:    string | null
  supplierCountry: string | null
  categoryName:    string | null
}

interface Supplier { id: string; name: string; country: string | null }

// ── Quick Reorder Modal ────────────────────────────────────────────────────────
function QuickReorderModal({
  product,
  onClose,
  onCreated,
}: {
  product:    AlertItem
  onClose:    () => void
  onCreated:  () => void
}) {
  const defaultQty = Math.max(product.minStock - product.stock, product.minStock)

  const [suppliers,    setSuppliers]    = useState<Supplier[]>([])
  const [supplierId,   setSupplierId]   = useState(product.supplierId ?? "")
  const [quantity,     setQuantity]     = useState(String(defaultQty))
  const [unitCost,     setUnitCost]     = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes,        setNotes]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")
  const [success,      setSuccess]      = useState(false)

  useEffect(() => {
    fetch("/api/suppliers?all=true")
      .then(r => r.json())
      .then(data => setSuppliers(Array.isArray(data) ? data : data.data ?? []))
  }, [])

  const inputClass = "w-full px-3 py-2 rounded-lg border border-baraka-sage/40 bg-[var(--card)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId)          { setError("Select a supplier"); return }
    if (!quantity || Number(quantity) < 1) { setError("Enter a valid quantity"); return }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          expectedDate: expectedDate || null,
          notes: notes || `Reorder for low stock: ${product.name}`,
          items: [{
            productId: product.id,
            quantity:  Number(quantity),
            unitCost:  Number(unitCost) || 0,
          }],
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create purchase order")
      }
      setSuccess(true)
      setTimeout(() => { onCreated(); onClose() }, 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl">

        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">Quick Reorder</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">Creates a draft Purchase Order</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle size={40} className="text-emerald-500" />
            <p className="text-sm font-medium text-[var(--foreground)]">Purchase Order created!</p>
            <p className="text-xs text-[var(--muted)]">Redirecting…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">

            {/* Product info pill */}
            <div className="flex items-center gap-3 p-3 bg-[var(--background)] rounded-xl border border-[var(--border)]">
              <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                <Package size={16} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{product.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  <span className={`font-medium ${product.stock === 0 ? "text-red-600" : "text-yellow-600"}`}>
                    {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                  </span>
                  {" "}· min {product.minStock} {product.unit}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
            )}

            {/* Supplier */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Supplier *</label>
              <div className="relative">
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className={`${inputClass} appearance-none pr-8`}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ""}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              </div>
            </div>

            {/* Quantity + Unit cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Quantity * <span className="text-[var(--muted)] font-normal">({product.unit})</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Unit Cost (RWF)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitCost}
                  onChange={e => setUnitCost(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Expected date */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Expected Delivery</label>
              <input
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder={`Reorder for low stock: ${product.name}`}
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Creating…</span>
                  : <span className="flex items-center justify-center gap-2"><Plus size={16} />Create PO</span>
                }
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StockAlertsPage() {
  const [items,      setItems]      = useState<AlertItem[]>([])
  const [outOfStock, setOutOfStock] = useState(0)
  const [lowStock,   setLowStock]   = useState(0)
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [key,        setKey]        = useState(0)
  const [reordering,   setReordering]   = useState<AlertItem | null>(null)
  const [sendingAlert, setSendingAlert] = useState(false)
  const [alertSent,    setAlertSent]    = useState(false)
  const [alertError,   setAlertError]   = useState("")

  async function handleSendAlert() {
    setSendingAlert(true)
    setAlertError("")
    setAlertSent(false)
    try {
      const res  = await fetch("/api/alerts/low-stock", { method: "POST" })
      const json = await res.json()
      if (!res.ok) { setAlertError(json.error || "Failed to send alert"); return }
      setAlertSent(true)
      setTimeout(() => setAlertSent(false), 4000)
    } catch {
      setAlertError("Failed to send alert")
    } finally {
      setSendingAlert(false)
    }
  }

  useEffect(() => {
    fetch("/api/stock-alerts")
      .then(r => r.json())
      .then(data => {
        setItems(data.items ?? [])
        setOutOfStock(data.outOfStock ?? 0)
        setLowStock(data.lowStock ?? 0)
        setIsLoading(false)
      })
      .catch(() => {
        setError("Failed to load stock alerts")
        setIsLoading(false)
      })
  }, [key])

  const refresh = useCallback(() => { setIsLoading(true); setKey(k => k + 1) }, [])

  function stockPercent(item: AlertItem) {
    if (item.minStock === 0) return 0
    return Math.min(100, Math.round((item.stock / item.minStock) * 100))
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Stock Alerts</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Products at or below their minimum stock level
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertError && <p className="text-xs text-red-500">{alertError}</p>}
          {alertSent  && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={13} /> Alert sent!</p>}
          <button
            onClick={handleSendAlert}
            disabled={sendingAlert || items.length === 0}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            {sendingAlert ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
            {sendingAlert ? "Sending..." : "Email Alert"}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-2 text-sm text-baraka-sage hover:text-baraka-primary transition-colors"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--card)] rounded-xl p-5 border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <p className="text-sm text-[var(--muted)]">Out of Stock</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{outOfStock}</p>
          <p className="text-xs text-[var(--muted)] mt-1">Needs immediate reorder</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-5 border border-yellow-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-yellow-600" />
            </div>
            <p className="text-sm text-[var(--muted)]">Running Low</p>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{lowStock}</p>
          <p className="text-xs text-[var(--muted)] mt-1">Below minimum threshold</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-baraka-sage" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Button onClick={refresh}>Try again</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckCircle size={40} className="text-emerald-400" />
            <p className="text-sm font-medium text-[var(--foreground)]">All stock levels are healthy</p>
            <p className="text-xs text-[var(--muted)]">No products are below their minimum threshold right now.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">Product</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">Supplier</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide w-48">Stock Level</th>
                <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map(item => {
                const pct      = stockPercent(item)
                const critical = item.stock === 0
                return (
                  <tr key={item.id} className={`hover:bg-[var(--background)] transition-colors ${critical ? "bg-red-50/30" : ""}`}>

                    {/* Product */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${critical ? "bg-red-100" : "bg-yellow-100"}`}>
                          <Package size={15} className={critical ? "text-red-600" : "text-yellow-600"} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {item.categoryName ?? "Uncategorized"}
                            {item.sku ? ` · ${item.sku}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-4">
                      {item.supplierName ? (
                        <div>
                          <p className="text-sm text-[var(--foreground)]">{item.supplierName}</p>
                          {item.supplierCountry && (
                            <p className="text-xs text-[var(--muted)]">{item.supplierCountry}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted)] italic">No supplier</span>
                      )}
                    </td>

                    {/* Stock level with progress bar */}
                    <td className="px-4 py-4 w-48">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-sm font-bold ${critical ? "text-red-600" : "text-yellow-600"}`}>
                          {critical ? "Out of stock" : `${item.stock} ${item.unit}`}
                        </span>
                        <span className="text-xs text-[var(--muted)]">min {item.minStock}</span>
                      </div>
                      <div className="w-full h-2 bg-[var(--background)] rounded-full overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${critical ? "bg-red-500" : pct <= 50 ? "bg-yellow-500" : "bg-orange-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-1">{pct}% of minimum</p>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setReordering(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-baraka-primary/10 text-baraka-primary hover:bg-baraka-primary hover:text-white transition-colors ml-auto"
                      >
                        <Plus size={13} />
                        Reorder
                      </button>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Reorder Modal */}
      {reordering && (
        <QuickReorderModal
          product={reordering}
          onClose={() => setReordering(null)}
          onCreated={refresh}
        />
      )}

    </div>
  )
}
