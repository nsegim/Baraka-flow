import bcrypt                              from "bcryptjs"
import { prisma }                           from "@/lib/prisma"
import { createAuditLog }                   from "@/lib/audit"
import { checkPlanLimit }                   from "@/lib/plan-limits"
import { checkSubscription }                from "@/lib/subscription"
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/permissions"

const USER_SELECT = {
  id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
} as const

export interface CreateStaffInput {
  name:     string
  email:    string
  password: string
  role:     "MANAGER" | "STAFF"
}

export interface UpdateUserInput {
  role?:     "OWNER" | "MANAGER" | "STAFF"
  isActive?: boolean
}

export class UserService {
  constructor(
    private readonly businessId: string,
    private readonly actorId:    string,
  ) {}

  async list() {
    return prisma.user.findMany({
      where:   { businessId: this.businessId },
      select:  USER_SELECT,
      orderBy: { createdAt: "asc" },
    })
  }

  async create(data: CreateStaffInput) {
    const subCheck = await checkSubscription(this.businessId)
    if (!subCheck.allowed) throw new ValidationError(subCheck.message)

    const limitCheck = await checkPlanLimit(this.businessId, "users")
    if (!limitCheck.allowed) throw new ValidationError(limitCheck.error!)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new ValidationError("A user with this email already exists")

    const hashed = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name:       data.name,
        email:      data.email,
        password:   hashed,
        role:       data.role,
        businessId: this.businessId,
      },
      select: USER_SELECT,
    })

    createAuditLog({
      businessId: this.businessId,
      userId:     this.actorId,
      action:     "USER_CREATED",
      entityType: "User",
      entityId:   user.id,
      metadata:   { name: user.name, email: user.email, role: user.role },
    })

    return user
  }

  async updateRole(targetId: string, role: "OWNER" | "MANAGER" | "STAFF") {
    if (targetId === this.actorId) {
      throw new ValidationError("You cannot change your own role")
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, businessId: this.businessId },
    })
    if (!target) throw new NotFoundError("User not found")
    if (target.role === "OWNER") throw new ForbiddenError("Cannot change the owner's role")

    const updated = await prisma.user.update({
      where:  { id: targetId },
      data:   { role },
      select: USER_SELECT,
    })

    createAuditLog({
      businessId: this.businessId,
      userId:     this.actorId,
      action:     "USER_ROLE_CHANGED",
      entityType: "User",
      entityId:   targetId,
      metadata:   { name: target.name, from: target.role, to: role },
    })

    return updated
  }

  async setActive(targetId: string, isActive: boolean) {
    if (targetId === this.actorId) {
      throw new ValidationError("You cannot change your own status")
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, businessId: this.businessId },
    })
    if (!target) throw new NotFoundError("User not found")

    const updated = await prisma.user.update({
      where:  { id: targetId },
      data:   { isActive },
      select: USER_SELECT,
    })

    if (!isActive) {
      createAuditLog({
        businessId: this.businessId,
        userId:     this.actorId,
        action:     "USER_DEACTIVATED",
        entityType: "User",
        entityId:   targetId,
        metadata:   { name: target.name, email: target.email },
      })
    }

    return updated
  }

  async delete(targetId: string) {
    if (targetId === this.actorId) {
      throw new ValidationError("You cannot delete your own account")
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, businessId: this.businessId },
    })
    if (!target) throw new NotFoundError("User not found")
    if (target.role === "OWNER") throw new ForbiddenError("Cannot delete the owner account")

    await prisma.user.delete({ where: { id: targetId } })

    createAuditLog({
      businessId: this.businessId,
      userId:     this.actorId,
      action:     "USER_DELETED",
      entityType: "User",
      entityId:   targetId,
      metadata:   { name: target.name, email: target.email, role: target.role },
    })
  }
}
