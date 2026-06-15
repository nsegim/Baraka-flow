"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
} from "lucide-react"

const navItems = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Inventory",  href: "/inventory",  icon: Package         },
  { label: "Orders",     href: "/orders",     icon: ShoppingCart    },
  { label: "Suppliers",  href: "/suppliers",  icon: Truck           },
  { label: "Reports",    href: "/reports",    icon: BarChart3       },
  { label: "Settings",   href: "/settings",   icon: Settings        },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="
      w-64
      min-h-screen
      flex flex-col
      border-r border-baraka-primary/20
      bg-baraka-dark

    ">
      {/* ── LOGO ── */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
         
          <Image
            src="/logo.png"
            alt="BarakaFlow Logo"
            width={56}
            height={56}
            className="rounded-lg"
          />
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight">
              Baraka<span className="text-baraka-sage">Flow</span>
            </h1>
            <p className="text-xs text-baraka-cream/70">
              Inventory Management
            </p>
          </div>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3
                px-3 py-2.5 rounded-lg
                text-sm font-medium
                transition-all duration-150
                ${isActive
                  ? "bg-baraka-primary text-white shadow-lg"
                  : "text-baraka-sage hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── BOTTOM ── */}
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-baraka-sage text-center">
          BarakaFlow v1.0.0
        </p>
      </div>
    </aside>
  )
}