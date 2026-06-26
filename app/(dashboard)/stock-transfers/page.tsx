"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowLeftRight, Plus, X, CheckCircle, Clock, XCircle, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface Branch   { id: string; name: string; code: string }
interface Product  { id: string; name: string; unit: string }
interface Transfer {
  id:           string
  status:       "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED"
  quantity:     number
  notes:        string | null
  createdAt:    string
  fromBranch:   Branch
  toBranch:     Branch
  product:      Product
  requestedBy:  { id: string; name: string }
  approvedBy:   { id: string; name: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-100 text-amber-700",
  APPROVED:  "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  REJECTED:  "bg-red-100 text-red-600",
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:   <Clock       size={13} />,
  APPROVED:  <Truck       size={13} />,
  COMPLETED: <CheckCircle size={13} />,
  REJECTED:  <XCircle     size={13} />,
}

export default function StockTransfersPage() {
  const t       = useTranslations("stockTransfers")
  const tCommon = useTranslations("common")

  const { data: session } = useSession()
  const isOwner   = session?.user?.role === "OWNER"
  const isManager = session?.user?.role === "MANAGER"
  const canWrite  = isOwner || isManager

  const [transfers,  setTransfers]  = useState<Transfer[]>([])
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [products,   setProducts]   = useState<Product[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [error,      setError]      = useState("")
  const [saving,     setSaving]     = useState(false)

  const [form, setForm] = useState({
    fromBranchId: "",
    toBranchId:   "",
    productId:    "",
    quantity:     1,
    notes:        "",
  })

  const loadTransfers = async () => {
    setLoading(true)
    const res = await fetch("/api/stock-transfers")
    if (res.ok) {
      const data = await res.json()
      setTransfers(data.data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTransfers()
    if (isOwner) {
      fetch("/api/branches").then(r => r.ok ? r.json() : []).then(d => setBranches(Array.isArray(d) ? d : []))
    }
    fetch("/api/products?all=true").then(r => r.ok ? r.json() : []).then(d => setProducts(Array.isArray(d) ? d : []))
  }, [isOwner])

  const handleCreate = async () => {
    setSaving(true); setError("")
    const res = await fetch("/api/stock-transfers", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false)
    setForm({ fromBranchId: "", toBranchId: "", productId: "", quantity: 1, notes: "" })
    await loadTransfers()
    setSaving(false)
  }

  const handleAction = async (id: string, status: "APPROVED" | "COMPLETED" | "REJECTED") => {
    const confirmMsg = {
      APPROVED:  t("confirmApprove"),
      COMPLETED: t("confirmReceive"),
      REJECTED:  t("confirmReject"),
    }[status]
    if (!confirm(confirmMsg)) return
    const res = await fetch(`/api/stock-transfers/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    })
    if (res.ok) await loadTransfers()
    else {
      const d = await res.json()
      alert(d.error ?? tCommon("somethingWrong"))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-baraka-sage mt-1">{t("subtitle")}</p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus size={16} /> {t("requestTransfer")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-baraka-primary" />
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-16 text-baraka-sage">
            <ArrowLeftRight size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">{t("noTransfers")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)] border-b border-[var(--border)]">
                <tr>
                  {[
                    tCommon("name"),
                    t("fromBranch"),
                    t("toBranch"),
                    tCommon("quantity"),
                    tCommon("status"),
                    t("requestedBy"),
                    tCommon("date"),
                    tCommon("actions"),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-baraka-sage uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transfers.map(tr => (
                  <tr key={tr.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">{tr.product.name}</p>
                      <p className="text-xs text-baraka-sage">{tr.product.unit}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-[var(--background)] px-2 py-0.5 rounded">[{tr.fromBranch.code}]</span>
                      <p className="text-xs text-baraka-sage mt-0.5">{tr.fromBranch.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-[var(--background)] px-2 py-0.5 rounded">[{tr.toBranch.code}]</span>
                      <p className="text-xs text-baraka-sage mt-0.5">{tr.toBranch.name}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{tr.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[tr.status]}`}>
                        {STATUS_ICON[tr.status]}
                        {t(`status.${tr.status}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-baraka-sage text-xs">{tr.requestedBy.name}</td>
                    <td className="px-4 py-3 text-baraka-sage text-xs">
                      {new Date(tr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {tr.status === "PENDING" && isOwner && (
                          <>
                            <button
                              onClick={() => handleAction(tr.id, "APPROVED")}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              {t("approve")}
                            </button>
                            <button
                              onClick={() => handleAction(tr.id, "REJECTED")}
                              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                            >
                              {t("reject")}
                            </button>
                          </>
                        )}
                        {tr.status === "APPROVED" && (isOwner || (isManager && session?.user?.branchId === tr.toBranch.id)) && (
                          <button
                            onClick={() => handleAction(tr.id, "COMPLETED")}
                            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                          >
                            {t("markReceived")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Transfer Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">{t("requestTransfer")}</h2>
              <button onClick={() => { setShowCreate(false); setError("") }}>
                <X size={20} className="text-baraka-sage" />
              </button>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              {isOwner && (
                <div>
                  <label className="text-xs font-medium text-baraka-sage">{t("fromBranch")} *</label>
                  <select
                    value={form.fromBranchId}
                    onChange={e => setForm(f => ({ ...f, fromBranchId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                  >
                    <option value="">{t("selectSource")}</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>[{b.code}] {b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isOwner && (
                <div>
                  <label className="text-xs font-medium text-baraka-sage">{t("toBranch")} *</label>
                  <select
                    value={form.toBranchId}
                    onChange={e => setForm(f => ({ ...f, toBranchId: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                  >
                    <option value="">{t("selectDestination")}</option>
                    {branches.filter(b => b.id !== form.fromBranchId).map(b => (
                      <option key={b.id} value={b.id}>[{b.code}] {b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-baraka-sage">{tCommon("name")} *</label>
                <select
                  value={form.productId}
                  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                >
                  <option value="">{t("selectProduct")}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-baraka-sage">{tCommon("quantity")} *</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-baraka-sage">{t("transferNotes")}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setError("") }}>
                {tCommon("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={saving || !form.productId || form.quantity < 1 || (isOwner && (!form.fromBranchId || !form.toBranchId))}
              >
                {saving ? `${tCommon("creating")}…` : t("requestTransfer")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
