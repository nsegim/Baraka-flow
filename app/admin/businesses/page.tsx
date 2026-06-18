"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Building2, Search, RefreshCw, Users, ShoppingCart, Package,
  ChevronDown, ChevronUp, Plus, ShieldOff, ShieldCheck,
  Trash2, Settings2, X, Loader2,
} from "lucide-react"

interface Business {
  id: string; name: string; email: string; phone: string | null
  currency: string; status: "ACTIVE" | "SUSPENDED"
  suspendedAt: string | null; suspendedReason: string | null
  maxUsers: number | null; maxProducts: number | null
  createdAt: string; updatedAt: string
  _count: { users: number; orders: number; products: number; customers: number; expenses: number; purchaseOrders: number }
}
interface Meta { total: number; page: number; limit: number; pages: number }

// ── Create Business Modal ──────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ businessName: "", ownerName: "", ownerEmail: "", ownerPassword: "", currency: "RWF", maxUsers: "", maxProducts: "" })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const res  = await fetch("/api/admin/businesses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        maxUsers:    form.maxUsers    ? parseInt(form.maxUsers)    : null,
        maxProducts: form.maxProducts ? parseInt(form.maxProducts) : null,
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to create business"); return }
    onCreated()
    onClose()
  }

  const inp = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-semibold text-white">Create New Business</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Business Name *</label>
              <input {...field("businessName")} placeholder="e.g. Baraka Furniture" className={inp} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Owner Name *</label>
              <input {...field("ownerName")} placeholder="Full name" className={inp} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
              <select {...field("currency")} className={inp}>
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Owner Email *</label>
              <input {...field("ownerEmail")} type="email" placeholder="owner@business.com" className={inp} required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Owner Password *</label>
              <input {...field("ownerPassword")} type="password" placeholder="Min 8 characters" className={inp} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Max Users <span className="text-gray-600">(blank = unlimited)</span></label>
              <input {...field("maxUsers")} type="number" min="1" placeholder="∞" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Max Products <span className="text-gray-600">(blank = unlimited)</span></label>
              <input {...field("maxProducts")} type="number" min="1" placeholder="∞" className={inp} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : "Create Business"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Suspend Modal ──────────────────────────────────────────────────────────────
