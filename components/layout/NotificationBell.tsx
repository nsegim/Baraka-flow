"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, ShoppingCart, Truck, XCircle, Package, CreditCard, RotateCcw, CheckCheck, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface Notification {
  id:        string
  type:      string
  title:     string
  message:   string
  link:      string | null
  isRead:    boolean
  createdAt: string
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  NEW_ORDER:        { icon: ShoppingCart, color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10"   },
  ORDER_DELIVERED:  { icon: Truck,        color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" },
  ORDER_CANCELLED:  { icon: XCircle,      color: "text-red-500 bg-red-50 dark:bg-red-500/10"      },
  LOW_STOCK:        { icon: Package,      color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10"},
  PAYMENT_RECEIVED: { icon: CreditCard,   color: "text-purple-500 bg-purple-50 dark:bg-purple-500/10" },
  ORDER_RETURNED:   { icon: RotateCcw,    color: "text-orange-500 bg-orange-50 dark:bg-orange-500/10" },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const router = useRouter()
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetch("/api/notifications")
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications ?? [])
        setUnreadCount(data.unreadCount ?? 0)
      })
      .catch(() => {})
  }, [])

  // Poll every 30 seconds
  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" }).catch(() => {})
    setNotifications(n => n.map(x => ({ ...x, isRead: true })))
    setUnreadCount(0)
  }

  async function handleClick(n: Notification) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {})
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    if (n.link) { setOpen(false); router.push(n.link) }
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load() }}
        className="relative p-2 rounded-lg hover:bg-[var(--background)] transition-colors"
      >
        <Bell size={18} className="text-[var(--foreground)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-medium">{unreadCount}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} title="Mark all as read" className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  <CheckCheck size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={28} className="text-[var(--muted)]" />
                <p className="text-sm text-[var(--muted)]">No notifications yet</p>
              </div>
            ) : notifications.map(n => {
              const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.NEW_ORDER
              const Icon = cfg.icon
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--background)] ${!n.isRead ? "bg-blue-50/50 dark:bg-blue-500/5" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.color}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-tight ${!n.isRead ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{n.title}</p>
                      <span className="text-[10px] text-[var(--muted)] shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                  </div>
                  {!n.isRead && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0 mt-2" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
