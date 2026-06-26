"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Globe, Check } from "lucide-react"
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/config"

const FLAG: Record<Locale, string> = { en: "🇬🇧", fr: "🇫🇷", rw: "🇷🇼" }
const LABEL: Record<Locale, string> = { en: "English", fr: "Français", rw: "Kinyarwanda" }

function getCookieLocale(): Locale {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  const raw   = match ? decodeURIComponent(match[1]) : "en"
  return (LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : "en"
}

export default function LanguageSwitcher() {
  const t          = useTranslations("settings")
  const [open, setOpen]       = useState(false)
  const [current, setCurrent] = useState<Locale>(() => getCookieLocale())
  const [saving, setSaving]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  async function selectLocale(locale: Locale) {
    if (locale === current || saving) return
    setSaving(true)
    setOpen(false)

    // 1. Persist in DB (fire and forget — cookie update is instant)
    fetch("/api/user/language", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ language: locale }),
    }).catch(() => {})

    // 2. Set cookie so next-intl picks it up on reload
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${60 * 60 * 24 * 365}`

    // 3. Reload so all server translations re-render with the new locale
    window.location.reload()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] hover:border-baraka-primary/50 transition-colors"
        aria-label="Switch language"
      >
        <Globe size={14} className="text-baraka-sage" />
        <span className="hidden md:inline font-medium">{FLAG[current]}</span>
        <span className="hidden lg:inline text-xs text-baraka-sage">{LABEL[current]}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-44 bg-[var(--card)] rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-xs font-semibold text-baraka-sage uppercase tracking-wide">
              {t("language")}
            </p>
          </div>
          {LOCALES.map(locale => (
            <button
              key={locale}
              onClick={() => selectLocale(locale)}
              disabled={saving}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--background)] ${
                current === locale ? "text-baraka-primary font-semibold" : "text-[var(--foreground)]"
              }`}
            >
              <span>{FLAG[locale]}</span>
              <span>{LABEL[locale]}</span>
              {current === locale && <Check size={13} className="ml-auto text-baraka-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
