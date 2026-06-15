import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    // 1. Get data from request body
    const body = await request.json()
    const { name, email, password, businessName } = body

    // 2. Validate all fields are present
    if (!name || !email || !password || !businessName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // 3. Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    // 4. Hash the password
    // 12 = "salt rounds" — higher = more secure but slower
    // 12 is the industry standard balance
    const hashedPassword = await bcrypt.hash(password, 12)

    // 5. Create business and user together in one transaction
    // A transaction means: do BOTH or do NEITHER
    // If creating the user fails, the business is also rolled back
    // Your database never ends up in a half-created state
    const result = await prisma.$transaction(async (tx) => {
      // Create the business first
      const business = await tx.business.create({
        data: {
          name:  businessName,
          email: email,
        }
      })

      // Then create the user linked to that business
      const user = await tx.user.create({
        data: {
          name,
          email,
          password:   hashedPassword,
          role:       "OWNER",      // first user is always the owner
          businessId: business.id,
        }
      })

      return { business, user }
    })

    // 6. Return success — never return the password
    return NextResponse.json({
      message: "Account created successfully",
      userId:  result.user.id,
    })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}