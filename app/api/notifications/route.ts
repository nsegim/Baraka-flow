import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serialize } from "@/lib/serialize"

// GET /api/notifications — last 30 for this business + unread count
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const businessId = session.user.businessId

    const [notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where:   { businessId },
        orderBy: { createdAt: "desc" },
        take:    30,
      }),
      prisma.notification.count({
        where: { businessId, isRead: false },
      }),
    ])

    return NextResponse.json(serialize({ notifications, unreadCount }))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}

// PATCH /api/notifications — mark ALL as read
export async function PATCH(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await prisma.notification.updateMany({
      where: { businessId: session.user.businessId, isRead: false },
      data:  { isRead: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
  }
}
