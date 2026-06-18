import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PATCH /api/notifications/[id] — mark one notification as read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const notification = await prisma.notification.findFirst({
      where: { id, businessId: session.user.businessId },
    })
    if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.notification.update({
      where: { id },
      data:  { isRead: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
