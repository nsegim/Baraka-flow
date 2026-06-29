import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { CreateAttributeTemplateSchema } from "@/lib/validators"
import { serialize } from "@/lib/serialize"
import { createAuditLog } from "@/lib/audit"
import { getIp } from "@/lib/rate-limit"
import { requireBranchContext, isBranchContext } from "@/lib/branch-auth"

// GET /api/attribute-templates
// Returns active attribute templates for this business.
// ?categoryId=xxx   — filter by category (returns both category-specific and global templates)
// ?all=true         — include inactive templates (OWNER only)
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    const { searchParams } = request.nextUrl
    const categoryId   = searchParams.get("categoryId")
    const includeAll   = searchParams.get("all") === "true"

    // Only OWNERs may see inactive templates
    if (includeAll && ctx.session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Only the account owner can view inactive templates" }, { status: 403 })
    }

    const templates = await prisma.attributeTemplate.findMany({
      where: {
        businessId: ctx.session.user.businessId,
        isActive:   includeAll ? undefined : true,
        // When categoryId is given: return both category-scoped AND global (null) templates
        ...(categoryId
          ? { OR: [{ categoryId }, { categoryId: null }] }
          : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })

    return NextResponse.json(serialize(templates))
  } catch (error) {
    console.error("GET /api/attribute-templates error:", error)
    return NextResponse.json({ error: "Failed to fetch attribute templates" }, { status: 500 })
  }
}

// POST /api/attribute-templates — OWNER and MANAGER only
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireBranchContext(request)
    if (!isBranchContext(ctx)) return ctx

    if (!["OWNER", "MANAGER"].includes(ctx.session.user.role)) {
      return NextResponse.json({ error: "You do not have permission to create attribute templates" }, { status: 403 })
    }

    const body   = await request.json()
    const parsed = CreateAttributeTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { name, key, type, options, unit, isRequired, sortOrder, categoryId } = parsed.data

    // Guard: validate categoryId belongs to this business
    if (categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: categoryId, businessId: ctx.session.user.businessId },
      })
      if (!cat) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 })
      }
    }

    // Guard: SELECT type must have at least 2 options
    if (type === "SELECT" && (!options || options.length < 2)) {
      return NextResponse.json({ error: "SELECT type requires at least 2 options" }, { status: 400 })
    }

    // Guard: uniqueness check (PostgreSQL COALESCE unique index handles this at DB level,
    // but we return a friendly message here)
    const existing = await prisma.attributeTemplate.findFirst({
      where: {
        businessId: ctx.session.user.businessId,
        key,
        categoryId: categoryId ?? null,
      },
    })
    if (existing) {
      const scope = categoryId ? "this category" : "this business (globally)"
      return NextResponse.json(
        { error: `An attribute with key "${key}" already exists for ${scope}` },
        { status: 409 },
      )
    }

    const template = await prisma.attributeTemplate.create({
      data: {
        name,
        key,
        type,
        ...(options && options.length > 0 ? { options: options as object } : {}),
        unit:       unit       ?? null,
        isRequired: isRequired ?? false,
        sortOrder:  sortOrder  ?? 0,
        businessId: ctx.session.user.businessId,
        categoryId: categoryId ?? null,
      },
      include: { category: { select: { id: true, name: true } } },
    })

    createAuditLog({
      businessId: ctx.session.user.businessId,
      userId:     ctx.session.user.id,
      action:     "ATTRIBUTE_TEMPLATE_CREATED",
      entityType: "AttributeTemplate",
      entityId:   template.id,
      metadata:   { name: template.name, key: template.key, type: template.type, categoryId },
      ipAddress:  getIp(request),
    })

    return NextResponse.json(serialize(template), { status: 201 })
  } catch (error) {
    console.error("POST /api/attribute-templates error:", error)
    return NextResponse.json({ error: "Failed to create attribute template" }, { status: 500 })
  }
}
