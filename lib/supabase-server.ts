import { createClient } from "@supabase/supabase-js"

const supabaseUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service-role client — only used in API routes (server-side).
// Never expose the service role key to the browser.
export function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

export const STORAGE_BUCKET = "product-images"
