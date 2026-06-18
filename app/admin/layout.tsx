import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/admin-auth"
import AdminSidebar from "@/components/admin/AdminSidebar"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session || !isSuperAdmin(session.user.email)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            SUPER ADMIN
          </span>
          <span className="text-sm text-gray-400">
            Signed in as <span className="text-white font-medium">{session.user.email}</span>
          </span>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
