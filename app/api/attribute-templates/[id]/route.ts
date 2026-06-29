import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UpdateAttributeTemplateSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"

// PATCH /api/attribute-templates/[id] — OWNER and MANAGER only
// Supports updating name, type, options, unit, isRequired, sortOrder, isActive.
// key and categoryId are immutable after creation (changing them would break existing values).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to edit attribute templates" }, { status: 403 })
    }

    const { id } = await params
    const body   = await request.json()
    const parsed = UpdateAttributeTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const existing = await prisma.attributeTemplate.findFirst({
      where: { id, businessId: ctx.session.user.businessId },
    })
    if (!existing) {
      return NextResponse.json({ error: "Attribute template not found" }, { status: 404 })
    }

    const newType    = parsed.data.type    ?? existing.type
    const newOptions = parsed.data.options ?? (existing.options as string[] | null)

    // Validate SELECT type still has options when type changes to SELECT
    if (newType === "SELECT" && (!newOptions || newOptions.length < 2)) {
      return NextResponse.json({ error: "SELECT type requires at least 2 options" }, { status: 400 })
    }

    const updated = await prisma.attributeTemplate.update({
      where: { id },
      data: {
        name:       parsed.data.name       ?? existing.name,
        type:       newType,
        ...(newOptions && newOptions.length > 0 ? { options: newOptions as object } : {}),
        unit:       parsed.data.unit       !== undefined ? (parsed.data.unit ?? null)       : existing.unit,
        isRequired: parsed.data.isRequired !== undefined ? parsed.data.isRequired           : existing.isRequired,
        sortOrder:  parsed.data.sortOrder  !== undefined ? parsed.data.sortOrder            : existing.sortOrder,
        isActive:   parsed.data.isActive   !== undefined ? parsed.data.isActive             : existing.isActive,
      },
      include: { category: { select: { id: true, name: true } } },
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      userId:     ctx.session.user.id,
      action:     "ATTRIBUTE_TEMPLATE_UPDATED",
      entityType: "AttributeTemplate",
      entityId:   id,
      metadata:   { name: updated.name, key: updated.key, isActive: updated.isActive },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(updated))
  } catch (error) {
    console.error("PATCH /api/attribute-templates/[id] error:", error)
    return NextResponse.json({ error: "Failed to update attribute template" }, { status: 500 })
  }
}

// DELETE /api/attribute-templates/[id] — OWNER only (soft-delete via isActive = false)
// Hard delete is blocked if any ProductAttributeValue references this template.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (ctx.session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can delete attribute templates" }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.attributeTemplate.findFirst({
      where:  { id, businessId: ctx.session.user.businessId },
      select: { id: true, name: true, key: true, _count: { select: { attributeValues: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: "Attribute template not found" }, { status: 404 })
    }

    if (existing._count.attributeValues > 0) {
      // Soft-delete: deactivate instead of hard-delete to preserve historical data
      await prisma.attributeTemplate.update({
        where: { id },
        data:  { isActive: false },
      })
      return NextResponse.json({
        message: `Template deactivated (${existing._count.attributeValues} product value(s) preserved). New products will no longer see this attribute.`,
      })
    }

    // Hard-delete when no product values reference it
    await prisma.attributeTemplate.delete({ where: { id } })
    return NextResponse.json({ message: "Attribute template deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/attribute-templates/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete attribute template" }, { status: 500 })
  }
}
