// This single file handles ALL auth routes automatically:
// POST /api/auth/signin
// POST /api/auth/signout
// GET  /api/auth/session
// GET  /api/auth/csrf
// ...and more

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers