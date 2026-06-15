import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Where to send unauthenticated users
  pages: {
    signIn: "/login",
  },

  // How long sessions last
  session: {
    strategy: "jwt",    // JWT = JSON Web Token
                        // A secure token stored in browser cookie
                        // Contains user info — no database lookup needed per request
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },

  providers: [
    Credentials({
      // What fields the login form sends
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      // This runs when user submits login form
      async authorize(credentials) {
        // 1. Validate that both fields were provided
        if (!credentials?.email || !credentials?.password) {
          return null  // null = login failed
        }

        // 2. Find user in database by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            business: true  // also fetch their business info
          }
        })

        // 3. If no user found with that email
        if (!user) return null

        // 4. Compare submitted password against stored hash
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        // 5. If password wrong
        if (!passwordMatch) return null

        // 6. Login successful — return user data
        // This gets stored in the JWT token
        return {
          id:           user.id,
          name:         user.name,
          email:        user.email,
          role:         user.role,
          businessId:   user.businessId,
          businessName: user.business.name,
        }
      },
    }),
  ],

  callbacks: {
    // This runs when JWT token is created or updated
    // We add extra user info to the token here
    async jwt({ token, user }) {
      if (user) {
        const u = user as any
        token.id           = u.id
        token.role         = u.role
        token.businessId   = u.businessId
        token.businessName = u.businessName
      }
      return token
    },

    // This runs when session is accessed
    // We copy token info into the session object
    async session({ session, token }) {
      if (token) {
        session.user.id           = token.id as string
        session.user.role         = token.role as string
        session.user.businessId   = token.businessId as string
        session.user.businessName = token.businessName as string
      }
      return session
    },
  },
})