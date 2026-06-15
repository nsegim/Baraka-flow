// NextAuth doesn't know about our custom fields (role, businessId)
// This file tells TypeScript: "trust me, these fields exist"
// The .d.ts extension means "declaration file" — types only, no logic

import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id:           string
      name:         string
      email:        string
      role:         string
      businessId:   string
      businessName: string
    }
  }
}