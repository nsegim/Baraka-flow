"use client"

import { useState, useEffect } from "react"
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { useTranslations } from "next-intl"

interface AuditLog {
  id:         string
  action:     string
  entityType: string
  entityId:   string | null
  metadata:   Record<string, unknown> | null
  ipAddress:  string | null
  createdAt:  string
  user:       { name: string; email: string } | null
}

interface Meta { total: number; page: number; pages: number }

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  ORDER_CREATED:             { label: "Order Created",              color: "bg-emerald-100 text-emerald-700" },
  ORDER_STATUS_CHANGED:      { label: "Order Status Changed",       color: "bg-blue-100 text-blue-700"     },
  ORDER_DELETED:             { label: "Order Deleted",              color: "bg-red-100 text-red-700"       },
  ORDER_RETURNED:            { label: "Order Returned",             color: "bg-orange-100 text-orange-700" },
  PAYMENT_RECORDED:          { label: "Payment Recorded",           color: "bg-emerald-100 text-emerald-700" },
  PRODUCT_CREATED:           { label: "Product Created",            color: "bg-blue-100 text-blue-700"     },
  PRODUCT_DELETED:           { label: "Product Deleted",            color: "bg-red-100 text-red-700"       },
  STOCK_ADJUSTED:            { label: "Stock Adjusted",             color: "bg-amber-100 text-amber-700"   },
  PURCHASE_ORDER_CREATED:    { label: "PO Created",                 color: "bg-blue-100 text-blue-700"     },
  GOODS_RECEIVED:            { label: "Goods Received",             color: "bg-emerald-100 text-emerald-700" },
  SUPPLIER_PAYMENT_RECORDED: { label: "Supplier Payment",           color: "bg-amber-100 text-amber-700"   },
  USER_CREATED:              { label: "User Created",               color: "bg-blue-100 text-blue-700"     },
  USER_ROLE_CHANGED:         { label: "Role Changed",               color: "bg-purple-100 text-purple-700" },
  USER_DEACTIVATED:          { label: "User Deactivated",           color: "bg-orange-100 text-orange-700" },
  USER_DELETED:              { label: "User Deleted",               color: "bg-red-100 text-red-700"       },
  CREDIT_NOTE_ISSUED:        { label: "Credit Note Issued",         color: "bg-purple-100 text-purple-700" },
  EXPENSE_CREATED:           { label: "Expense Created",            color: "bg-amber-100 text-amber-700"   },
  BUSINESS_SETTINGS_CHANGED: { label: "Settings Changed",           color: "bg-purple-100 text-purple-700" },
  PASSWORD_RESET_REQUESTED:  { label: "Password Reset Requested",   color: "bg-orange-100 text-orange-700" },
  PASSWORD_RESET_COMPLETED:  { label: "Password Reset Completed",   color: "bg-emerald-100 text-emerald-700" },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return "just now"
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function formatMeta(log: AuditLog): string {
  if (!log.metadata) return ""
  const m = log.metadata
  if (log.action === "ORDER_STATUS_CHANGED")
    return `${m.from} → ${m.to}`
  if (log.action === "ORDER_CREATED")
    return `${m.orderNumber} · ${m.customerName}`
  if (log.action === "PAYMENT_RECORDED")
    return `${m.orderNumber} · RWF ${Number(m.amount).toLocaleString()} via ${m.method}`
  if (log.action === "STOCK_ADJUSTED")
    return `${m.productName} · ${m.type} ${Number(m.quantity) > 0 ? "+" : ""}${m.quantity}`
  if (log.action === "USER_ROLE_CHANGED")
    return `${m.name} · ${m.from} → ${m.to}`
  if (log.action === "USER_CREATED")
    return `${m.name} · ${m.role}`
  if (log.action === "CREDIT_NOTE_ISSUED")
    return `${m.creditNoteNumber} · RWF ${Number(m.amount).toLocaleString()}`
  return Object.entries(m).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 80)
}

