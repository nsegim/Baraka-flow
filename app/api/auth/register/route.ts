import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { RegisterSchema } from "@/lib/validators"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { name, email, password, businessName } = parsed.data

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const { user } = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, email }
      })

      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password:   hashedPassword,
          role:       "OWNER",
          businessId: business.id,
        }
      })

      return { business, user: newUser }
    })

    return NextResponse.json({
      message: "Account created successfully",
      userId:  user.id,
    })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
