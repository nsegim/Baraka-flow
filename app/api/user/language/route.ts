import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LOCALES } from "@/i18n/request"
import { z } from "zod"

const Schema = z.object({
  language:         z.enum(["en", "fr", "rw"]).nullable(), // null = clear user override
  updateBusiness:   z.boolean().optional().default(false),  // OWNER: also update business default
})

// PATCH /api/user/language
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body   = await request.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { language, updateBusiness } = parsed.data

    // Validate locale if provided
    if (language && !(LOCALES as readonly string[]).includes(language)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 })
    }

    // Update user's personal language preference
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { language: language ?? null },
    })

    // OWNER can also update the tenant-wide business default
    if (updateBusiness && session.user.role === "OWNER" && language) {
      await prisma.business.update({
        where: { id: session.user.businessId },
        data:  { language },
      })
    }

    return NextResponse.json({ language, updated: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to update language" }, { status: 500 })
  }
}
