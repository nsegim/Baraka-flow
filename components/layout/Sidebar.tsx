"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
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
  ShieldCheck,
  GitBranch,
  ArrowLeftRight,
  CrownIcon,
  X,
} from "lucide-react"

interface NavItem {
  key:       string
  href:      string
  icon:      React.ElementType
  ownerOnly: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard",      href: "/dashboard",        icon: LayoutDashboard, ownerOnly: false },
  { key: "inventory",      href: "/inventory",        icon: Package,         ownerOnly: false },
  { key: "stockAlerts",    href: "/stock-alerts",     icon: AlertTriangle,   ownerOnly: false },
  { key: "orders",         href: "/orders",           icon: ShoppingCart,    ownerOnly: false },
  { key: "customers",      href: "/customers",        icon: Users,           ownerOnly: false },
  { key: "purchaseOrders", href: "/purchase-orders",  icon: ClipboardList,   ownerOnly: false },
  { key: "expenses",       href: "/expenses",         icon: Receipt,         ownerOnly: false },
  { key: "suppliers",      href: "/suppliers",        icon: Truck,           ownerOnly: false },
  { key: "reports",        href: "/reports",          icon: BarChart3,       ownerOnly: false },
  { key: "branches",       href: "/branches",         icon: GitBranch,       ownerOnly: true  },
  { key: "stockTransfers", href: "/stock-transfers",  icon: ArrowLeftRight,  ownerOnly: false },
  { key: "staff",          href: "/staff",            icon: UserCog,         ownerOnly: true  },
  { key: "auditLogs",      href: "/audit-logs",       icon: ShieldCheck,     ownerOnly: false },
  { key: "billing",        href: "/billing",           icon: CrownIcon,       ownerOnly: true  },
  { key: "settings",       href: "/settings",         icon: Settings,        ownerOnly: false },
]

interface SidebarProps {
  isOpen?:  boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname              = usePathname()
  const { data: session }     = useSession()
  const t                     = useTranslations("nav")
  const isOwner               = session?.user?.role === "OWNER"

  const visibleItems = NAV_ITEMS.filter(item => !item.ownerOnly || isOwner)

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
              {t("appName").split("Flow")[0]}
              <span className="text-baraka-sage">Flow</span>
            </h1>
            <p className="text-xs text-baraka-cream/70">{t("appTagline")}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-baraka-sage hover:bg-white/10 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── NAV ── */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon     = item.icon

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
              {t(item.key as Parameters<typeof t>[0])}
            </Link>
          )
        })}
      </nav>

      {/* ── BOTTOM ── */}
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-baraka-sage text-center">{t("version")}</p>
      </div>
    </aside>
  )
}
