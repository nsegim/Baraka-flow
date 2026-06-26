"use client"

// Syncs the logged-in user's language preference (from session) to the bf-locale cookie.
// Runs once on mount — if the cookie is missing or stale, updates it and reloads.
// This handles: first-ever login, cross-device sessions, admin language changes.

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config"

function getCookieLocale(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default function LocaleSync() {
  const { data: session } = useSession()

  useEffect(() => {
    const sessionLocale = session?.user?.language
    if (!sessionLocale) return
    if (!(LOCALES as readonly string[]).includes(sessionLocale)) return

    const cookieLocale = getCookieLocale()

    if (cookieLocale !== sessionLocale) {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(sessionLocale as Locale)}; path=/; max-age=${60 * 60 * 24 * 365}`
      window.location.reload()
    }
  // Run only once after session is loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.language])

  return null
}
