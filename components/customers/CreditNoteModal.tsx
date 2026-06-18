"use client"

import { useState, useEffect } from "react"
import { X, Receipt, CheckCircle, Loader2 } from "lucide-react"

interface Customer {
  id:                 string
  name:               string
  outstandingBalance: number
}

interface CreditNote {
  id:               string
  creditNoteNumber: string
  amount:           number
  reason:           string
  notes:            string | null
  status:           string
  createdAt:        string
  createdByName:    string | null
}

function formatRWF(n: number) {
  return `RWF ${Number(n).toLocaleString()}`
}

export default function CreditNoteModal({
  customer,
  onClose,
  onIssued,
}: {
  customer: Customer
  onClose:  () => void
  onIssued: () => void
}) {
  const [tab,     setTab]     = useState<"issue" | "history">("issue")
  const [amount,  setAmount]  = useState("")
  const [reason,  setReason]  = useState("")
  const [notes,   setNotes]   = useState("")
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState(false)
  const [history, setHistory] = useState<CreditNote[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const amountNum  = parseFloat(amount) || 0
  const newBalance = customer.outstandingBalance - amountNum

  useEffect(() => {
    setLoadingHistory(true)
    fetch(`/api/customers/${customer.id}/credit-notes`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoadingHistory(false) })
      .catch(() => setLoadingHistory(false))
  }, [customer.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (amountNum <= 0) { setError("Amount must be greater than 0"); return }
    if (!reason.trim()) { setError("Reason is required"); return }

    setSaving(true)
    setError("")

    const res  = await fetch(`/api/customers/${customer.id}/credit-notes`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ amount: amountNum, reason: reason.trim(), notes: notes.trim() || null }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error || "Failed to issue credit note"); return }

    setSuccess(true)
    setHistory(prev => [data, ...prev])
    setTimeout(() => { onIssued(); onClose() }, 1200)
  }

  const inputClass = "w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary placeholder:text-[var(--muted)]"

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
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt size={18} className="text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Credit Note</h2>
              <p className="text-xs text-[var(--muted)]">{customer.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Outstanding balance pill */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between bg-[var(--background)] rounded-xl p-4">
            <span className="text-sm text-[var(--muted)]">Outstanding balance</span>
            <span className={`text-lg font-bold ${customer.outstandingBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatRWF(customer.outstandingBalance)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {(["issue", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-baraka-primary text-white"
                  : "text-[var(--muted)] hover:bg-[var(--background)]"
              }`}
            >
              {t === "issue" ? "Issue Credit" : "History"}
            </button>
          ))}
        </div>

        {/* ── Issue form ── */}
        {tab === "issue" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">

            {/* Amount */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Credit Amount (RWF) *
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 5000"
                />
                {amountNum > 0 && (
                  <div className="flex-shrink-0 text-sm font-semibold px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 whitespace-nowrap">
                    → {formatRWF(newBalance)}
                  </div>
                )}
              </div>
              {amountNum > 0 && (
                <p className="text-xs text-[var(--muted)] mt-1">
                  {formatRWF(customer.outstandingBalance)} → {formatRWF(newBalance)}
                  {newBalance < 0 && " (customer will be in credit)"}
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Reason *
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className={inputClass}
                placeholder="e.g. Returned 3 damaged units, overcharged on ORD-2024-0012..."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Any additional details..."
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {success ? (
              <div className="flex items-center justify-center gap-2 py-3 text-emerald-600 font-medium">
                <CheckCircle size={18} /> Credit note issued!
              </div>
            ) : (
              <button
                type="submit"
                disabled={saving || amountNum <= 0 || !reason.trim()}
                className="w-full bg-baraka-primary hover:bg-baraka-dark text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? <Loader2 size={16} className="animate-spin mx-auto" />
                  : "Issue Credit Note"
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
                No credit notes issued yet
              </p>
            ) : (
              <div className="space-y-2">
                {history.map(cn => (
                  <div key={cn.id} className="p-3 bg-[var(--background)] rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-purple-600">
                            {cn.creditNoteNumber}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            cn.status === "VOIDED"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {cn.status === "VOIDED" ? "Voided" : "Issued"}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--foreground)]">{cn.reason}</p>
                        {cn.notes && (
                          <p className="text-xs text-[var(--muted)] mt-0.5">{cn.notes}</p>
                        )}
                        <p className="text-xs text-[var(--muted)] mt-1">
                          {new Date(cn.createdAt).toLocaleDateString("en-RW", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                          {cn.createdByName && ` · ${cn.createdByName}`}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 whitespace-nowrap pt-0.5">
                        −{formatRWF(cn.amount)}
                      </span>
                    </div>
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
