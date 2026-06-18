"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Plus, Trash2, Tag, Loader2, Pencil, Check, X, Building2, Users, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"

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

type Tab = "business" | "staff" | "categories"

const ROLE_COLORS = {
  OWNER:   "bg-baraka-primary/10 text-baraka-primary",
  MANAGER: "bg-blue-100 text-blue-700",
  STAFF:   "bg-gray-100 text-gray-600",
}

// ── Business Profile Tab ──────────────────────────────────────────────────────
function BusinessTab() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")

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
    setSuccess("Business profile saved")
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
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Business Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={!isOwner} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Email</label>
        <input type="email" value={business?.email ?? ""} disabled className={inputClass} />
        <p className="text-xs text-[var(--muted)] mt-1">Email cannot be changed after registration.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Phone</label>
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} disabled={!isOwner} placeholder="+250 788 000 000" className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Address</label>
        <textarea value={address} onChange={e => setAddress(e.target.value)} disabled={!isOwner} rows={2} placeholder="Kigali, Rwanda" className={`${inputClass} resize-none`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">VAT Rate (%)</label>
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
        <p className="text-xs text-[var(--muted)] mt-1">
          Rwanda standard VAT is 18%. Set to 0 to disable tax on invoices.
        </p>
      </div>

      {isOwner && (
        <Button type="submit" disabled={isSaving} className="bg-baraka-primary hover:bg-baraka-dark text-white px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
          {isSaving ? <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Saving...</span> : "Save Changes"}
        </Button>
      )}
      {!isOwner && <p className="text-xs text-[var(--muted)]">Only the account owner can edit business settings.</p>}
    </form>
  )
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    if (!res.ok) { setError(data.error || "Failed to create staff"); setLoading(false); return }
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
          <h2 className="text-lg font-bold text-[var(--foreground)]">Add Staff Member</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--background)] transition-colors"><X size={18} className="text-[var(--muted)]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as "MANAGER" | "STAFF")} className={inputClass}>
              <option value="STAFF">Staff — read only</option>
              <option value="MANAGER">Manager — can create and edit</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-[var(--border)] transition-colors">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Adding...</span> : "Add Staff"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StaffTab() {
  const { data: session, status: sessionStatus } = useSession()
  const isOwner = session?.user?.role === "OWNER"

  const [users,    setUsers]    = useState<StaffUser[]>([])
  const [fetched,  setFetched]  = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [key,      setKey]      = useState(0)

  // setFetched(false) is in an event handler — not in an effect body
  const refresh = useCallback(() => { setFetched(false); setKey(k => k + 1) }, [])

  useEffect(() => {
    if (!isOwner) return  // no setState — non-owners see JSX guard below
    fetch("/api/users")
      .then(r => r.json())
      .then(data => { setUsers(data); setFetched(true) })
      .catch(() => setFetched(true))
  }, [isOwner, key])

  // Loading: session still resolving, or owner but fetch not yet complete
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
        <p className="text-sm text-[var(--muted)]">Only the account owner can manage staff.</p>
      </div>
    )
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2 rounded-lg text-sm transition-colors">
          <Plus size={16} /> Add Staff
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
              {!u.isActive && <span className="text-xs text-[var(--muted)] bg-[var(--border)] px-2 py-0.5 rounded-full">Deactivated</span>}
            </div>
            {u.role !== "OWNER" && (
              <div className="flex items-center gap-2">
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value as "MANAGER" | "STAFF")}
                  disabled={actionId === u.id}
                  className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--card)] text-[var(--foreground)] outline-none focus:border-baraka-primary disabled:opacity-50"
                >
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                </select>
                <button
                  onClick={() => handleToggleActive(u.id, u.isActive)}
                  disabled={actionId === u.id}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-[var(--background)] transition-colors disabled:opacity-50"
                >
                  {u.isActive ? "Deactivate" : "Activate"}
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

// ── Categories Tab (existing logic, extracted) ────────────────────────────────
function CategoriesTab() {
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

  async function handleAdd(e: React.FormEvent) {
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
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Bedroom, Office Furniture..." className={inputClass} />
        <Button type="submit" disabled={!newName.trim() || isAdding} className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
          {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-baraka-sage" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8">
          <Tag size={32} className="text-baraka-sage/30 mx-auto mb-2" />
          <p className="text-sm text-[var(--muted)]">No categories yet</p>
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("business")

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "business",   label: "Business Profile", icon: Building2 },
    { id: "staff",      label: "Staff & Roles",    icon: Users     },
    { id: "categories", label: "Categories",       icon: Tag       },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Manage your business configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
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
        {activeTab === "business"   && <BusinessTab />}
        {activeTab === "staff"      && <StaffTab />}
        {activeTab === "categories" && <CategoriesTab />}
      </div>
    </div>
  )
}
