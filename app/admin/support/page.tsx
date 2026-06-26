"use client"

import { useState, useEffect, useCallback } from "react"
import {
  HeadphonesIcon, Plus, RefreshCw, Clock, CheckCircle,
  XCircle, Ban, Eye, X, Loader2, AlertTriangle,
} from "lucide-react"

interface SupportSession {
  id: string
  status: "ACTIVE" | "EXPIRED" | "REVOKED" | "ENDED"
  accessScope: "READ_ONLY" | "FULL_IMPERSONATION"
  justification: string
  expiresAt: string
  endedAt: string | null
  createdAt: string
  ipAddress: string | null
  business: { id: string; name: string; email: string }
  platformUser: { id: string; name: string; email: string }
  _count: { actions: number }
}

interface Business { id: string; name: string; email: string }
interface Meta { total: number; page: number; limit: number; pages: number }

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:  "bg-emerald-500/20 text-emerald-400",
  EXPIRED: "bg-gray-700 text-gray-400",
  REVOKED: "bg-red-500/20 text-red-400",
  ENDED:   "bg-gray-700 text-gray-400",
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  ACTIVE:  <Clock       size={12} />,
  EXPIRED: <XCircle     size={12} />,
  REVOKED: <Ban         size={12} />,
  ENDED:   <CheckCircle size={12} />,
}

// ── Open Session Modal ────────────────────────────────────────────────────────
function OpenSessionModal({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [form, setForm] = useState({
    businessId:    "",
    justification: "",
    accessScope:   "READ_ONLY" as "READ_ONLY" | "FULL_IMPERSONATION",
    durationHours: 4,
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  useEffect(() => {
    fetch("/api/admin/businesses?limit=100")
      .then(r => r.json())
      .then(json => setBusinesses(json.data ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    const res = await fetch("/api/admin/support-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to open session"); return }
    onOpened(); onClose()
  }

  const inp = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <HeadphonesIcon size={16} className="text-amber-400" />
            </div>
            <h2 className="font-semibold text-white">Open Support Session</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">Every action performed during this session is logged and the tenant owner will be notified.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Tenant Business *</label>
            <select
              value={form.businessId}
              onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))}
              className={inp}
              required
            >
              <option value="">Select business…</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name} · {b.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Justification * <span className="text-gray-600">(min 10 chars — stored permanently)</span></label>
            <textarea
              value={form.justification}
              onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
              rows={3}
              placeholder="e.g. Customer ticket #1234 — owner cannot reconcile stock levels after migration…"
              required
              className={`${inp} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Access Scope *</label>
              <select
                value={form.accessScope}
                onChange={e => setForm(f => ({ ...f, accessScope: e.target.value as "READ_ONLY" | "FULL_IMPERSONATION" }))}
                className={inp}
              >
                <option value="READ_ONLY">Read Only</option>
                <option value="FULL_IMPERSONATION">Full Impersonation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Duration (hours)</label>
              <select
                value={form.durationHours}
                onChange={e => setForm(f => ({ ...f, durationHours: parseInt(e.target.value) }))}
                className={inp}
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !form.businessId || form.justification.length < 10}
              className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Opening…</> : "Open Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Session Detail Modal ──────────────────────────────────────────────────────
function SessionDetailModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data,    setData]    = useState<SupportSession & { actions: { id: string; action: string; createdAt: string; entityType: string | null }[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/support-sessions/${sessionId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <h2 className="font-semibold text-white">Session Detail</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8"><RefreshCw size={18} className="animate-spin text-gray-600" /></div>
          ) : !data ? (
            <p className="text-sm text-gray-500 text-center py-8">Failed to load session</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Business",    value: data.business.name },
                  { label: "Agent",       value: data.platformUser.name },
                  { label: "Scope",       value: data.accessScope.replace("_", " ") },
                  { label: "Status",      value: data.status },
                  { label: "Created",     value: new Date(data.createdAt).toLocaleString() },
                  { label: "Expires",     value: new Date(data.expiresAt).toLocaleString() },
                  { label: "Actions",     value: data.actions.length },
                  { label: "IP Address",  value: data.ipAddress ?? "—" },
                ].map(row => (
                  <div key={row.label} className="bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{row.label}</p>
                    <p className="text-sm font-medium text-white mt-0.5 break-all">{row.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1.5">Justification</p>
                <p className="text-sm text-gray-300 bg-gray-800 rounded-lg p-3">{data.justification}</p>
              </div>
              {data.actions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1.5">Actions Taken (latest 100)</p>
                  <div className="bg-gray-800 rounded-lg divide-y divide-gray-700 overflow-hidden">
                    {data.actions.map(a => (
                      <div key={a.id} className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-mono">{a.action}</span>
                        <span className="text-gray-500">{new Date(a.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SupportSessionsPage() {
  const [sessions,    setSessions]    = useState<SupportSession[]>([])
  const [meta,        setMeta]        = useState<Meta>({ total: 0, page: 1, limit: 20, pages: 0 })
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page,        setPage]        = useState(1)
  const [showOpen,    setShowOpen]    = useState(false)
  const [detailId,    setDetailId]    = useState<string | null>(null)
  const [endingId,    setEndingId]    = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(page), ...(statusFilter ? { status: statusFilter } : {}) })
    fetch(`/api/admin/support-sessions?${q}`)
      .then(r => r.json())
      .then(json => { setSessions(json.data ?? []); setMeta(json.meta); setLoading(false) })
      .catch(() => { setError("Failed to load sessions"); setLoading(false) })
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter])

  async function handleEnd(id: string, action: "end" | "revoke") {
    if (!confirm(action === "revoke"
      ? "Revoke this session? The agent will immediately lose access."
      : "End this session?"
    )) return
    setEndingId(id)
    await fetch(`/api/admin/support-sessions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    setEndingId(null)
    load()
  }

  function timeLeft(expiresAt: string): string {
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return "Expired"
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`
  }

  return (
    <div className="space-y-5 max-w-6xl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Support Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Audited tenant access for support purposes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowOpen(true)} className="flex items-center gap-2 text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Open Session
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "ACTIVE", "ENDED", "EXPIRED", "REVOKED"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-gray-700 text-white"
                : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={18} className="animate-spin text-gray-600" /></div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <HeadphonesIcon size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No support sessions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {sessions.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-800/40 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white">{s.business.name}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[s.status]}`}>
                        {STATUS_ICON[s.status]} {s.status}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
                        {s.accessScope === "READ_ONLY" ? "Read Only" : "Full Access"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.platformUser.name} · {s._count.actions} actions
                      {s.status === "ACTIVE" && <span className="text-amber-400 ml-2">{timeLeft(s.expiresAt)}</span>}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate max-w-sm">{s.justification}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-xs text-gray-600">{new Date(s.createdAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => setDetailId(s.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-blue-400 transition-colors"
                    title="View details"
                  >
                    <Eye size={14} />
                  </button>
                  {s.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => handleEnd(s.id, "end")}
                        disabled={endingId === s.id}
                        className="px-2 py-1 rounded-lg text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-40"
                      >
                        End
                      </button>
                      <button
                        onClick={() => handleEnd(s.id, "revoke")}
                        disabled={endingId === s.id}
                        className="px-2 py-1 rounded-lg text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                      >
                        {endingId === s.id ? <Loader2 size={12} className="animate-spin" /> : "Revoke"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{meta.total} session{meta.total !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Previous</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">Page {meta.page} of {meta.pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {showOpen  && <OpenSessionModal  onClose={() => setShowOpen(false)} onOpened={load} />}
      {detailId  && <SessionDetailModal sessionId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