function SuspendModal({ biz, onClose, onDone }: { biz: Business; onClose: () => void; onDone: () => void }) {
  const [reason,  setReason]  = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function handleSuspend() {
    setLoading(true); setError("")
    const res  = await fetch(`/api/admin/businesses/${biz.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suspend", suspendedReason: reason }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to suspend"); return }
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center"><ShieldOff size={18} className="text-red-400" /></div>
          <div>
            <h2 className="font-semibold text-white">Suspend Business</h2>
            <p className="text-xs text-gray-500">{biz.name}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">All users of this business will be locked out immediately. They will see the suspension reason when trying to sign in.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Reason (shown to users)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Unpaid subscription, policy violation..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
            <button onClick={handleSuspend} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
              Suspend
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Limits Modal ───────────────────────────────────────────────────────────────
function LimitsModal({ biz, onClose, onDone }: { biz: Business; onClose: () => void; onDone: () => void }) {
  const [maxUsers,    setMaxUsers]    = useState(biz.maxUsers?.toString()    ?? "")
  const [maxProducts, setMaxProducts] = useState(biz.maxProducts?.toString() ?? "")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")

  async function handleSave() {
    setLoading(true); setError("")
    const res = await fetch(`/api/admin/businesses/${biz.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:      "set-limits",
        maxUsers:    maxUsers    ? parseInt(maxUsers)    : null,
        maxProducts: maxProducts ? parseInt(maxProducts) : null,
      }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to update"); return }
    onDone(); onClose()
  }

  const inp = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center"><Settings2 size={18} className="text-blue-400" /></div>
          <div>
            <h2 className="font-semibold text-white">Usage Limits</h2>
            <p className="text-xs text-gray-500">{biz.name} · leave blank for unlimited</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Users</label>
              <input type="number" min="1" value={maxUsers} onChange={e => setMaxUsers(e.target.value)} placeholder="∞" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Products</label>
              <input type="number" min="1" value={maxProducts} onChange={e => setMaxProducts(e.target.value)} placeholder="∞" className={inp} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Limits
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [meta,       setMeta]       = useState<Meta>({ total: 0, page: 1, limit: 20, pages: 0 })
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [search,     setSearch]     = useState("")
  const [page,       setPage]       = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showCreate,  setShowCreate]  = useState(false)
  const [suspendBiz,  setSuspendBiz]  = useState<Business | null>(null)
  const [limitsBiz,   setLimitsBiz]   = useState<Business | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetch(`/api/admin/businesses?page=${page}&search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(json => { setBusinesses(json.data); setMeta(json.meta); setIsLoading(false) })
      .catch(() => { setError("Failed to load businesses"); setIsLoading(false) })
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  async function handleUnsuspend(biz: Business) {
    const res = await fetch(`/api/admin/businesses/${biz.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsuspend" }),
    })
    if (res.ok) load()
  }

  async function handleDelete(biz: Business) {
    if (!confirm(`Permanently delete "${biz.name}" and ALL their data? This cannot be undone.`)) return
    setDeletingId(biz.id)
    const res = await fetch(`/api/admin/businesses/${biz.id}`, { method: "DELETE" })
    setDeletingId(null)
    if (res.ok) load()
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Businesses</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} registered tenant{meta.total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> New Business
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500 transition-colors" />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* List */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={18} className="animate-spin text-gray-600" /></div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Building2 size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No businesses found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {businesses.map(biz => (
              <div key={biz.id}>
                <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/40 transition-colors">
                  {/* Left — click to expand */}
                  <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => setExpandedId(expandedId === biz.id ? null : biz.id)}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${biz.status === "SUSPENDED" ? "bg-red-500/20 border border-red-500/20" : "bg-blue-500/20 border border-blue-500/20"}`}>
                      <span className={`text-sm font-bold ${biz.status === "SUSPENDED" ? "text-red-400" : "text-blue-400"}`}>{biz.name[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{biz.name}</p>
                        {biz.status === "SUSPENDED" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20 shrink-0">SUSPENDED</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{biz.email}</p>
                    </div>
                  </div>

                  {/* Right — stats + actions */}
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users size={11} />{biz._count.users}{biz.maxUsers ? `/${biz.maxUsers}` : ""}</span>
                      <span className="flex items-center gap-1"><ShoppingCart size={11} />{biz._count.orders}</span>
                      <span className="flex items-center gap-1"><Package size={11} />{biz._count.products}{biz.maxProducts ? `/${biz.maxProducts}` : ""}</span>
                    </div>
                    <span className="text-xs text-gray-600 hidden sm:block">{formatDate(biz.createdAt)}</span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => setLimitsBiz(biz)} title="Set limits" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-blue-400 transition-colors">
                        <Settings2 size={14} />
                      </button>
                      {biz.status === "ACTIVE" ? (
                        <button onClick={() => setSuspendBiz(biz)} title="Suspend" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-red-400 transition-colors">
                          <ShieldOff size={14} />
                        </button>
                      ) : (
                        <button onClick={() => handleUnsuspend(biz)} title="Unsuspend" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-emerald-400 transition-colors">
                          <ShieldCheck size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(biz)} disabled={deletingId === biz.id} title="Delete permanently" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-red-500 transition-colors disabled:opacity-40">
                        {deletingId === biz.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                    <div className="cursor-pointer" onClick={() => setExpandedId(expandedId === biz.id ? null : biz.id)}>
                      {expandedId === biz.id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === biz.id && (
                  <div className="px-5 pb-5 pt-2 bg-gray-800/30 border-t border-gray-800">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-2">
                      {[
                        { label: "Users",    value: `${biz._count.users}${biz.maxUsers ? ` / ${biz.maxUsers}` : ""}` },
                        { label: "Orders",   value: biz._count.orders },
                        { label: "Products", value: `${biz._count.products}${biz.maxProducts ? ` / ${biz.maxProducts}` : ""}` },
                        { label: "Customers",       value: biz._count.customers },
                        { label: "Expenses",         value: biz._count.expenses },
                        { label: "Purchase Orders",  value: biz._count.purchaseOrders },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                          <p className="text-xs text-gray-500">{s.label}</p>
                          <p className="text-base font-bold text-white mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      {biz.phone && <span>Phone: {biz.phone}</span>}
                      <span>Currency: {biz.currency}</span>
                      <span>Joined: {formatDate(biz.createdAt)}</span>
                      {biz.suspendedAt && <span className="text-red-400">Suspended: {formatDate(biz.suspendedAt)} {biz.suspendedReason ? `— ${biz.suspendedReason}` : ""}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Showing {Math.min((meta.page - 1) * meta.limit + 1, meta.total)}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Previous</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">Page {meta.page} of {meta.pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate  && <CreateModal  onClose={() => setShowCreate(false)}  onCreated={load} />}
      {suspendBiz  && <SuspendModal biz={suspendBiz}  onClose={() => setSuspendBiz(null)}  onDone={load} />}
      {limitsBiz   && <LimitsModal  biz={limitsBiz}   onClose={() => setLimitsBiz(null)}   onDone={load} />}
    </div>
  )
}
