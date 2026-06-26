"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  GitBranch, Plus, Users, Package,
  Trash2, UserPlus, X, CheckCircle, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

interface Branch {
  id:        string
  name:      string
  code:      string
  address:   string | null
  phone:     string | null
  isActive:  boolean
  isDefault: boolean
  _count:    { users: number; orders: number; inventory: number }
}

interface StaffUser {
  id:       string
  name:     string
  email:    string
  role:     string
  isActive: boolean
}

interface BranchDetail extends Branch {
  users: Array<{ id: string; user: StaffUser; assignedAt: string }>
  stockSummary: { totalStock: number; lowStockCount: number; outOfStockCount: number }
}

interface AllStaff {
  id:    string
  name:  string
  email: string
  role:  string
}

export default function BranchesPage() {
  const t       = useTranslations("branches")
  const tCommon = useTranslations("common")

  const { data: session, status } = useSession()
  const router = useRouter()

  const [branches,   setBranches]   = useState<Branch[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<BranchDetail | null>(null)
  const [allStaff,   setAllStaff]   = useState<AllStaff[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [error,      setError]      = useState("")
  const [saving,     setSaving]     = useState(false)

  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "" })
  const [assignUserId, setAssignUserId] = useState("")

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "OWNER") {
      router.replace("/dashboard")
    }
  }, [status, session, router])

  const loadBranches = async () => {
    setLoading(true)
    const res = await fetch("/api/branches")
    if (res.ok) setBranches(await res.json())
    setLoading(false)
  }

  const loadStaff = async () => {
    const res = await fetch("/api/users")
    if (res.ok) {
      const data = await res.json()
      setAllStaff((data.data ?? data).filter((u: AllStaff) => u.role !== "OWNER"))
    }
  }

  const loadBranchDetail = async (id: string) => {
    const res = await fetch(`/api/branches/${id}`)
    if (res.ok) setSelected(await res.json())
  }

  useEffect(() => { loadBranches() }, [])

  const handleCreate = async () => {
    setSaving(true); setError("")
    const res = await fetch("/api/branches", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false)
    setForm({ name: "", code: "", address: "", phone: "" })
    await loadBranches()
    setSaving(false)
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm(t("deactivateConfirm"))) return
    await fetch(`/api/branches/${id}`, { method: "DELETE" })
    await loadBranches()
    if (selected?.id === id) setSelected(null)
  }

  const handleAssign = async () => {
    if (!selected || !assignUserId) return
    setSaving(true); setError("")
    const res = await fetch(`/api/branches/${selected.id}/users`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: assignUserId }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowAssign(false); setAssignUserId("")
    await loadBranchDetail(selected.id)
    setSaving(false)
  }

  const handleRemoveUser = async (userId: string) => {
    if (!selected) return
    if (!confirm(t("removeUserConfirm"))) return
    await fetch(`/api/branches/${selected.id}/users?userId=${userId}`, { method: "DELETE" })
    await loadBranchDetail(selected.id)
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-baraka-primary" />
      </div>
    )
  }

  if (session?.user?.role !== "OWNER") return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-baraka-sage mt-1">{t("manageSubtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Plus size={16} /> {t("newBranch")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Branch List */}
        <div className="lg:col-span-1 space-y-3">
          {branches.map(b => (
            <div
              key={b.id}
              onClick={() => { setSelected(null); loadStaff(); loadBranchDetail(b.id) }}
              className={`cursor-pointer rounded-xl border p-4 transition-all
                ${selected?.id === b.id
                  ? "border-baraka-primary bg-baraka-primary/5"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-baraka-primary/40"
                }
                ${!b.isActive ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-baraka-primary/10 flex items-center justify-center">
                    <GitBranch size={18} className="text-baraka-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)] text-sm">{b.name}</p>
                    <p className="text-xs text-baraka-sage font-mono">[{b.code}]</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {b.isDefault && (
                    <span className="text-xs bg-baraka-primary/10 text-baraka-primary px-2 py-0.5 rounded-full">{t("default")}</span>
                  )}
                  {!b.isActive && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{t("inactive")}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-[var(--background)] rounded-lg py-1.5">
                  <p className="text-xs font-bold text-[var(--foreground)]">{b._count.users}</p>
                  <p className="text-[10px] text-baraka-sage">{t("staffLabel")}</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg py-1.5">
                  <p className="text-xs font-bold text-[var(--foreground)]">{b._count.orders}</p>
                  <p className="text-[10px] text-baraka-sage">{t("ordersLabel")}</p>
                </div>
                <div className="bg-[var(--background)] rounded-lg py-1.5">
                  <p className="text-xs font-bold text-[var(--foreground)]">{b._count.inventory}</p>
                  <p className="text-[10px] text-baraka-sage">{t("productsLabel")}</p>
                </div>
              </div>
            </div>
          ))}

          {branches.length === 0 && (
            <div className="text-center py-12 text-baraka-sage">
              <GitBranch size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t("noBranches")}</p>
              <p className="text-xs mt-1">{t("createFirst")}</p>
            </div>
          )}
        </div>

        {/* Branch Detail Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[var(--foreground)]">{selected.name}</h2>
                  <p className="text-sm text-baraka-sage font-mono">[{selected.code}]</p>
                  {selected.address && <p className="text-sm text-baraka-sage mt-1">{selected.address}</p>}
                  {selected.phone   && <p className="text-sm text-baraka-sage">{selected.phone}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => { setShowAssign(true) }}
                    className="flex items-center gap-1.5"
                  >
                    <UserPlus size={14} /> {t("assignStaff")}
                  </Button>
                  {!selected.isDefault && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handleDeactivate(selected.id)}
                      className="flex items-center gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 size={14} /> {t("deactivate")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Stock summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--background)] rounded-xl p-4 text-center">
                  <Package size={20} className="mx-auto mb-1 text-baraka-sage" />
                  <p className="text-xl font-bold text-[var(--foreground)]">{selected.stockSummary.totalStock}</p>
                  <p className="text-xs text-baraka-sage">{t("totalStockUnits")}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-amber-600">{selected.stockSummary.lowStockCount}</p>
                  <p className="text-xs text-amber-600">{t("lowStock")}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                  <p className="text-xl font-bold text-red-600">{selected.stockSummary.outOfStockCount}</p>
                  <p className="text-xs text-red-600">{t("outOfStock")}</p>
                </div>
              </div>

              {/* Staff */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--foreground)] text-sm flex items-center gap-2">
                    <Users size={16} /> {t("assignedStaff")} ({selected.users.length})
                  </h3>
                </div>
                {selected.users.length > 0 ? (
                  <div className="space-y-2">
                    {selected.users.map(({ id: assignId, user }) => (
                      <div key={assignId} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-baraka-primary flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--foreground)]">{user.name}</p>
                            <p className="text-xs text-baraka-sage">{user.email} · {user.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.isActive
                            ? <CheckCircle size={14} className="text-green-500" />
                            : <XCircle    size={14} className="text-red-400" />
                          }
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-baraka-sage text-center py-4">{t("noStaffAssigned")}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-12 flex flex-col items-center justify-center text-baraka-sage">
              <GitBranch size={40} className="mb-4 opacity-20" />
              <p className="text-sm">{t("selectBranch")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Branch Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">{t("createNewBranch")}</h2>
              <button onClick={() => { setShowCreate(false); setError("") }}>
                <X size={20} className="text-baraka-sage" />
              </button>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-baraka-sage">{t("branchName")} *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kigali City Branch"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-baraka-sage">{t("branchCode")} * {t("codeLetters")}</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. KGL"
                  maxLength={6}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                />
                <p className="text-[10px] text-baraka-sage mt-1">{t("codeExample")}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-baraka-sage">{tCommon("address")}</label>
                <input
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Branch location"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-baraka-sage">{tCommon("phone")}</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+250 788 000 000"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setError("") }}>
                {tCommon("cancel")}
              </Button>
              <Button className="flex-1" onClick={handleCreate} disabled={saving || !form.name || !form.code}>
                {saving ? `${t("creating")}…` : t("createBranch")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssign && selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">{t("assignStaffTo")} {selected.name}</h2>
              <button onClick={() => { setShowAssign(false); setError("") }}>
                <X size={20} className="text-baraka-sage" />
              </button>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <label className="text-xs font-medium text-baraka-sage">{t("selectStaff")}</label>
              <select
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-baraka-primary"
              >
                <option value="">{t("chooseStaff")}…</option>
                {allStaff.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAssign(false); setError("") }}>
                {tCommon("cancel")}
              </Button>
              <Button className="flex-1" onClick={handleAssign} disabled={saving || !assignUserId}>
                {saving ? `${t("assigning")}…` : t("assign")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
