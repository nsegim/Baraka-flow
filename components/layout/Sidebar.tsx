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
  Users,
  ClipboardList,
  Receipt,
  AlertTriangle,
  UserCog,
  X,
} from "lucide-react"

const navItems = [
  { label: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard },
  { label: "Inventory",       href: "/inventory",       icon: Package         },
  { label: "Stock Alerts",    href: "/stock-alerts",    icon: AlertTriangle   },
  { label: "Orders",          href: "/orders",          icon: ShoppingCart    },
  { label: "Customers",       href: "/customers",       icon: Users           },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList   },
  { label: "Expenses",        href: "/expenses",        icon: Receipt         },
  { label: "Suppliers",       href: "/suppliers",       icon: Truck           },
  { label: "Reports",         href: "/reports",         icon: BarChart3       },
  { label: "Staff",           href: "/staff",           icon: UserCog         },
  { label: "Settings",        href: "/settings",        icon: Settings        },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={`
      w-64 min-h-screen flex flex-col
      border-r border-baraka-primary/20 bg-baraka-dark
      fixed md:static inset-y-0 left-0 z-50
      transition-transform duration-300 ease-in-out
      ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
    `}>
      {/* ── LOGO ── */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="BarakaFlow Logo"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight">
              Baraka<span className="text-baraka-sage">Flow</span>
            </h1>
            <p className="text-xs text-baraka-cream/70">Inventory Management</p>
          </div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-baraka-sage hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
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
              onClick={onClose}
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