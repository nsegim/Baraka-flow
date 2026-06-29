"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CrownIcon, Plus, RefreshCw, X, Loader2, Pencil,
  Trash2, Users, Eye, EyeOff, Check,
} from "lucide-react"

interface Plan {
  id: string; name: string; slug: string; description: string | null
  price: number; currency: string
  maxUsers: number | null; maxProducts: number | null
  maxOrders: number | null; maxBranches: number | null
  features: Record<string, boolean>
  isActive: boolean; isPublic: boolean; sortOrder: number
  createdAt: string; updatedAt: string
  _count: { businesses: number }
}

const EMPTY_FORM = {
  name: "", slug: "", description: "",
  price: "0", currency: "RWF",
  maxUsers: "", maxProducts: "", maxOrders: "", maxBranches: "",
  isActive: true, isPublic: true, sortOrder: "0",
  featuresRaw: "",
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function PlanFormModal({
  plan, onClose, onSaved,
}: {
  plan: Plan | null   // null = create
  onClose: () => void
  onSaved:  () => void
}) {
  const [form, setForm] = useState(() => plan ? {
    name:        plan.name,
    slug:        plan.slug,
    description: plan.description ?? "",
    price:       plan.price.toString(),
    currency:    plan.currency,
    maxUsers:    plan.maxUsers?.toString()    ?? "",
    maxProducts: plan.maxProducts?.toString() ?? "",
    maxOrders:   plan.maxOrders?.toString()   ?? "",
    maxBranches: plan.maxBranches?.toString() ?? "",
    isActive:    plan.isActive,
    isPublic:    plan.isPublic,
    sortOrder:   plan.sortOrder.toString(),
    featuresRaw: Object.entries(plan.features ?? {}).map(([k, v]) => `${k}=${v}`).join("\n"),
  } : EMPTY_FORM)

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value })),
  })

  function parseFeatures(raw: string): Record<string, boolean> {
    const out: Record<string, boolean> = {}
    raw.split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
      const [k, v] = l.split("=")
      if (k?.trim()) out[k.trim()] = v?.trim() !== "false"
    })
    return out
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const body = {
      name:        form.name,
      slug:        form.slug,
      description: form.description || null,
      price:       parseFloat(form.price) || 0,
      currency:    form.currency,
      maxUsers:    form.maxUsers    ? parseInt(form.maxUsers)    : null,
      maxProducts: form.maxProducts ? parseInt(form.maxProducts) : null,
      maxOrders:   form.maxOrders   ? parseInt(form.maxOrders)   : null,
      maxBranches: form.maxBranches ? parseInt(form.maxBranches) : null,
      isActive:    form.isActive,
      isPublic:    form.isPublic,
      sortOrder:   parseInt(form.sortOrder) || 0,
      features:    parseFeatures(form.featuresRaw),
    }
    const url    = plan ? `/api/admin/plans/${plan.id}` : "/api/admin/plans"
    const method = plan ? "PATCH" : "POST"
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json   = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to save"); return }
    onSaved(); onClose()
  }

  const inp = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-semibold text-white">{plan ? "Edit Plan" : "Create Plan"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Plan Name *</label>
              <input {...f("name")} placeholder="e.g. Pro" className={inp} required
                onChange={e => {
                  const v = e.target.value
                  setForm(p => ({ ...p, name: v, ...(plan ? {} : { slug: slugify(v) }) }))
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Slug *</label>
              <input {...f("slug")} placeholder="pro" className={inp} required pattern="[a-z][a-z0-9-]*" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sort Order</label>
              <input {...f("sortOrder")} type="number" min="0" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Price</label>
              <input {...f("price")} type="number" min="0" step="0.01" placeholder="0" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Currency</label>
              <select {...f("currency")} className={inp}>
                <option value="RWF">RWF</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
              <textarea {...f("description")} rows={2} placeholder="Brief description shown to businesses…" className={inp + " resize-none"} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-400 mb-2">Limits <span className="text-gray-600">(blank = unlimited)</span></p>
            <div className="grid grid-cols-2 gap-3">
              {(["maxUsers", "maxProducts", "maxOrders", "maxBranches"] as const).map(key => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1 capitalize">{key.replace("max", "Max ")}</label>
                  <input {...f(key)} type="number" min="1" placeholder="∞" className={inp} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Features <span className="text-gray-600">(one per line: key=true or key=false)</span>
            </label>
            <textarea {...f("featuresRaw")} rows={4} placeholder={"apiAccess=true\nadvancedReports=false\nexports=true"} className={inp + " resize-none font-mono text-xs"} />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-gray-300">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.isPublic} onChange={e => setForm(p => ({ ...p, isPublic: e.target.checked }))} className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-gray-300">Public</span>
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {plan ? "Save Changes" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPlansPage() {
  const [plans,      setPlans]      = useState<Plan[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [editPlan,   setEditPlan]   = useState<Plan | null | "new">(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetch("/api/admin/plans")
      .then(r => r.json())
      .then(data => { setPlans(Array.isArray(data) ? data : []); setIsLoading(false) })
      .catch(() => { setError("Failed to load plans"); setIsLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggleActive(plan: Plan) {
    setTogglingId(plan.id)
    await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    })
    setTogglingId(null)
    load()
  }

  async function handleDelete(plan: Plan) {
    const msg = plan._count.businesses > 0
      ? `"${plan.name}" has ${plan._count.businesses} subscriber(s) — it will be deactivated instead of deleted. Continue?`
      : `Permanently delete plan "${plan.name}"? This cannot be undone.`
    if (!confirm(msg)) return
    setDeletingId(plan.id)
    await fetch(`/api/admin/plans/${plan.id}`, { method: "DELETE" })
    setDeletingId(null)
    load()
  }

  function fmt(n: number | null) { return n == null ? "∞" : n.toLocaleString() }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Subscription Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} plan{plans.length !== 1 ? "s" : ""} defined</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setEditPlan("new")} className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> New Plan
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw size={18} className="animate-spin text-gray-600" /></div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CrownIcon size={36} className="text-gray-700" />
          <p className="text-sm text-gray-500">No plans yet — create one to get started</p>
          <button onClick={() => setEditPlan("new")} className="flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.id} className={`bg-gray-900 rounded-xl border p-5 flex flex-col gap-4 transition-colors ${plan.isActive ? "border-gray-700" : "border-gray-800 opacity-60"}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    {!plan.isActive && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-500">inactive</span>}
                    {!plan.isPublic && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-500">hidden</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.slug}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-white">{plan.price === 0 ? "Free" : `${plan.currency} ${plan.price.toLocaleString()}`}</p>
                  {plan.price > 0 && <p className="text-xs text-gray-500">/month</p>}
                </div>
              </div>

              {plan.description && <p className="text-xs text-gray-400">{plan.description}</p>}

              {/* Limits */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Users",    value: fmt(plan.maxUsers),    icon: Users },
                  { label: "Branches", value: fmt(plan.maxBranches), icon: null },
                  { label: "Products", value: fmt(plan.maxProducts), icon: null },
                  { label: "Orders",   value: fmt(plan.maxOrders),   icon: null },
                ].map(row => (
                  <div key={row.label} className="bg-gray-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">{row.label}</p>
                    <p className="text-sm font-semibold text-white">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Features */}
              {Object.keys(plan.features ?? {}).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(plan.features).map(([k, v]) => (
                    <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${v ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-700 text-gray-500 line-through"}`}>{k}</span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-800 mt-auto">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users size={12} />{plan._count.businesses} subscriber{plan._count.businesses !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggleActive(plan)} disabled={togglingId === plan.id} title={plan.isActive ? "Deactivate" : "Activate"} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-yellow-400 transition-colors disabled:opacity-40">
                    {togglingId === plan.id ? <Loader2 size={14} className="animate-spin" /> : plan.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => setEditPlan(plan)} title="Edit" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-blue-400 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(plan)} disabled={deletingId === plan.id} title="Delete" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-red-400 transition-colors disabled:opacity-40">
                    {deletingId === plan.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editPlan !== null && (
        <PlanFormModal
          plan={editPlan === "new" ? null : editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