const ENTITY_TYPES = ["", "Order", "Product", "User", "Payment", "CreditNote", "Business", "Expense"]
const ACTIONS = [
  "", "ORDER_CREATED", "ORDER_STATUS_CHANGED", "ORDER_DELETED", "PAYMENT_RECORDED",
  "PRODUCT_CREATED", "PRODUCT_DELETED", "STOCK_ADJUSTED", "USER_CREATED",
  "USER_ROLE_CHANGED", "USER_DELETED", "CREDIT_NOTE_ISSUED", "BUSINESS_SETTINGS_CHANGED",
  "PASSWORD_RESET_REQUESTED", "PASSWORD_RESET_COMPLETED",
]

export default function AuditLogsPage() {
  const t       = useTranslations("auditLogs")
  const tCommon = useTranslations("common")

  const [logs,       setLogs]       = useState<AuditLog[]>([])
  const [meta,       setMeta]       = useState<Meta>({ total: 0, page: 1, pages: 1 })
  const [isLoading,  setIsLoading]  = useState(true)
  const [error,      setError]      = useState("")
  const [page,       setPage]       = useState(1)
  const [action,     setAction]     = useState("")
  const [entityType, setEntityType] = useState("")
  const [key,        setKey]        = useState(0)

  useEffect(() => {
    setIsLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (action)     params.set("action",     action)
    if (entityType) params.set("entityType", entityType)

    fetch(`/api/audit-logs?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        setLogs(json.data)
        setMeta(json.meta)
        setError("")
      })
      .catch(() => setError(t("failedToLoad")))
      .finally(() => setIsLoading(false))
  }, [page, action, entityType, key, t])

  function handleFilter() { setPage(1); setKey(k => k + 1) }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <ShieldCheck size={22} className="text-baraka-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {t("eventsOwnerOnly", { count: meta.total })}
          </p>
        </div>
        <button
          onClick={() => { setIsLoading(true); setKey(k => k + 1) }}
          className="flex items-center gap-2 text-sm text-baraka-sage hover:text-baraka-primary transition-colors"
        >
          <RefreshCw size={15} />
          {tCommon("refresh")}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={15} className="text-[var(--muted)]" />
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] outline-none focus:border-baraka-primary transition-colors"
        >
          <option value="">{t("allActions")}</option>
          {ACTIONS.filter(Boolean).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--foreground)] outline-none focus:border-baraka-primary transition-colors"
        >
          {ENTITY_TYPES.map(ty => (
            <option key={ty} value={ty}>{ty || t("allEntities")}</option>
          ))}
        </select>
        <button
          onClick={handleFilter}
          className="text-xs px-3 py-1.5 rounded-lg bg-baraka-primary text-white hover:bg-baraka-dark transition-colors"
        >
          {t("apply")}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-[var(--muted)]" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-2">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <ShieldCheck size={36} className="text-baraka-sage/30" />
          <p className="text-sm text-[var(--muted)]">{t("noEvents")}</p>
        </div>
      ) : (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("when")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("action")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide hidden md:table-cell">{tCommon("details")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide hidden lg:table-cell">{t("user")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide hidden lg:table-cell">{t("ip")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {logs.map(log => {
                const cfg = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-600" }
                return (
                  <tr key={log.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-[var(--muted)]" title={new Date(log.createdAt).toLocaleString()}>
                        {timeAgo(log.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-[var(--muted)]">{formatMeta(log)}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--foreground)]">
                        {log.user?.name ?? t("system")}
                      </span>
                      {log.user?.email && (
                        <span className="block text-xs text-[var(--muted)]">{log.user.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--muted)] font-mono">{log.ipAddress ?? "—"}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--muted)]">
                {t("pageInfo", { page: meta.page, pages: meta.pages, total: meta.total })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-[var(--background)] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                  disabled={page === meta.pages}
                  className="p-1.5 rounded-lg hover:bg-[var(--background)] disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
