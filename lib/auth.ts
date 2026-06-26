import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge:   30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    // ── Tenant user login ─────────────────────────────────────────────────────
    Credentials({
      id: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where:   { email: credentials.email as string },
          include: {
            business:          true,
            branchAssignments: { include: { branch: true }, take: 1 },
          },
        })

        if (!user)                                return null
        if (!user.isActive)                       return null
        if (user.business.status === "SUSPENDED") return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password,
        )
        if (!passwordMatch) return null

        // OWNER has null branchId — they have cross-branch access
        // MANAGER/STAFF get the branchId from their first BranchUser assignment
        const branchId = user.role === "OWNER"
          ? null
          : (user.branchAssignments[0]?.branchId ?? null)

        // Language resolution: user preference > business default > "en"
        const businessLanguage = user.business.language ?? "en"
        const language         = user.language ?? businessLanguage

        return {
          id:               user.id,
          name:             user.name,
          email:            user.email,
          role:             user.role,
          businessId:       user.businessId,
          businessName:     user.business.name,
          branchId,
          language,
          businessLanguage,
          isPlatformUser:   false,
          platformRole:     null,
        }
      },
    }),

    // ── Platform user login ───────────────────────────────────────────────────
    Credentials({
      id: "platform",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const pu = await prisma.platformUser.findUnique({
          where: { email: credentials.email as string },
        })

        if (!pu || !pu.isActive) return null

        const match = await bcrypt.compare(
          credentials.password as string,
          pu.password,
        )
        if (!match) return null

        return {
          id:               pu.id,
          name:             pu.name,
          email:            pu.email,
          role:             "",     // not applicable for platform users
          businessId:       "",
          businessName:     "",
          branchId:         null,
          language:         "en",
          businessLanguage: "en",
          isPlatformUser:   true,
          platformRole:     pu.role as string,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string; role: string; businessId: string
          businessName: string; branchId: string | null
          language: string; businessLanguage: string
          isPlatformUser: boolean; platformRole: string | null
        }
        token.id               = u.id
        token.role             = u.role
        token.businessId       = u.businessId
        token.businessName     = u.businessName
        token.branchId         = u.branchId
        token.language         = u.language
        token.businessLanguage = u.businessLanguage
        token.isPlatformUser   = u.isPlatformUser
        token.platformRole     = u.platformRole
      }
      return token
    },

    async session({ session, token }) {
      // ── Platform user session ───────────────────────────────────────────────
      if (token?.isPlatformUser) {
        try {
          const pu = await prisma.platformUser.findUnique({
            where:  { id: token.id as string },
            select: { isActive: true, role: true },
          })
          if (!pu || !pu.isActive) return null as never
          token.platformRole = pu.role
        } catch {
          // DB unreachable — fail open, don't lock out on infra blip
        }

        session.user.id               = token.id as string
        session.user.name             = (token.name  as string) ?? ""
        session.user.email            = (token.email as string) ?? ""
        session.user.role             = ""
        session.user.businessId       = ""
        session.user.businessName     = ""
        session.user.branchId         = null
        session.user.language         = "en"
        session.user.businessLanguage = "en"
        session.user.isPlatformUser   = true
        session.user.platformRole     = (token.platformRole as string) ?? "SUPPORT"
        return session
      }

      // ── Tenant user session ─────────────────────────────────────────────────
      // Runs on every auth() call — re-validates against DB so deactivated users
      // and suspended businesses lose access without waiting for token expiry.
      if (token?.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: {
              isActive:          true,
              role:              true,
              language:          true,
              business:          { select: { status: true, language: true } },
              branchAssignments: { include: { branch: true }, take: 1 },
            },
          })
          if (!dbUser || !dbUser.isActive || dbUser.business.status === "SUSPENDED") {
            return null as never
          }
          // Keep branchId fresh — if assignment changes, it reflects on next session check
          if (dbUser.role !== "OWNER") {
            token.branchId = dbUser.branchAssignments[0]?.branchId ?? null
          }
          // Keep language fresh — reflects immediately after user changes preference
          const businessLanguage     = dbUser.business.language ?? "en"
          token.businessLanguage     = businessLanguage
          token.language             = dbUser.language ?? businessLanguage
        } catch {
          // DB unreachable — fail open
        }
      }

      if (token) {
        session.user.id               = token.id               as string
        session.user.role             = token.role             as string
        session.user.businessId       = token.businessId       as string
        session.user.businessName     = token.businessName     as string
        session.user.branchId         = (token.branchId        as string | null) ?? null
        session.user.language         = (token.language        as string) ?? "en"
        session.user.businessLanguage = (token.businessLanguage as string) ?? "en"
        session.user.isPlatformUser   = false
        session.user.platformRole     = null
      }
      return session
    },
  },
})
