"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Building2, Users, LogOut, ShieldCheck, HeadphonesIcon, Activity, CrownIcon } from "lucide-react"
import { signOut } from "next-auth/react"

const navItems = [
  { label: "Overview",       href: "/admin",                icon: LayoutDashboard  },
  { label: "Businesses",     href: "/admin/businesses",     icon: Building2        },
  { label: "Plans",          href: "/admin/plans",          icon: CrownIcon        },
  { label: "Users",          href: "/admin/users",          icon: Users            },
  { label: "Support",        href: "/admin/support",        icon: HeadphonesIcon   },
  { label: "Platform Logs",  href: "/admin/platform-logs",  icon: Activity         },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen flex flex-col bg-gray-900 border-r border-gray-800">
      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <ShieldCheck size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">BarakaFlow</p>
            <p className="text-xs text-gray-500">Control Room</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/20"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }
              `}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-800 space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LayoutDashboard size={17} />
          Back to App
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin-login" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
