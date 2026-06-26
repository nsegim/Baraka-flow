import { getRequestConfig } from "next-intl/server"
import { cookies } from "next/headers"
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from "./config"

export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE }
export type { Locale } from "./config"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get(LOCALE_COOKIE)?.value ?? DEFAULT_LOCALE
  const locale = (LOCALES as readonly string[]).includes(raw)
    ? (raw as (typeof LOCALES)[number])
    : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
