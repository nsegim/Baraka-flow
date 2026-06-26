import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/admin-auth"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  const isPlatformAdmin = session?.user?.isPlatformUser === true
  const isLegacyAdmin   = isSuperAdmin(session?.user?.email)

  if (!session || (!isPlatformAdmin && !isLegacyAdmin)) {
    redirect("/admin-login")
  }

  const roleLabel = session.user.isPlatformUser
    ? (session.user.platformRole === "SUPER_ADMIN" ? "SUPER ADMIN" : "SUPPORT AGENT")
    : "SUPER ADMIN"

  const displayName = session.user.isPlatformUser
    ? session.user.name
    : session.user.email

  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            {roleLabel}
          </span>
          <span className="text-sm text-gray-400">
            Signed in as <span className="text-white font-medium">{displayName}</span>
          </span>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
