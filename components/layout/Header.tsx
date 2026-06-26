"use client"

import { Sun, Moon, LogOut, Menu, ChevronDown, GitBranch } from "lucide-react"
import NotificationBell  from "@/components/layout/NotificationBell"
import LanguageSwitcher  from "@/components/layout/LanguageSwitcher"
import { Button }        from "@/components/ui/button"
import { useTheme }      from "next-themes"
import { useEffect, useState, useRef, useCallback } from "react"
import { signOut }       from "next-auth/react"
import { useSession }    from "next-auth/react"
import { useTranslations } from "next-intl"
import SearchBar         from "@/components/layout/SearchBar"

interface Branch {
  id:   string
  name: string
  code: string
}

const BRANCH_COOKIE = "bf-branch-id"

function getCookieBranch(): string {
  if (typeof document === "undefined") return "all"
  const match = document.cookie.match(new RegExp(`(?:^|; )${BRANCH_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : "all"
}

function setCookieBranch(value: string) {
  document.cookie = `${BRANCH_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`
}

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme }     = useTheme()
  const { data: session }       = useSession()
  const t                       = useTranslations("header")
  const tCommon                 = useTranslations("common")
  const [showDropdown, setShowDropdown] = useState(false)
  const [showBranches, setShowBranches] = useState(false)
  const [branches,     setBranches]     = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>(() => getCookieBranch())
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const branchRef    = useRef<HTMLDivElement>(null)

  const isOwner = session?.user?.role === "OWNER"

  // Fetch branches for owner
  useEffect(() => {
    if (!isOwner) return
    fetch("/api/branches")
      .then(r => r.ok ? r.json() : [])
      .then((data: Branch[]) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [isOwner])

  const selectBranch = useCallback((id: string) => {
    setSelectedBranch(id)
    setCookieBranch(id)
    setShowBranches(false)
    window.dispatchEvent(new CustomEvent("branchChanged", { detail: id }))
    window.location.reload()
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setShowBranches(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  function getInitials(name: string) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const userName     = session?.user?.name        || "User"
  const businessName = session?.user?.businessName || ""

  const activeBranch = selectedBranch === "all"
    ? null
    : branches.find(b => b.id === selectedBranch)

  const branchLabel = activeBranch
    ? `[${activeBranch.code}] ${activeBranch.name}`
    : t("allBranches")

  return (
    <header className="h-16 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-6 shadow-sm transition-colors duration-300">

      {/* LEFT: Hamburger + Search */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-[var(--background)] text-[var(--foreground)] transition-colors"
        >
          <Menu size={20} />
        </button>
        <SearchBar />
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">

        {/* Branch selector — Owner only */}
        {isOwner && (
          <div className="relative" ref={branchRef}>
            <button
              onClick={() => setShowBranches(v => !v)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] hover:border-baraka-primary/50 transition-colors"
            >
              <GitBranch size={14} className="text-baraka-sage" />
              <span className="max-w-[160px] truncate">{branchLabel}</span>
              <ChevronDown size={14} className="text-baraka-sage" />
            </button>

            {showBranches && (
              <div className="absolute right-0 top-10 z-50 w-60 bg-[var(--card)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-baraka-sage uppercase tracking-wide">
                    {t("switchBranch")}
                  </p>
                </div>
                <button
                  onClick={() => selectBranch("all")}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--background)] ${selectedBranch === "all" ? "text-baraka-primary font-semibold" : "text-[var(--foreground)]"}`}
                >
                  {t("allBranchesConsolidated")}
                </button>
                {branches.map(b => (
                  <button
                    key={b.id}
                    onClick={() => selectBranch(b.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[var(--background)] ${selectedBranch === b.id ? "text-baraka-primary font-semibold" : "text-[var(--foreground)]"}`}
                  >
                    <span className="text-xs text-baraka-sage font-mono mr-2">[{b.code}]</span>
                    {b.name}
                  </button>
                ))}
                {branches.length === 0 && (
                  <p className="px-4 py-3 text-xs text-baraka-sage">{t("noBranches")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Branch label for MANAGER/STAFF — static */}
        {!isOwner && session?.user?.branchId && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-baraka-primary/10 border border-baraka-primary/20">
            <GitBranch size={13} className="text-baraka-primary" />
            <span className="text-xs font-medium text-baraka-primary">{businessName}</span>
          </div>
        )}

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Dark/Light toggle */}
        <Button
          suppressHydrationWarning
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="hover:bg-[var(--background)]"
        >
          {theme === "dark"
            ? <Sun  size={18} className="text-baraka-sage" />
            : <Moon size={18} className="text-baraka-dark" />
          }
        </Button>

        <NotificationBell />

        <div className="w-px h-8 bg-[var(--border)]" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 bg-baraka-primary rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">{getInitials(userName)}</span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-[var(--foreground)]">{userName}</p>
              <p className="text-xs text-baraka-sage">{businessName || "Admin"}</p>
            </div>
          </div>

          {showDropdown && (
            <div className="absolute right-0 top-12 z-50 w-56 bg-[var(--card)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--foreground)]">{userName}</p>
                <p className="text-xs text-baraka-sage mt-0.5 truncate">{session?.user?.email}</p>
                {businessName && <p className="text-xs text-baraka-primary mt-0.5">{businessName}</p>}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                {tCommon("signOut")}
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
