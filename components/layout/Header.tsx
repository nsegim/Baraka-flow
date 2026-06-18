"use client"

import { Bell, Search, Sun, Moon, LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useEffect, useState, useRef } from "react"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import SearchBar from "@/components/layout/SearchBar"

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme()
  const { data: session }   = useSession()
  const [mounted,      setMounted]      = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Get initials from name
  // "Moussa Nsengimana" → "MN"
  function getInitials(name: string) {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const userName     = session?.user?.name     || "User"
  const businessName = session?.user?.businessName || ""

  return (
    <header className="
      h-16 bg-[var(--card)]
      border-b border-[var(--border)]
      flex items-center justify-between
      px-6 shadow-sm transition-colors duration-300
    ">

      {/* ── LEFT: Hamburger (mobile) + Search ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-[var(--background)] text-[var(--foreground)] transition-colors"
        >
          <Menu size={20} />
        </button>
        <SearchBar />
      </div>

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-3">

        {/* Dark/Light toggle */}
        {mounted && (
          <Button
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
        )}

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative hover:bg-[var(--background)]"
        >
          <Bell size={18} className="text-[var(--foreground)]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        {/* Divider */}
        <div className="w-px h-8 bg-[var(--border)]" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            className="
              flex items-center gap-2
              cursor-pointer hover:opacity-80
              transition-opacity
            "
          >
            <div className="
              w-9 h-9 bg-baraka-primary rounded-full
              flex items-center justify-center shadow-sm
            ">
              <span className="text-white text-sm font-bold">
                {getInitials(userName)}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {userName}
              </p>
              <p className="text-xs text-baraka-sage">
                {businessName || "Admin"}
              </p>
            </div>
          </div>

          {/* Dropdown menu */}
          {showDropdown && (
            <div className="
              absolute right-0 top-12 z-50
              w-56 bg-[var(--card)]
              rounded-xl shadow-lg
              border border-[var(--border)]
              overflow-hidden
            ">
              {/* User info */}
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {userName}
                </p>
                <p className="text-xs text-baraka-sage mt-0.5 truncate">
                  {session?.user?.email}
                </p>
                {businessName && (
                  <p className="text-xs text-baraka-primary mt-0.5">
                    {businessName}
                  </p>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="
                  w-full flex items-center gap-3
                  px-4 py-3 text-sm
                  text-red-500 hover:bg-red-50
                  transition-colors
                "
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}