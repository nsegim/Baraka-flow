"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Plus, Trash2, Tag, Loader2, Pencil, Check, X, Building2, Users, ShieldCheck, Globe, History, Clock, Ban, CheckCircle, XCircle, Sliders, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config"

// ── Types ─────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string }

interface Business {
  id: string; name: string; email: string; phone: string | null
  address: string | null; logoUrl: string | null; currency: string
  taxRate: number
}

interface StaffUser {
  id: string; name: string; email: string
  role: "OWNER" | "MANAGER" | "STAFF"; isActive: boolean; createdAt: string
}

type Tab = "business" | "staff" | "categories" | "language" | "access-history" | "attributes"

interface AttrTemplate {
  id:         string
  name:       string
  key:        string
  type:       "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT"
  options:    string[] | null
  unit:       string | null
  isRequired: boolean
  sortOrder:  number
  isActive:   boolean
  categoryId: string | null
  category:   { id: string; name: string } | null
}

const ROLE_COLORS = {
  OWNER:   "bg-baraka-primary/10 text-baraka-primary",
  MANAGER: "bg-blue-100 text-blue-700",
  STAFF:   "bg-gray-100 text-gray-600",
}

// ── Business Profile Tab ──────────────────────────────────────────────────────
function BusinessTab() {
  const t       = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [business,  setBusiness]  = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving,  setIsSaving]  = useState(false)
  const [success,   setSuccess]   = useState("")
  const [error,     setError]     = useState("")

  const [name,    setName]    = useState("")
  const [phone,   setPhone]   = useState("")
  const [address, setAddress] = useState("")
  const [taxRate, setTaxRate] = useState("18")

  useEffect(() => {
    fetch("/api/business")
      .then(r => r.json())
      .then(data => {
        setBusiness(data)
        setName(data.name ?? "")
        setPhone(data.phone ?? "")
        setAddress(data.address ?? "")
        setTaxRate(String(Math.round(Number(data.taxRate ?? 0.18) * 100)))
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!isOwner) return
    setIsSaving(true)
    setError("")
    const res = await fetch("/api/business", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name,
        phone:   phone || null,
        address: address || null,
        taxRate: Number(taxRate) / 100,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Failed to save"); setIsSaving(false); return }
    setBusiness(data)
    setSuccess(t("profileSaved"))
    setTimeout(() => setSuccess(""), 3000)
    setIsSaving(false)
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-baraka-sage/40 bg-[var(--card)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors disabled:opacity-60"

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-lg">
      {success && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">✓ {success}</p>}
      {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("businessName")}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!isOwner} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("email")}</label>
        <input type="email" value={business?.email ?? ""} disabled className={inputClass} />
        <p className="text-xs text-[var(--muted)] mt-1">{t("emailNoChange")}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("phone")}</label>
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} disabled={!isOwner} placeholder="+250 788 000 000" className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("address")}</label>
        <textarea value={address} onChange={e => setAddress(e.target.value)} disabled={!isOwner} rows={2} placeholder="Kigali, Rwanda" className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{t("taxRate")}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={taxRate}
            onChange={e => setTaxRate(e.target.value)}
            disabled={!isOwner}
            placeholder="18"
            className={`${inputClass} w-32`}
          />
          <span className="text-sm text-[var(--muted)]">%</span>
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">{t("vatHint")}</p>
      </div>

      {isOwner && (
        <Button type="submit" disabled={isSaving} className="bg-baraka-primary hover:bg-baraka-dark text-white px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {isSaving ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />{tCommon("saving")}...</span> : t("saveChanges")}
        </Button>
      )}
      {!isOwner && <p className="text-xs text-[var(--muted)]">{t("ownerOnlyEdit")}</p>}
    </form>
  )
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const t       = useTranslations("settings")
  const tCommon = useTranslations("common")

  const [name,     setName]     = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [role,     setRole]     = useState<"MANAGER" | "STAFF">("STAFF")
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch("/api/users", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email, password, role }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || t("failedCreateStaff")); setLoading(false); return }
    onCreated()
    onClose()
    setLoading(false)
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-baraka-sage/40 bg-[var(--card)] text-[var(--foreground)] text-sm placeholder:text-[var(--muted)] outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[var(--card)] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--foreground)]">{t("addStaff")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"><X size={18} className="text-[var(--muted)]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("name")}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("email")}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("password") ?? "Password"}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{tCommon("staff")}</label>
            <select value={role} onChange={e => setRole(e.target.value as "MANAGER" | "STAFF")} className={inputClass}>
              <option value="STAFF">{t("staffReadOnly")}</option>
              <option value="MANAGER">{t("managerCanEdit")}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors">{tCommon("cancel")}</Button>
            <Button type="submit" disabled={loading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{tCommon("adding")}...</span> : t("addStaff")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StaffTab() {
  const t       = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { data: session, status: sessionStatus } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [users,    setUsers]    = useState<StaffUser[]>([])
  const [fetched,  setFetched]  = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [key,      setKey]      = useState(0)

  const refresh = useCallback(() => { setFetched(false); setKey(k => k + 1) }, [])

  useEffect(() => {
    if (!isOwner) return
    fetch("/api/users")
      .then(r => r.json())
      .then(data => { setUsers(data); setFetched(true) })
      .catch(() => setFetched(true))
  }, [isOwner, key])

  const isLoading = sessionStatus === "loading" || (isOwner && !fetched)

  async function handleRoleChange(id: string, role: "MANAGER" | "STAFF") {
    setActionId(id)
    const res = await fetch(`/api/users/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ role }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
    }
    setActionId(null)
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setActionId(id)
    const res = await fetch(`/api/users/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !isActive }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
    }
    setActionId(null)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from your business?`)) return
    setActionId(id)
    await fetch(`/api/users/${id}`, { method: "DELETE" })
    setUsers(prev => prev.filter(u => u.id !== id))
    setActionId(null)
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <ShieldCheck size={40} className="text-baraka-sage/40" />
        <p className="text-sm text-[var(--muted)]">{t("ownerOnlyStaff")}</p>
      </div>
    )
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> {t("addStaff")}
        </Button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className={`flex items-center justify-between px-4 py-3.5 rounded-xl border ${u.isActive ? "border-[var(--border)] bg-[var(--card)]" : "border-dashed border-[var(--border)] bg-[var(--background)] opacity-60"}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-baraka-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-baraka-primary">{u.name[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{u.name}</p>
                <p className="text-xs text-[var(--muted)]">{u.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 ${ROLE_COLORS[u.role]}`}>{u.role}</span>
              {!u.isActive && <span className="text-xs text-[var(--muted)] bg-[var(--border)] px-2 py-0.5 rounded-full">{tCommon("inactive")}</span>}
            </div>
            {u.role !== "OWNER" && (
              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value as "MANAGER" | "STAFF")}
                  disabled={actionId === u.id}
                  className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--card)] text-[var(--foreground)] outline-none focus:border-baraka-primary disabled:opacity-50"
                >
                  <option value="STAFF">{tCommon("staff")}</option>
                  <option value="MANAGER">{tCommon("manager")}</option>
                </select>
                <button
                  onClick={() => handleToggleActive(u.id, u.isActive)}
                  disabled={actionId === u.id}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors disabled:opacity-50"
                >
                  {u.isActive ? t("deactivate") : t("activate")}
                </button>
                <button
                  onClick={() => handleDelete(u.id, u.name)}
                  disabled={actionId === u.id}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && <AddStaffModal onClose={() => setShowAdd(false)} onCreated={refresh} />}
    </>
  )
}

// ── Categories Tab ────────────────────────────────────────────────────────────
function CategoriesTab() {
  const t       = useTranslations("settings")
  const tCommon = useTranslations("common")

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [newName,    setNewName]    = useState("")
  const [isAdding,   setIsAdding]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState("")
  const [success,    setSuccess]    = useState("")
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isSaving,    setIsSaving]    = useState(false)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingId) editInputRef.current?.focus() }, [editingId])

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => { setCategories(data); setIsLoading(false) })
      .catch(() => { setError("Failed to load categories"); setIsLoading(false) })
  }, [])

  function showSuccess(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(""), 3000) }

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setIsAdding(true); setError(""); setSuccess("")
    const res  = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Failed to add category"); setIsAdding(false); return }
    setCategories(prev => [...prev, data]); setNewName(""); showSuccess(`"${data.name}" added`)
    setIsAdding(false)
  }

  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) return
    if (categories.find(c => c.id === id)?.name === editingName.trim()) { setEditingId(null); return }
    setIsSaving(true)
    const res  = await fetch(`/api/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingName.trim() }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Failed to update"); setIsSaving(false); return }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: data.name } : c))
    setEditingId(null); showSuccess(`Renamed to "${data.name}"`); setIsSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    setDeletingId(id)
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
    if (!res.ok) { const data = await res.json(); setError(data.error || "Failed to delete"); setDeletingId(null); return }
    setCategories(prev => prev.filter(c => c.id !== id)); showSuccess(`"${name}" deleted`); setDeletingId(null)
  }

  const inputClass = "flex-1 px-3 py-2.5 rounded-lg border border-baraka-sage/40 bg-baraka-cream/50 text-baraka-dark text-sm placeholder:text-baraka-sage outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  return (
    <div className="space-y-4">
      {error   && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">✓ {success}</div>}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder={t("categoryPlaceholder")} className={inputClass} />
        <Button type="submit" disabled={!newName.trim() || isAdding} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
          {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {tCommon("add")}
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8">
          <Tag size={32} className="text-baraka-sage/30 mx-auto mb-2" />
          <p className="text-sm text-[var(--muted)]">{t("noCategories")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--background)] border border-[var(--border)] group">
              {editingId === cat.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input ref={editInputRef} type="text" value={editingName} onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(cat.id); if (e.key === "Escape") setEditingId(null) }}
                    className="flex-1 px-2 py-1 rounded-md border border-baraka-primary bg-white text-baraka-dark text-sm outline-none focus:ring-2 focus:ring-baraka-primary/20"
                  />
                  <button onClick={() => handleSaveEdit(cat.id)} disabled={!editingName.trim() || isSaving} className="p-1.5 rounded-lg bg-baraka-primary hover:bg-baraka-dark text-white transition-colors disabled:opacity-50">
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-baraka-primary" />
                    <span className="text-sm font-medium text-[var(--foreground)]">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(cat.id); setEditingName(cat.name) }} className="p-1.5 rounded-lg hover:bg-baraka-primary/10 text-baraka-sage hover:text-baraka-primary transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(cat.id, cat.name)} disabled={deletingId === cat.id} className="p-1.5 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors disabled:opacity-50">
                      {deletingId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Language Tab ──────────────────────────────────────────────────────────────
function LanguageTab() {
  const t       = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [personal,   setPersonal]   = useState<Locale | "">(() => {
    if (typeof document === "undefined") return ""
    const cookie = document.cookie.split("; ").find(c => c.startsWith("bf-locale="))
    return cookie ? (cookie.split("=")[1] as Locale) : ""
  })
  const [business,   setBusiness]   = useState<Locale>("en")
  const [saving,     setSaving]     = useState(false)
  const [savingBiz,  setSavingBiz]  = useState(false)
  const [success,    setSuccess]    = useState("")

  useEffect(() => {
    if (!isOwner) return
    fetch("/api/business").then(r => r.json()).then(d => {
      if (d.language) setBusiness(d.language as Locale)
    })
  }, [isOwner])

  async function savePersonal(lang: Locale | "") {
    setSaving(true)
    setSuccess("")
    try {
      await fetch("/api/user/language", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ language: lang || null }),
      })
      const expires = lang
        ? `; expires=${new Date(Date.now() + 365 * 86400000).toUTCString()}`
        : "; expires=Thu, 01 Jan 1970 00:00:00 UTC"
      document.cookie = `${LOCALE_COOKIE}=${lang}; path=/${expires}`
      setPersonal(lang)
      setSuccess(t("languageSaved"))
      setTimeout(() => { setSuccess(""); window.location.reload() }, 800)
    } finally {
      setSaving(false)
    }
  }

  async function saveBusinessDefault(lang: Locale) {
    setSavingBiz(true)
    try {
      await fetch("/api/user/language", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ language: lang, updateBusiness: true }),
      })
      setBusiness(lang)
      setSuccess(t("languageSaved"))
      setTimeout(() => setSuccess(""), 2500)
    } finally {
      setSavingBiz(false)
    }
  }

  const LOCALE_NAMES = t.raw("languages") as Record<string, string>

  return (
    <div className="space-y-6 max-w-lg">
      {success && <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3">✓ {success}</p>}

      {/* Personal preference */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("myLanguage")}</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">{t("myLanguageSubtitle")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => savePersonal("")}
            disabled={saving}
            className={`p-3 rounded-xl border text-left transition-colors text-sm ${
              personal === ""
                ? "border-baraka-primary bg-baraka-primary/10 text-baraka-primary"
                : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-baraka-sage"
            }`}
          >
            {t("useBusinessDefault")}
          </button>
          {LOCALES.map(loc => (
            <button
              key={loc}
              onClick={() => savePersonal(loc)}
              disabled={saving}
              className={`p-3 rounded-xl border text-left transition-colors text-sm font-medium ${
                personal === loc
                  ? "border-baraka-primary bg-baraka-primary/10 text-baraka-primary"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-baraka-sage"
              }`}
            >
              <span className="flex items-center gap-2">
                <Globe size={14} />
                {LOCALE_NAMES[loc] ?? loc}
              </span>
            </button>
          ))}
        </div>
        {saving && <p className="text-xs text-[var(--muted)]">{tCommon("saving")}...</p>}
      </div>

      {/* Business default (OWNER only) */}
      {isOwner && (
        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("businessDefaultLanguage")}</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">{t("businessDefaultLanguageHint")}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LOCALES.map(loc => (
              <button
                key={loc}
                onClick={() => saveBusinessDefault(loc)}
                disabled={savingBiz}
                className={`p-3 rounded-xl border text-left transition-colors text-sm font-medium ${
                  business === loc
                    ? "border-baraka-primary bg-baraka-primary/10 text-baraka-primary"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-baraka-sage"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Globe size={14} />
                  {LOCALE_NAMES[loc] ?? loc}
                </span>
              </button>
            ))}
          </div>
          {savingBiz && <p className="text-xs text-[var(--muted)]">{tCommon("saving")}...</p>}
        </div>
      )}
    </div>
  )
}

// ── Access History Tab ────────────────────────────────────────────────────────
interface AccessSession {
  id: string
  status: "ACTIVE" | "EXPIRED" | "ENDED" | "REVOKED"
  accessScope: "READ_ONLY" | "FULL_IMPERSONATION"
  justification: string
  createdAt: string
  expiresAt: string
  endedAt: string | null
  platformUser: { name: string }
  _count: { actions: number }
}

const ACCESS_STATUS_STYLE: Record<string, string> = {
  ACTIVE:  "bg-amber-100 text-amber-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  ENDED:   "bg-green-100 text-green-700",
  REVOKED: "bg-red-100 text-red-600",
}

const ACCESS_STATUS_ICON: Record<string, React.ReactNode> = {
  ACTIVE:  <Clock       size={11} />,
  EXPIRED: <XCircle     size={11} />,
  ENDED:   <CheckCircle size={11} />,
  REVOKED: <Ban         size={11} />,
}

function AccessHistoryTab() {
  const t = useTranslations("settings")
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [sessions, setSessions] = useState<AccessSession[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!isOwner) return
    fetch("/api/settings/access-history")
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [isOwner])

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <ShieldCheck size={40} className="text-baraka-sage/40" />
        <p className="text-sm text-[var(--muted)]">{t("ownerOnlyStaff")}</p>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">{t("accessHistorySubtitle")}</p>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <ShieldCheck size={36} className="text-emerald-500/50" />
          <p className="text-sm text-[var(--muted)]">{t("noAccessHistory")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_STATUS_STYLE[s.status]}`}>
                    {ACCESS_STATUS_ICON[s.status]} {t(`session${s.status.charAt(0) + s.status.slice(1).toLowerCase()}` as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--muted)]">
                    {s.accessScope === "READ_ONLY" ? t("readOnly") : t("fullAccess")}
                  </span>
                </div>
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[var(--muted)]">{t("sessionAgent")}: </span>
                  <span className="font-medium text-[var(--foreground)]">{s.platformUser.name}</span>
                </div>
                <div>
                  <span className="text-[var(--muted)]">{t("sessionActions")}: </span>
                  <span className="font-medium text-[var(--foreground)]">{s._count.actions}</span>
                </div>
              </div>
              <div className="text-xs">
                <span className="text-[var(--muted)]">{t("sessionJustification")}: </span>
                <span className="text-[var(--foreground)]">{s.justification}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Attributes Tab ────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  TEXT:    "Text",
  NUMBER:  "Number",
  BOOLEAN: "Toggle",
  SELECT:  "Dropdown",
}
const TYPE_COLORS: Record<string, string> = {
  TEXT:    "bg-gray-100 text-gray-600",
  NUMBER:  "bg-blue-100 text-blue-700",
  BOOLEAN: "bg-purple-100 text-purple-700",
  SELECT:  "bg-amber-100 text-amber-700",
}

function AttributesTab() {
  const t      = useTranslations("settings")
  const { data: session } = useSession()
  const canEdit = ["OWNER", "MANAGER"].includes(session?.user?.role ?? "")

  const [templates,   setTemplates]   = useState<AttrTemplate[]>([])
  const [categories,  setCategories]  = useState<Category[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [isSaving,    setIsSaving]    = useState(false)
  const [formError,   setFormError]   = useState("")

  // Form fields
  const [fName,       setFName]       = useState("")
  const [fKey,        setFKey]        = useState("")
  const [fType,       setFType]       = useState<"TEXT"|"NUMBER"|"BOOLEAN"|"SELECT">("TEXT")
  const [fOptions,    setFOptions]    = useState("")  // comma-separated raw input
  const [fUnit,       setFUnit]       = useState("")
  const [fRequired,   setFRequired]   = useState(false)
  const [fOrder,      setFOrder]      = useState("0")
  const [fCategoryId, setFCategoryId] = useState("")

  const inputClass = "w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-sm outline-none focus:border-baraka-primary focus:ring-2 focus:ring-baraka-primary/20 transition-colors"

  async function fetchTemplates() {
    setIsLoading(true)
    try {
      const res = await fetch("/api/attribute-templates?all=true")
      const data = await res.json()
      if (Array.isArray(data)) setTemplates(data)
    } catch {}
    setIsLoading(false)
  }

  useEffect(() => {
    fetchTemplates()
    fetch("/api/categories").then(r => r.json()).then(d => { if (Array.isArray(d)) setCategories(d) }).catch(() => {})
  }, [])

  function handleNameChange(val: string) {
    setFName(val)
    if (!editingId) {
      // Auto-generate machine key from name: "Color (hex)" → "color_hex"
      setFKey(
        val.toLowerCase()
          .replace(/[()]/g, "")
          .trim()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
      )
    }
  }

  function openCreate() {
    setFName(""); setFKey(""); setFType("TEXT"); setFOptions(""); setFUnit("")
    setFRequired(false); setFOrder("0"); setFCategoryId("")
    setFormError(""); setEditingId(null); setShowForm(true)
  }

  function openEdit(tmpl: AttrTemplate) {
    setFName(tmpl.name); setFKey(tmpl.key); setFType(tmpl.type)
    setFOptions(tmpl.options?.join(", ") ?? ""); setFUnit(tmpl.unit ?? "")
    setFRequired(tmpl.isRequired); setFOrder(String(tmpl.sortOrder))
    setFCategoryId(tmpl.categoryId ?? "")
    setFormError(""); setEditingId(tmpl.id); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditingId(null); setFormError("")
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setFormError("")
    if (!fName.trim() || !fKey.trim()) { setFormError("Name and key are required"); return }

    const options = fType === "SELECT"
      ? fOptions.split(",").map(o => o.trim()).filter(Boolean)
      : undefined

    if (fType === "SELECT" && (!options || options.length < 2)) {
      setFormError("Dropdown type requires at least 2 options (comma-separated)")
      return
    }

    const payload = {
      name:       fName.trim(),
      key:        fKey.trim(),
      type:       fType,
      options:    options ?? null,
      unit:       fUnit.trim() || null,
      isRequired: fRequired,
      sortOrder:  parseInt(fOrder) || 0,
      categoryId: fCategoryId || null,
    }

    setIsSaving(true)
    try {
      const url    = editingId ? `/api/attribute-templates/${editingId}` : `/api/attribute-templates`
      const method = editingId ? "PATCH" : "POST"
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || "Failed to save"); setIsSaving(false); return }
      closeForm()
      fetchTemplates()
    } catch { setFormError("Something went wrong") }
    setIsSaving(false)
  }

  async function handleToggle(tmpl: AttrTemplate) {
    await fetch(`/api/attribute-templates/${tmpl.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !tmpl.isActive }),
    })
    fetchTemplates()
  }

  async function handleDelete(tmpl: AttrTemplate) {
    if (!confirm(t("attrDeleteConfirm"))) return
    await fetch(`/api/attribute-templates/${tmpl.id}`, { method: "DELETE" })
    fetchTemplates()
  }

  const globalTemplates   = templates.filter(t => !t.categoryId)
  const categoryTemplates = templates.filter(t => !!t.categoryId)

  // Group category-scoped templates by category name
  const byCategory = categoryTemplates.reduce<Record<string, AttrTemplate[]>>((acc, tmpl) => {
    const key = tmpl.category?.name ?? tmpl.categoryId ?? "Unknown"
    ;(acc[key] ??= []).push(tmpl)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--foreground)]">{t("attributesTab")}</h3>
          <p className="text-sm text-[var(--muted)] mt-0.5">{t("attributesSubtitle")}</p>
        </div>
        {canEdit && (
          <Button
            onClick={showForm && !editingId ? closeForm : openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-baraka-primary text-white text-sm rounded-lg hover:bg-baraka-dark transition-colors shrink-0"
          >
            {showForm && !editingId ? <X size={14} /> : <Plus size={14} />}
            {showForm && !editingId ? t("attrCancel") : t("newAttribute")}
          </Button>
        )}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="rounded-xl border-2 border-baraka-primary/30 bg-baraka-primary/5 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-baraka-primary">
            {editingId ? t("attrSaveEdit") : t("attrSaveNew")}
          </h4>

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{formError}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name + Key */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrName")} *</label>
                <input
                  type="text"
                  value={fName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Color"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  {t("attrKey")} *
                  <span className="ml-1 font-normal text-baraka-sage">(machine-readable)</span>
                </label>
                <input
                  type="text"
                  value={fKey}
                  onChange={e => setFKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. color"
                  className={inputClass}
                  required
                  disabled={!!editingId}
                />
              </div>
            </div>

            {/* Type + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrType")}</label>
                <select
                  value={fType}
                  onChange={e => { setFType(e.target.value as typeof fType); setFOptions("") }}
                  className={inputClass}
                >
                  <option value="TEXT">Text — free input</option>
                  <option value="NUMBER">Number — numeric value</option>
                  <option value="BOOLEAN">Toggle — Yes / No</option>
                  <option value="SELECT">Dropdown — fixed choices</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  {t("attrUnit")}
                  <span className="ml-1 font-normal text-baraka-sage">(optional)</span>
                </label>
                <input
                  type="text"
                  value={fUnit}
                  onChange={e => setFUnit(e.target.value)}
                  placeholder="e.g. kg, cm, GB"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Options — only for SELECT */}
            {fType === "SELECT" && (
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrOptions")} *</label>
                <input
                  type="text"
                  value={fOptions}
                  onChange={e => setFOptions(e.target.value)}
                  placeholder="e.g. Red, Blue, Black, White"
                  className={inputClass}
                  required
                />
                {fOptions && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {fOptions.split(",").map(o => o.trim()).filter(Boolean).map(opt => (
                      <span key={opt} className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">{opt}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scope + Required + Order */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrCategory")}</label>
                <select
                  value={fCategoryId}
                  onChange={e => setFCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("attrScopeGlobal")}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrSortOrder")}</label>
                <input
                  type="number"
                  value={fOrder}
                  onChange={e => setFOrder(e.target.value)}
                  min="0"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("attrRequired")}</label>
                <button
                  type="button"
                  onClick={() => setFRequired(r => !r)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    fRequired
                      ? "border-baraka-primary/40 bg-baraka-primary/10 text-baraka-primary"
                      : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)]"
                  }`}
                >
                  {fRequired ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {fRequired ? "Yes" : "No"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-baraka-primary text-white text-sm rounded-lg hover:bg-baraka-dark transition-colors disabled:opacity-50"
              >
                {isSaving
                  ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Saving…</span>
                  : editingId ? t("attrSaveEdit") : t("attrSaveNew")
                }
              </Button>
              <Button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 border border-[var(--border)] text-[var(--muted)] text-sm rounded-lg hover:bg-[var(--background)] transition-colors"
              >
                {t("attrCancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Template list ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-baraka-sage" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)]">
          <Sliders size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("noAttributes")}</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Global templates */}
          {globalTemplates.length > 0 && (
            <TemplateGroup
              label={t("attrGlobal")}
              sublabel={t("attrScopeGlobal")}
              templates={globalTemplates}
              canEdit={canEdit}
              onEdit={openEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}

          {/* Category-scoped templates */}
          {Object.entries(byCategory).map(([catName, tmpls]) => (
            <TemplateGroup
              key={catName}
              label={catName}
              sublabel={`${tmpls.length} attribute${tmpls.length !== 1 ? "s" : ""}`}
              templates={tmpls}
              canEdit={canEdit}
              onEdit={openEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Template Group ─────────────────────────────────────────────────────────────
interface TemplateGroupProps {
  label:     string
  sublabel:  string
  templates: AttrTemplate[]
  canEdit:   boolean
  onEdit:    (t: AttrTemplate) => void
  onToggle:  (t: AttrTemplate) => void
  onDelete:  (t: AttrTemplate) => void
}

function TemplateGroup({ label, sublabel, templates, canEdit, onEdit, onToggle, onDelete }: TemplateGroupProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--background)] hover:bg-[var(--card)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-baraka-primary" />
          <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
          <span className="text-xs text-[var(--muted)]">— {sublabel}</span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-[var(--muted)]" /> : <ChevronUp size={14} className="text-[var(--muted)]" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-[var(--border)]">
          {templates.map(tmpl => (
            <div
              key={tmpl.id}
              className={`flex items-center gap-3 px-4 py-3 ${!tmpl.isActive ? "opacity-50" : ""}`}
            >
              {/* Type badge */}
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[tmpl.type]}`}>
                {TYPE_LABELS[tmpl.type]}
              </span>

              {/* Name + key + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[var(--foreground)]">{tmpl.name}</span>
                  {tmpl.unit && (
                    <span className="text-xs text-baraka-sage">({tmpl.unit})</span>
                  )}
                  {tmpl.isRequired && (
                    <span className="text-xs px-1.5 py-0.5 bg-red-50 text-red-500 rounded-full">Required</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-baraka-sage font-mono">{tmpl.key}</code>
                  {tmpl.type === "SELECT" && tmpl.options && (
                    <span className="text-xs text-[var(--muted)] truncate">
                      {tmpl.options.join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => onToggle(tmpl)}
                    title={tmpl.isActive ? "Deactivate" : "Activate"}
                    className={`p-1.5 rounded-lg transition-colors ${
                      tmpl.isActive
                        ? "text-green-600 hover:bg-green-50"
                        : "text-[var(--muted)] hover:bg-[var(--background)]"
                    }`}
                  >
                    {tmpl.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => onEdit(tmpl)}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:text-baraka-primary hover:bg-baraka-primary/10 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => onDelete(tmpl)}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const t = useTranslations("settings")
  const [activeTab, setActiveTab] = useState<Tab>("business")

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "business",        label: t("businessProfile"),   icon: Building2 },
    { id: "staff",           label: t("staffAndRoles"),     icon: Users     },
    { id: "categories",      label: t("categories"),        icon: Tag       },
    { id: "language",        label: t("languageTab"),       icon: Globe     },
    { id: "access-history",  label: t("accessHistoryTab"),  icon: History   },
    { id: "attributes",      label: t("attributesTab"),     icon: Sliders   },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">{t("subtitle")}</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 flex-1 justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm border border-[var(--border)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6">
        {activeTab === "business"        && <BusinessTab />}
        {activeTab === "staff"           && <StaffTab />}
        {activeTab === "categories"      && <CategoriesTab />}
        {activeTab === "language"        && <LanguageTab />}
        {activeTab === "access-history"  && <AccessHistoryTab />}
        {activeTab === "attributes"      && <AttributesTab />}
      </div>
    </div>
  )
}
