import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import DashboardShell from "@/components/layout/DashboardShell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Platform/admin users have no businessId — send them to the admin panel
  if (session.user.isPlatformUser || !session.user.businessId) {
    redirect("/admin")
  }

  // Check suspension on every dashboard request — catches users already logged in
  // when their business gets suspended by the super admin
  const business = await prisma.business.findUnique({
    where:  { id: session.user.businessId },
    select: { status: true, suspendedReason: true },
  })

  if (!business || business.status === "SUSPENDED") {
    redirect(`/suspended?reason=${encodeURIComponent(business?.suspendedReason ?? "")}`)
  }

  return <DashboardShell>{children}</DashboardShell>
}
