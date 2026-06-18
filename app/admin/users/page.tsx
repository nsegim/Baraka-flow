"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Users, Search, RefreshCw, Building2, KeyRound, X, Loader2,
  ShieldCheck, Eye, EyeOff,
} from "lucide-react"

interface AdminUser {
  id: string; name: string; email: string
  role: "OWNER" | "MANAGER" | "STAFF"; isActive: boolean; createdAt: string
  business: { id: string; name: string; status: "ACTIVE" | "SUSPENDED" }
}

interface Meta { total: number; page: number; limit: number; pages: number }

const roleStyles = {
  OWNER:   "bg-purple-500/20 text-purple-400 border-purple-500/20",
  MANAGER: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  STAFF:   "bg-gray-700 text-gray-400 border-gray-600",
}

// ── Reset Password Modal ───────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [success,  setSuccess]  = useState(false)

  async function handleReset() {
    setError("")
    if (password.length < 8) { setError("Password must be at least 8 characters"); return }
    if (password !== confirm)  { setError("Passwords do not match"); return }
    setLoading(true)
    const res  = await fetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || "Failed to reset password"); return }
    setSuccess(true)
  }

  const inp = "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <KeyRound size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Reset Password</h2>
              <p className="text-xs text-gray-500">{user.name} · {user.business.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ShieldCheck size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm text-gray-300 text-center">
                Password reset successfully.<br />
                The user will need to sign in with their new password.
              </p>
              <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors mt-2">
                Close
              </button>
            </div>
          ) : (
            <>
              {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
              <p className="text-sm text-gray-400">
                Set a new password for this user. The existing password will be replaced immediately.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={`${inp} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                <input
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className={inp}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={loading || !password || !confirm}
                  className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Reset Password
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users,     setUsers]     = useState<AdminUser[]>([])
  const [meta,      setMeta]      = useState<Meta>({ total: 0, page: 1, limit: 30, pages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState("")
  const [search,    setSearch]    = useState("")
  const [page,      setPage]      = useState(1)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(json => { setUsers(json.data); setMeta(json.meta); setIsLoading(false) })
      .catch(() => { setError("Failed to load users"); setIsLoading(false) })
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })
  }

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} user{meta.total !== 1 ? "s" : ""} across all tenants</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email or business…"
          className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder:text-gray-500 outline-none focus:border-gray-500 transition-colors"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={18} className="animate-spin text-gray-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Users size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">No users found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Business</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-purple-400">{getInitials(user.name)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-gray-600" />
                        <span className="text-sm text-gray-300">{user.business.name}</span>
                        {user.business.status === "SUSPENDED" && (
                          <span className="text-xs text-red-400">(suspended)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${roleStyles[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setResetUser(user)}
                        title="Reset password"
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-700 hover:text-amber-400 transition-colors"
                      >
                        <KeyRound size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {Math.min((meta.page - 1) * meta.limit + 1, meta.total)}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Previous</button>
            <span className="px-3 py-1.5 text-sm text-gray-500">Page {meta.page} of {meta.pages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages} className="px-3 py-1.5 text-sm rounded-lg bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors">Next</button>
          </div>
        </div>
      )}

      {resetUser && (
        <ResetPasswordModal key={resetUser.id} user={resetUser} onClose={() => setResetUser(null)} />
      )}
    </div>
  )
}
