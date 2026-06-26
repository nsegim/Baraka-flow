"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Receipt, Pencil, Trash2, X, Loader2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

type ExpenseCategory = "RENT" | "UTILITIES" | "TRANSPORT" | "STAFF_WAGES" | "MARKETING" | "EQUIPMENT" | "OTHER"

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  RENT:        "bg-purple-100 text-purple-700",
  UTILITIES:   "bg-blue-100 text-blue-700",
  TRANSPORT:   "bg-yellow-100 text-yellow-700",
  STAFF_WAGES: "bg-green-100 text-green-700",
  MARKETING:   "bg-pink-100 text-pink-700",
  EQUIPMENT:   "bg-orange-100 text-orange-700",
  OTHER:       "bg-gray-100 text-gray-700",
}

const CATEGORY_KEYS = Object.keys(CATEGORY_COLORS) as ExpenseCategory[]

interface Expense {
  id:         string
  title:      string
  amount:     number
  category:   ExpenseCategory
  date:       string
  notes:      string | null
  createdBy:  { id: string; name: string }
}

interface Meta { total: number; page: number; limit: number; pages: number }

function formatRWF(n: number) {
  return `RWF ${Number(n).toLocaleString()}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ExpenseModal({
  onClose, onSave, expense,
}: {
  onClose:  () => void
  onSave:   (data: Partial<Expense>) => Promise<void>
  expense:  Expense | null
}) {
  const t       = useTranslations("expenses")
  const tCommon = useTranslations("common")

  const [title,    setTitle]    = useState(expense?.title    ?? "")
  const [amount,   setAmount]   = useState(expense ? String(expense.amount) : "")
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "OTHER")
  const [date,     setDate]     = useState(expense ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [notes,    setNotes]    = useState(expense?.notes    ?? "")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("Title is required"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return }
    setLoading(true)
    try {
      await onSave({ title, amount: amt, category, date, notes: notes || null })
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
            {expense ? t("editExpense") : t("newExpense")}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors">
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("expenseTitle")} *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Office rent - June" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("expenseAmount")} *</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("expenseDate")} *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("expenseCategory")} *</label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className={`${inputClass} appearance-none pr-8`}>
                {CATEGORY_KEYS.map(k => (
                  <option key={k} value={k}>{t(`categories.${k}` as Parameters<typeof t>[0])}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {loading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{tCommon("saving")}</span>
                : (expense ? tCommon("saveChanges") : t("addExpense"))
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const t       = useTranslations("expenses")
  const tCommon = useTranslations("common")

  const [expenses,   setExpenses]   = useState<Expense[]>([])
  const [meta,       setMeta]       = useState<Meta>({ total: 0, page: 1, limit: 50, pages: 0 })
  const [isLoading,  setIsLoading]  = useState(true)
  const [modal,      setModal]      = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page,       setPage]       = useState(1)
  const [key,        setKey]        = useState(0)

  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)

  useEffect(() => {
    fetch(`/api/expenses?page=${page}&limit=50&month=${month}`)
      .then(r => r.json())
      .then(json => {
        setExpenses(json.data ?? [])
        setMeta(json.meta)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [page, key, month])

  const refresh = useCallback(() => { setIsLoading(true); setKey(k => k + 1) }, [])

  async function handleSave(data: Partial<Expense>) {
    const isEdit = !!modal.expense
    const url    = isEdit ? `/api/expenses/${modal.expense!.id}` : "/api/expenses"
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
    if (!confirm("Delete this expense?")) return
    setDeletingId(id)
    await fetch(`/api/expenses/${id}`, { method: "DELETE" })
    setExpenses(prev => prev.filter(e => e.id !== id))
    setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
    setDeletingId(null)
  }

  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("expensesThisMonth", { count: meta.total })}</p>
        </div>
        <Button onClick={() => setModal({ open: true, expense: null })} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors">
          <Plus size={18} /> {t("addExpense")}
        </Button>
      </div>

      {/* Summary + Month filter */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <p className="text-xs text-[var(--muted)] mb-1">{t("totalThisPeriod")}</p>
          <p className="text-2xl font-bold text-red-600">{formatRWF(totalAmount)}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <label className="block text-xs text-[var(--muted)] mb-2">{t("filterByMonth")}</label>
          <input
            type="month"
            value={month}
            onChange={e => { setMonth(e.target.value); setPage(1); setIsLoading(true) }}
            className="w-full text-sm bg-transparent text-[var(--foreground)] outline-none border-b border-[var(--border)] pb-1"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-baraka-sage" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt size={40} className="text-baraka-sage/40" />
            <p className="text-sm font-medium text-[var(--foreground)]">{t("noExpensesThisPeriod")}</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{t("expenseTitle")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("expenseCategory")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{tCommon("date")}</th>
                  <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{tCommon("amount")}</th>
                  <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-[var(--background)] transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{e.title}</p>
                      {e.notes && <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-xs">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${CATEGORY_COLORS[e.category]}`}>
                        {t(`categories.${e.category}` as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--muted)]">{formatDate(e.date)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-red-600">{formatRWF(e.amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setModal({ open: true, expense: e })} className="p-2 rounded-lg hover:bg-baraka-primary/10 text-baraka-sage hover:text-baraka-primary transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id} className="p-2 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50">
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
                  <button onClick={() => setPage(p => p - 1)} disabled={meta.page <= 1} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] disabled:opacity-40 transition-colors">{tCommon("previous")}</button>
                  <span className="text-sm text-[var(--muted)] px-1">{tCommon("pageOf", { page: meta.page, pages: meta.pages })}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={meta.page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] disabled:opacity-40 transition-colors">{tCommon("next")}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modal.open && (
        <ExpenseModal
          onClose={() => setModal({ open: false, expense: null })}
          onSave={handleSave}
          expense={modal.expense}
        />
      )}
    </div>
  )
}
