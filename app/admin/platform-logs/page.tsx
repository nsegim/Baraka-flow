"use client"

import { useState, useEffect, useCallback } from "react"
import { Activity, RefreshCw, Filter } from "lucide-react"

interface PlatformLog {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  platformUser: { id: string; name: string; email: string } | null
}
interface Meta { total: number; page: number; limit: number; pages: number }

const ACTION_COLOR: Record<string, string> = {
  TENANT_CREATED:           "text-emerald-400",
  TENANT_SUSPENDED:         "text-red-400",
  TENANT_UNSUSPENDED:       "text-blue-400",
  TENANT_DELETED:           "text-red-500",
  TENANT_PLAN_CHANGED:      "text-purple-400",
  PLATFORM_USER_CREATED:    "text-emerald-400",
  PLATFORM_USER_DEACTIVATED:"text-red-400",
  PASSWORD_RESET_INITIATED: "text-amber-400",
  SUPPORT_SESSION_OPENED:   "text-amber-400",
  SUPPORT_SESSION_ENDED:    "text-gray-400",
  SUPPORT_SESSION_REVOKED:  "text-red-400",
}

export default function PlatformLogsPage() {
  const [logs,    setLogs]    = useState<PlatformLog[]>([])
  const [meta,    setMeta]    = useState<Meta>({ total: 0, page: 1, limit: 30, pages: 0 })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")
  const [page,    setPage]    = useState(1)
  const [action,  setAction]  = useState("")

  const load = useCallback(() => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(page), ...(action ? { action } : {}) })
    fetch(`/api/admin/platform-logs?${q}`)
      .then(r => r.json())
      .then(json => { setLogs(json.data ?? []); setMeta(json.meta); setLoading(false) })
      .catch(() => { setError("Failed to load logs"); setLoading(false) })
  }, [page, action])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [action])

  const ACTIONS = [
    "TENANT_CREATED", "TENANT_SUSPENDED", "TENANT_UNSUSPENDED", "TENANT_DELETED",
    "TENANT_PLAN_CHANGED", "PASSWORD_RESET_INITIATED",
    "SUPPORT_SESSION_OPENED", "SUPPORT_SESSION_ENDED", "SUPPORT_SESSION_REVOKED",
  ]

  return (
    <div className="space-y-5 max-w-6xl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">All platform-level admin actions · immutable</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-500" />
        <button
          onClick={() => setAction("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!action ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"}`}
        >
          All
        </button>
        {ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              action === a ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            }`}
          >
            {a.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={18} className="animate-spin text-gray-600" /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Activity size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No platform events found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-gray-800/40 transition-colors">
                <div className="w-2 h-2 rounded-full bg-gray-600 shrink-0 mt-2" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono font-semibold ${ACTION_COLOR[log.action] ?? "text-gray-300"}`}>
                      {log.action}
                    </span>
                    {log.entityType && log.entityId && (
                      <span className="text-xs text-gray-600 font-mono">
                        {log.entityType}:{log.entityId.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span>{log.platformUser ? `${log.platformUser.name} (${log.platformUser.email})` : "Legacy admin"}</span>
                    {log.ipAddress && <span>· {log.ipAddress}</span>}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="text-gray-600 font-mono truncate max-w-xs">
                        {JSON.stringify(log.metadata).slice(0, 80)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-600 shrink-0 mt-0.5">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{meta.total} event{meta.total !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Previous</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">Page {meta.page} of {meta.pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
