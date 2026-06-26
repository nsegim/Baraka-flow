"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Search, Users, Pencil, Trash2, X, Loader2, Phone, Mail, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import CreditNoteModal from "@/components/customers/CreditNoteModal"

interface Customer {
  id:                 string
  name:               string
  phone:              string | null
  email:              string | null
  address:            string | null
  notes:              string | null
  outstandingBalance: number
  createdAt:          string
  _count: { orders: number }
}

interface Meta { total: number; page: number; limit: number; pages: number }

function formatRWF(n: number) {
  return `RWF ${Number(n).toLocaleString()}`
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function CustomerModal({
  onClose, onSave, customer,
}: {
  onClose: () => void
  onSave: (data: Partial<Customer>) => Promise<void>
  customer: Customer | null
}) {
  const t       = useTranslations("customers")
  const tCommon = useTranslations("common")

  const [name,    setName]    = useState(customer?.name    ?? "")
  const [phone,   setPhone]   = useState(customer?.phone   ?? "")
  const [email,   setEmail]   = useState(customer?.email   ?? "")
  const [address, setAddress] = useState(customer?.address ?? "")
  const [notes,   setNotes]   = useState(customer?.notes   ?? "")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t("nameRequired")); return }
    setLoading(true)
    try {
      await onSave({ name, phone: phone || null, email: email || null, address: address || null, notes: notes || null })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tCommon("somethingWrong"))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-baraka-sage/40 bg-[var(--card)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">
            {customer ? t("editCustomer") : t("newCustomer")}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("name")} *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Karemera Furniture Store" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("phone")}</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+250 788 000 000" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("email")}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="optional@email.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("address")}</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Kigali, Nyarugenge..." className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this customer..." rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> {tCommon("saving")}</span>
                : (customer ? tCommon("saveChanges") : t("addCustomer"))
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const t       = useTranslations("customers")
  const tCommon = useTranslations("common")

  const [customers,  setCustomers]  = useState<Customer[]>([])
  const [meta,       setMeta]       = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 0 })
  const [isLoading,  setIsLoading]  = useState(true)
  const [search,     setSearch]     = useState("")
  const [modal,      setModal]      = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [cnCustomer, setCnCustomer] = useState<Customer | null>(null)
  const [page,       setPage]       = useState(1)
  const [key,        setKey]        = useState(0)

  useEffect(() => {
    const q = search.length >= 2 ? `&q=${encodeURIComponent(search)}` : ""
    fetch(`/api/customers?page=${page}&limit=50${q}`)
      .then(r => r.json())
      .then(json => {
        setCustomers(json.data)
        setMeta(json.meta)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [page, key, search])

  const refresh = useCallback(() => { setIsLoading(true); setKey(k => k + 1) }, [])

  async function handleSave(data: Partial<Customer>) {
    const isEdit = !!modal.customer
    const url    = isEdit ? `/api/customers/${modal.customer!.id}` : "/api/customers"
    const method = isEdit ? "PATCH" : "POST"
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || t("failedToLoad"))
    }
    refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return
    setDeletingId(id)
    await fetch(`/api/customers/${id}`, { method: "DELETE" })
    setCustomers(prev => prev.filter(c => c.id !== id))
    setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
    setDeletingId(null)
  }

  const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.outstandingBalance), 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("customerCount", { count: meta.total })}</p>
        </div>
        <Button onClick={() => setModal({ open: true, customer: null })} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={18} /> {t("addCustomer")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("totalCustomers")}</p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{meta.total}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("outstandingBalance")}</p>
          <p className="text-2xl font-bold text-red-600">{formatRWF(totalOutstanding)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5">
        <Search size={16} className="text-[var(--muted)]" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="bg-transparent text-sm outline-none text-[var(--foreground)] placeholder:text-[var(--muted)] w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-baraka-sage" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users size={40} className="text-baraka-sage/40" />
            <p className="text-sm font-medium text-[var(--foreground)]">{search ? t("noCustomersMatch") : t("noCustomers")}</p>
            <p className="text-xs text-[var(--muted)]">{t("addFirstHint")}</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{tCommon("customer")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("colContact")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("totalOrders")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("outstandingBalance")}</th>
                  <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{c.name}</p>
                      {c.address && <p className="text-xs text-[var(--muted)] mt-0.5">{c.address}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-0.5">
                        {c.phone && <p className="text-xs text-[var(--muted)] flex items-center gap-1"><Phone size={11} />{c.phone}</p>}
                        {c.email && <p className="text-xs text-[var(--muted)] flex items-center gap-1"><Mail size={11} />{c.email}</p>}
                        {!c.phone && !c.email && <span className="text-xs text-[var(--muted)]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--foreground)]">{c._count.orders}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-semibold ${Number(c.outstandingBalance) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatRWF(c.outstandingBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setCnCustomer(c)} className="p-2 rounded-lg hover:bg-purple-50 text-baraka-sage hover:text-purple-600 transition-colors" title={t("issueCreditNote")}>
                          <Receipt size={15} />
                        </button>
                        <button onClick={() => setModal({ open: true, customer: c })} className="p-2 rounded-lg hover:bg-baraka-primary/10 text-baraka-sage hover:text-baraka-primary transition-colors" title={tCommon("edit")}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="p-2 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50" title={tCommon("delete")}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--muted)]">
                  {tCommon("showingOf", { from: Math.min((meta.page - 1) * meta.limit + 1, meta.total), to: Math.min(meta.page * meta.limit, meta.total), total: meta.total })}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={meta.page <= 1} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--background)] disabled:opacity-40 transition-colors">{tCommon("previous")}</button>
                  <span className="text-sm text-[var(--muted)] px-1">{tCommon("pageOf", { page: meta.page, pages: meta.pages })}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={meta.page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--background)] disabled:opacity-40 transition-colors">{tCommon("next")}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modal.open && (
        <CustomerModal
          onClose={() => setModal({ open: false, customer: null })}
          onSave={handleSave}
          customer={modal.customer}
        />
      )}

      {cnCustomer && (
        <CreditNoteModal
          customer={cnCustomer}
          onClose={() => setCnCustomer(null)}
          onIssued={refresh}
        />
      )}
    </div>
  )
}
