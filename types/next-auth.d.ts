import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id:               string
      name:             string
      email:            string
      role:             string           // OWNER | MANAGER | STAFF (empty string for platform users)
      businessId:       string           // empty string for platform users
      businessName:     string           // empty string for platform users
      branchId:         string | null    // null for OWNER and platform users
      language:         string           // resolved locale: en | fr | rw
      businessLanguage: string           // tenant default locale
      isPlatformUser:   boolean          // true when authenticated via the platform provider
      platformRole:     string | null    // SUPER_ADMIN | SUPPORT (null for tenant users)
    }
  }
}
