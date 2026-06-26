"use client"

import { useState, useEffect, useCallback } from "react"
import {
  UserCog, Plus, Loader2, Trash2,
  X, Shield, ShieldCheck, ShieldAlert,
  ToggleLeft, ToggleRight,
} from "lucide-react"
import { useTranslations } from "next-intl"

type Role = "OWNER" | "MANAGER" | "STAFF"

interface StaffMember {
  id:        string
  name:      string
  email:     string
  role:      Role
  isActive:  boolean
  createdAt: string
}

const ROLE_BADGE: Record<Role, string> = {
  OWNER:   "bg-baraka-primary/20 text-baraka-primary",
  MANAGER: "bg-amber-100 text-amber-700",
  STAFF:   "bg-gray-100 text-gray-600",
}
const ROLE_ICON: Record<Role, React.ElementType> = {
  OWNER:   ShieldAlert,
  MANAGER: ShieldCheck,
  STAFF:   Shield,
}

// ── Add Staff Modal ────────────────────────────────────────────────────────────
function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (u: StaffMember) => void
}) {
  const t       = useTranslations("staff")
  const tCommon = useTranslations("common")

  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [role,     setRole]     = useState<"MANAGER" | "STAFF">("STAFF")
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError(t("allFieldsRequired")); return
    }
    setSaving(true)
    setError("")
    const res  = await fetch("/api/users", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password, role }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || t("failedCreateStaff")); return }
    onCreated(data)
    onClose()
  }

  const inputClass = "w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-baraka-primary placeholder:text-[var(--muted)]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">{t("addStaffMember")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">{t("fullName")} *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="e.g. Uwimana Marie" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">{tCommon("email")} *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="marie@example.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">{t("tempPassword")} *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide block mb-2">{tCommon("staff")}</label>
            <div className="grid grid-cols-2 gap-2">
              {(["MANAGER", "STAFF"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    role === r
                      ? "border-baraka-primary bg-baraka-primary/10"
                      : "border-[var(--border)] hover:border-baraka-sage"
                  }`}
                >
                  <div className={`text-xs font-bold ${role === r ? "text-baraka-primary" : "text-[var(--foreground)]"}`}>
                    {r === "MANAGER" ? tCommon("manager") : tCommon("staff")}
                  </div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {r === "MANAGER" ? t("managerDesc") : t("staffDesc")}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--background)] transition-colors">
              {tCommon("cancel")}
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-baraka-primary hover:bg-baraka-dark text-white text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : t("addMember")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const t       = useTranslations("staff")
  const tCommon = useTranslations("common")

  const [staff,    setStaff]    = useState<StaffMember[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [showAdd,  setShowAdd]  = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchStaff = useCallback(() => {
    setLoading(true)
    fetch("/api/users")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setStaff(data)
        else setError(data.error || t("failedToLoad"))
        setLoading(false)
      })
      .catch(() => { setError(t("failedToLoad")); setLoading(false) })
  }, [t])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  async function handleRoleChange(id: string, role: Role) {
    setActionId(id)
    const res = await fetch(`/api/users/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ role }),
    })
    const data = await res.json()
    setActionId(null)
    if (res.ok) setStaff(prev => prev.map(u => u.id === id ? data : u))
  }

  async function handleToggleActive(member: StaffMember) {
    setActionId(member.id)
    const res = await fetch(`/api/users/${member.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !member.isActive }),
    })
    const data = await res.json()
    setActionId(null)
    if (res.ok) setStaff(prev => prev.map(u => u.id === member.id ? data : u))
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(t("removeConfirm", { name }))) return
    setActionId(id)
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
    setActionId(null)
    if (res.ok) setStaff(prev => prev.filter(u => u.id !== id))
  }

  const activeCount  = staff.filter(u => u.isActive).length
  const managerCount = staff.filter(u => u.role === "MANAGER").length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{t("teamMembers", { count: staff.length })}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> {t("addStaff")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-baraka-sage/20 rounded-lg flex items-center justify-center">
              <UserCog size={18} className="text-baraka-primary" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("totalMembers")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{staff.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ShieldCheck size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{tCommon("active")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <Shield size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("managers")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{managerCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-baraka-sage" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-red-500">{error}</p>
            <button onClick={fetchStaff} className="text-sm text-baraka-primary hover:underline">{tCommon("tryAgain")}</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{t("member")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{tCommon("staff")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{tCommon("status")}</th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">{t("joined")}</th>
                <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {staff.map(member => {
                const Icon = ROLE_ICON[member.role]
                const isBusy = actionId === member.id
                return (
                  <tr key={member.id} className="hover:bg-[var(--background)] transition-colors">
                    {/* Avatar + name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-baraka-sage/20 flex items-center justify-center text-baraka-primary font-bold text-sm flex-shrink-0">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{member.name}</p>
                          <p className="text-xs text-[var(--muted)]">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">
                      {member.role === "OWNER" ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE.OWNER}`}>
                          <Icon size={11} /> {tCommon("owner")}
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          disabled={isBusy}
                          onChange={e => handleRoleChange(member.id, e.target.value as Role)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer outline-none bg-[var(--background)] text-[var(--foreground)]"
                        >
                          <option value="MANAGER">{tCommon("manager")}</option>
                          <option value="STAFF">{tCommon("staff")}</option>
                        </select>
                      )}
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-4">
                      {member.role === "OWNER" ? (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(member)}
                          disabled={isBusy}
                          className="flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
                          title={member.isActive ? tCommon("deactivate") : tCommon("activate")}
                        >
                          {member.isActive ? (
                            <>
                              <ToggleRight size={20} className="text-emerald-500" />
                              <span className="text-xs text-emerald-600 font-medium">{tCommon("active")}</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={20} className="text-gray-400" />
                              <span className="text-xs text-[var(--muted)]">{tCommon("inactive")}</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-4">
                      <span className="text-sm text-[var(--muted)]">
                        {new Date(member.createdAt).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end">
                        {member.role !== "OWNER" && (
                          <button
                            onClick={() => handleDelete(member.id, member.name)}
                            disabled={isBusy}
                            className="p-2 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onCreated={u => setStaff(prev => [...prev, u])}
        />
      )}
    </div>
  )
}
