"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, ClipboardList, ChevronDown, X, Loader2, Trash2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type POStatus = "DRAFT" | "SENT" | "CONFIRMED" | "RECEIVED" | "CANCELLED"

const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT:     "bg-gray-100 text-gray-700",
  SENT:      "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-yellow-100 text-yellow-800",
  RECEIVED:  "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
}

interface Supplier { id: string; name: string }
interface Product  { id: string; name: string; unit: string }

interface POItem {
  id:               string
  productId:        string
  quantity:         number
  quantityReceived: number
  unitCost:         number
  product:          { id: string; name: string; unit: string }
}

interface PurchaseOrder {
  id:           string
  poNumber:     string
  status:       POStatus
  totalCost:    number
  expectedDate: string | null
  notes:        string | null
  createdAt:    string
  supplier:     { id: string; name: string }
  createdBy:    { id: string; name: string }
  items:        POItem[]
}

interface Meta { total: number; page: number; limit: number; pages: number }

function formatRWF(n: number) { return `RWF ${Number(n).toLocaleString()}` }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })
}

// ── Create Modal ───────────────────────────────────────────────────────────────
function CreatePOModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: () => void
}) {
  const [suppliers,    setSuppliers]    = useState<Supplier[]>([])
  const [products,     setProducts]     = useState<Product[]>([])
  const [supplierId,   setSupplierId]   = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes,        setNotes]        = useState("")
  const [items,        setItems]        = useState([{ productId: "", quantity: 1, unitCost: 0 }])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers?all=true").then(r => r.json()),
      fetch("/api/products?all=true").then(r => r.json()),
    ]).then(([s, p]) => {
      setSuppliers(Array.isArray(s) ? s : s.data ?? [])
      setProducts(Array.isArray(p) ? p : p.data ?? [])
    })
  }, [])

  function addItem() { setItems(prev => [...prev, { productId: "", quantity: 1, unitCost: 0 }]) }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, key: string, value: string | number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item))
  }

  const total = items.reduce((sum, it) => sum + (it.quantity * it.unitCost), 0)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!supplierId) { setError("Select a supplier"); return }
    if (items.some(it => !it.productId)) { setError("Select a product for each line"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          expectedDate: expectedDate || null,
          notes: notes || null,
          items: items.map(it => ({ productId: it.productId, quantity: Number(it.quantity), unitCost: Number(it.unitCost) })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create purchase order")
      }
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-baraka-sage/40 bg-[var(--card)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl bg-[var(--card)] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">New Purchase Order</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Supplier *</label>
              <div className="relative">
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={`${inputClass} appearance-none pr-8`}>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Expected Delivery</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Items *</label>
              <button type="button" onClick={addItem} className="text-xs text-baraka-primary hover:underline flex items-center gap-1">
                <Plus size={12} /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                  <div className="relative">
                    <select value={item.productId} onChange={e => updateItem(i, "productId", e.target.value)} className={`${inputClass} appearance-none pr-8`}>
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  </div>
                  <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} className={inputClass} placeholder="Qty" />
                  <input type="number" min="0" step="0.01" value={item.unitCost || ""} onChange={e => updateItem(i, "unitCost", e.target.value)} className={inputClass} placeholder="Unit cost" />
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1} className="p-1.5 text-[var(--muted)] hover:text-red-500 disabled:opacity-30 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-right">
              <span className="text-sm font-semibold text-[var(--foreground)]">Total: {formatRWF(total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Creating...</span> : "Create PO"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────
function ReceiveModal({
  po,
  onClose,
  onReceived,
}: {
  po:         PurchaseOrder
  onClose:    () => void
  onReceived: (updated: PurchaseOrder) => void
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of po.items) {
      init[item.id] = item.quantity - item.quantityReceived
    }
    return init
  })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    const items = Object.entries(quantities).map(([id, quantityReceived]) => ({ id, quantityReceived }))
    if (!items.some(i => i.quantityReceived > 0)) { setError("Enter at least one quantity to receive"); return }

    setSaving(true)
    setError("")
    const res  = await fetch(`/api/purchase-orders/${po.id}/receive`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ items }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || "Failed to receive"); return }
    setSuccess(true)
    setTimeout(() => { onReceived(data); onClose() }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div>
            <h2 className="font-semibold text-[var(--foreground)]">Receive Stock</h2>
            <p className="text-xs text-[var(--muted)]">{po.poNumber} · {po.supplier.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-[var(--muted)]">
            Enter the quantity received for each item. Leave 0 to skip an item (partial receive).
          </p>
          <div className="space-y-3">
            {po.items.map(item => {
              const remaining = item.quantity - item.quantityReceived
              return (
                <div key={item.id} className="bg-[var(--background)] rounded-xl p-3">
                  <p className="text-sm font-semibold text-[var(--foreground)] mb-1">{item.product.name}</p>
                  <p className="text-xs text-[var(--muted)] mb-2">
                    Ordered: {item.quantity} · Already received: {item.quantityReceived} · Remaining: {remaining}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[var(--muted)] whitespace-nowrap">Receiving now:</label>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      value={quantities[item.id] ?? 0}
                      onChange={e => setQuantities(prev => ({
                        ...prev,
                        [item.id]: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)),
                      }))}
                      className="w-24 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary"
                      disabled={remaining === 0}
                    />
                    {remaining === 0 && (
                      <span className="text-xs text-emerald-600 font-medium">Fully received</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success ? (
            <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-medium">
              <CheckCircle size={18} /> Stock updated!
            </div>
          ) : (
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--background)] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-baraka-primary hover:bg-baraka-dark text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Confirm Receipt"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PurchaseOrdersPage() {
  const [orders,     setOrders]     = useState<PurchaseOrder[]>([])
  const [meta,       setMeta]       = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 0 })
  const [isLoading,  setIsLoading]  = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null)
  const [page,       setPage]       = useState(1)
  const [key,        setKey]        = useState(0)
  const [actionId,   setActionId]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/purchase-orders?page=${page}&limit=50`)
      .then(r => r.json())
      .then(json => {
        setOrders(json.data ?? [])
        setMeta(json.meta)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [page, key])

  const refresh = useCallback(() => { setIsLoading(true); setKey(k => k + 1) }, [])

  async function handleStatusChange(id: string, status: POStatus) {
    setActionId(id)
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
    }
    setActionId(null)
  }


  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase order?")) return
    setActionId(id)
    await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" })
    setOrders(prev => prev.filter(o => o.id !== id))
    setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
    setActionId(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Purchase Orders</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{meta.total} total orders</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={18} /> New PO
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-baraka-sage" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList size={40} className="text-baraka-sage/40" />
            <p className="text-sm font-medium text-[var(--foreground)]">No purchase orders yet</p>
            <p className="text-xs text-[var(--muted)]">Create a PO to track goods ordered from suppliers.</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">PO #</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">Supplier</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">Status</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">Total Cost</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">Expected</th>
                  <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono font-semibold text-[var(--foreground)]">{o.poNumber}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{o.items.length} item{o.items.length !== 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--foreground)]">{o.supplier.name}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{formatRWF(o.totalCost)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--muted)]">
                        {o.expectedDate ? formatDate(o.expectedDate) : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {o.status !== "RECEIVED" && o.status !== "CANCELLED" && (
                          <>
                            {o.status !== "DRAFT" && (
                              <button
                                onClick={() => setReceivingPO(o)}
                                disabled={actionId === o.id}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                title="Mark as received"
                              >
                                <CheckCircle size={13} />
                                Receive
                              </button>
                            )}
                            {o.status === "DRAFT" && (
                              <button
                                onClick={() => handleStatusChange(o.id, "SENT")}
                                disabled={actionId === o.id}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                              >
                                Mark Sent
                              </button>
                            )}
                          </>
                        )}
                        {(o.status === "DRAFT" || o.status === "CANCELLED") && (
                          <button
                            onClick={() => handleDelete(o.id)}
                            disabled={actionId === o.id}
                            className="p-2 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {meta.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--muted)]">
                  Showing {Math.min((meta.page - 1) * meta.limit + 1, meta.total)}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={meta.page <= 1} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] disabled:opacity-40 transition-colors">Previous</button>
                  <span className="text-sm text-[var(--muted)] px-1">Page {meta.page} of {meta.pages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={meta.page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreatePOModal
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}

      {receivingPO && (
        <ReceiveModal
          po={receivingPO}
          onClose={() => setReceivingPO(null)}
          onReceived={updated => {
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
            setReceivingPO(null)
          }}
        />
      )}
    </div>
  )
}
