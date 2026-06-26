"use client"

import { useState, useEffect } from "react"
import {
  Plus, Truck, Mail, Phone, Globe, Pencil, Trash2,
  Loader2, AlertTriangle, RefreshCw, CreditCard, X, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import SupplierModal, { Supplier } from "@/components/suppliers/SupplierModal"
import { useTranslations } from "next-intl"

// ── Record Payment modal (inline) ──────────────────────────────────────────
interface RecordPaymentModalProps {
  supplier: Supplier
  onClose:  () => void
  onSaved:  (updated: Supplier) => void
}

const inputClass = `
  w-full px-3 py-2.5 rounded-lg
  border border-baraka-sage/40
  bg-baraka-cream/50
  text-baraka-dark text-sm
  placeholder:text-baraka-sage
  outline-none focus:border-baraka-primary
  focus:ring-2 focus:ring-baraka-primary/20
  transition-colors
`

function RecordPaymentModal({ supplier, onClose, onSaved }: RecordPaymentModalProps) {
  const t       = useTranslations("suppliers")
  const tCommon = useTranslations("common")

  const [amount,    setAmount]    = useState("")
  const [method,    setMethod]    = useState("CASH")
  const [reference, setReference] = useState("")
  const [notes,     setNotes]     = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState("")
  const [success,   setSuccess]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return }

    setIsLoading(true)
    try {
      const res = await fetch("/api/supplier-payments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          supplierId: supplier.id,
          amount:     amt,
          method,
          reference: reference || null,
          notes:     notes     || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }

      const sRes = await fetch("/api/suppliers")
      if (sRes.ok) {
        const all: Supplier[] = await sRes.json()
        const updated = all.find(s => s.id === supplier.id)
        if (updated) onSaved(updated)
      }

      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("failedToLoad"))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-baraka-sage/20">
          <div>
            <h2 className="text-lg font-bold text-baraka-dark">{t("recordPaymentTitle")}</h2>
            <p className="text-sm text-baraka-sage mt-0.5">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-baraka-cream transition-colors">
            <X size={18} className="text-baraka-sage" />
          </button>
        </div>

        {success ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
            <p className="font-semibold text-baraka-dark">{t("paymentRecorded")}</p>
            <p className="text-sm text-baraka-sage">{t("balanceUpdated")} {supplier.name}</p>
            <Button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-baraka-primary text-white rounded-lg hover:bg-baraka-dark transition-colors"
            >
              {tCommon("done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                {t("outstandingBalance")}:&nbsp;
                <span className="font-bold text-amber-800">
                  RWF {Number(supplier.outstandingBalance).toLocaleString()}
                </span>
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                {tCommon("amount")} (RWF) *
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                {t("paymentMethod")} *
              </label>
              <select value={method} onChange={e => setMethod(e.target.value)} className={inputClass}>
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                {t("referenceNo")}
              </label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                {tCommon("notes")}
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-baraka-cream hover:bg-baraka-sage/20 text-baraka-dark border border-baraka-sage/40 rounded-lg transition-colors"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {tCommon("saving")}...
                  </span>
                ) : t("recordPayment")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const t       = useTranslations("suppliers")
  const tCommon = useTranslations("common")

  const [suppliers,         setSuppliers]         = useState<Supplier[]>([])
  const [isLoading,         setIsLoading]         = useState(true)
  const [error,             setError]             = useState("")
  const [showSupplierModal, setShowSupplierModal]  = useState(false)
  const [selected,          setSelected]          = useState<Supplier | null>(null)
  const [deletingId,        setDeletingId]        = useState<string | null>(null)
  const [showConfirm,       setShowConfirm]       = useState(false)
  const [toDelete,          setToDelete]          = useState<Supplier | null>(null)
  const [paymentTarget,     setPaymentTarget]     = useState<Supplier | null>(null)
  const [key,               setKey]               = useState(0)

  useEffect(() => {
    fetch("/api/suppliers")
      .then(r => r.json())
      .then(data => { setSuppliers(data); setError(""); setIsLoading(false) })
      .catch(() => { setError(t("failedToLoad")); setIsLoading(false) })
  }, [key, t])

  async function handleSave(data: Partial<Supplier>) {
    if (selected) {
      const res = await fetch(`/api/suppliers/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const updated = await res.json()
      setSuppliers(prev => prev.map(s => s.id === selected.id ? updated : s))
    } else {
      const res = await fetch("/api/suppliers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const newSupplier = await res.json()
      setSuppliers(prev => [newSupplier, ...prev])
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeletingId(toDelete.id)
    try {
      await fetch(`/api/suppliers/${toDelete.id}`, { method: "DELETE" })
      setSuppliers(prev => prev.filter(s => s.id !== toDelete.id))
      setShowConfirm(false)
      setToDelete(null)
    } catch {
      setError(t("failedToLoad"))
    } finally {
      setDeletingId(null)
    }
  }

  function countryFlag(country: string | null) {
    const flags: Record<string, string> = {
      "China": "🇨🇳", "Dubai": "🇦🇪", "Rwanda": "🇷🇼", "Kenya": "🇰🇪", "Tanzania": "🇹🇿",
    }
    return country ? (flags[country] || "🌍") : "🌍"
  }

  const totalOwed = suppliers.reduce((s, sup) => s + Number(sup.outstandingBalance), 0)

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {suppliers.length} {t("subtitle")}
            {totalOwed > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                {t("apOutstanding", { amount: totalOwed.toLocaleString() })}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => { setSelected(null); setShowSupplierModal(true) }}
          className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus size={18} />
          {t("addSupplier")}
        </Button>
      </div>

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-[var(--muted)]">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">{tCommon("loading")}...</span>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <Button onClick={() => { setIsLoading(true); setKey(k => k + 1) }}>{tCommon("tryAgain")}</Button>
        </div>
      )}

      {/* ── EMPTY ── */}
      {!isLoading && !error && suppliers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <Truck size={40} className="text-baraka-sage/40" />
          <p className="text-sm font-medium text-[var(--foreground)]">{t("noSuppliers")}</p>
          <p className="text-xs text-[var(--muted)]">{t("noSuppliersHint")}</p>
          <Button
            onClick={() => { setSelected(null); setShowSupplierModal(true) }}
            className="mt-2 flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus size={16} />
            {t("addFirstSupplier")}
          </Button>
        </div>
      )}

      {/* ── SUPPLIERS GRID ── */}
      {!isLoading && !error && suppliers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <div
              key={supplier.id}
              className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow p-5 group"
            >
              {/* Card top */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-baraka-sage/20 flex items-center justify-center text-lg">
                    {countryFlag(supplier.country)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">{supplier.name}</h3>
                    {supplier.country && (
                      <p className="text-xs text-[var(--muted)]">{supplier.country}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setSelected(supplier); setShowSupplierModal(true) }}
                    className="p-1.5 rounded-lg hover:bg-baraka-primary/10 text-baraka-sage hover:text-baraka-primary transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setToDelete(supplier); setShowConfirm(true) }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Contact details */}
              <div className="space-y-2">
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-baraka-sage shrink-0" />
                    <span className="text-xs text-[var(--muted)] truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-baraka-sage shrink-0" />
                    <span className="text-xs text-[var(--muted)]">{supplier.phone}</span>
                  </div>
                )}
                {!supplier.email && !supplier.phone && (
                  <p className="text-xs text-[var(--muted)] italic">{t("noContact")}</p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe size={13} className="text-baraka-sage" />
                    <span className="text-xs text-[var(--muted)]">
                      {supplier._count.products} product{supplier._count.products !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {Number(supplier.outstandingBalance) > 0 && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      Owes RWF {Number(supplier.outstandingBalance).toLocaleString()}
                    </span>
                  )}
                  {Number(supplier.outstandingBalance) === 0 && (
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      {t("paidUp")}
                    </span>
                  )}
                </div>

                {Number(supplier.outstandingBalance) > 0 && (
                  <button
                    onClick={() => setPaymentTarget(supplier)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-baraka-primary border border-baraka-primary/30 rounded-lg py-1.5 hover:bg-baraka-primary/5 transition-colors"
                  >
                    <CreditCard size={13} />
                    {t("recordPayment")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SUPPLIER ADD/EDIT MODAL ── */}
      {showSupplierModal && (
        <SupplierModal
          key={selected?.id ?? "new"}
          onClose={() => setShowSupplierModal(false)}
          onSave={handleSave}
          supplier={selected}
        />
      )}

      {/* ── RECORD PAYMENT MODAL ── */}
      {paymentTarget && (
        <RecordPaymentModal
          key={paymentTarget.id}
          supplier={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSaved={updated => {
            setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
            setPaymentTarget(null)
          }}
        />
      )}

      {/* ── DELETE CONFIRM ── */}
      {showConfirm && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-baraka-dark mb-2">{t("deleteSupplier")}</h2>
            <p className="text-sm text-baraka-sage mb-1">{t("deleteQuestion")}</p>
            <p className="text-sm font-semibold text-baraka-dark mb-3">{toDelete.name}</p>
            <p className="text-xs text-baraka-sage mb-6">{t("deleteHint")}</p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-baraka-cream hover:bg-baraka-sage/20 text-baraka-dark border border-baraka-sage/40 rounded-lg transition-colors"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDelete}
                disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deletingId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    {tCommon("deleting")}...
                  </span>
                ) : t("confirmDelete")}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
