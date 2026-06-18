"use client"

import { useRef, useEffect } from "react"
import { Search, Loader2, Package, ShoppingCart, Users, Truck, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSearch } from "../../app/hooks/useSearch"

function formatRWF(amount: number) {
  return `RWF ${Number(amount).toLocaleString()}`
}

export default function SearchBar() {
  const router     = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const {
    query, setQuery,
    results, isLoading,
    isOpen, setIsOpen,
    clearSearch,
  } = useSearch()

  // Cmd/Ctrl+K focuses the search input from anywhere
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === "Escape") {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [setIsOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [setIsOpen])

  const hasResults =
    results.products.length  > 0 ||
    results.orders.length    > 0 ||
    results.customers.length > 0 ||
    results.suppliers.length > 0

  function navigate(path: string) {
    router.push(path)
    clearSearch()
  }

  return (
    <div ref={wrapperRef} className="relative w-72">

      {/* Search input */}
      <div className="
        flex items-center gap-2
        bg-[var(--background)] rounded-lg
        px-3 py-2
        border border-[var(--border)]
        focus-within:border-baraka-primary
        focus-within:ring-2 focus-within:ring-baraka-primary/20
        transition-all
      ">
        {isLoading
          ? <Loader2 size={16} className="text-baraka-sage animate-spin shrink-0" />
          : <Search  size={16} className="text-baraka-sage shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => hasResults && setIsOpen(true)}
          placeholder="Search… (⌘K)"
          className="
            bg-transparent text-sm outline-none w-full
            text-[var(--foreground)]
            placeholder:text-baraka-sage
          "
        />
        {query && (
          <button onClick={clearSearch}>
            <X size={14} className="text-baraka-sage hover:text-baraka-dark transition-colors" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="
          absolute top-11 left-0 right-0 z-50
          bg-[var(--card)] rounded-xl shadow-xl
          border border-[var(--border)]
          overflow-hidden max-h-[28rem] overflow-y-auto
        ">

          {/* Empty state */}
          {!hasResults && !isLoading && query.length >= 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-[var(--muted)]">No results for &quot;{query}&quot;</p>
            </div>
          )}

          {/* Products */}
          {results.products.length > 0 && (
            <section>
              <p className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide bg-[var(--background)] border-b border-[var(--border)]">
                Products
              </p>
              {results.products.map(p => (
                <button
                  key={p.id}
                  onClick={() => navigate("/inventory")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] transition-colors text-left border-b border-[var(--border)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{p.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {p.stock} in stock{p.sku ? ` · ${p.sku}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--muted)] shrink-0">
                    {formatRWF(p.price)}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* Orders */}
          {results.orders.length > 0 && (
            <section>
              <p className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide bg-[var(--background)] border-b border-[var(--border)]">
                Orders
              </p>
              {results.orders.map(o => (
                <button
                  key={o.id}
                  onClick={() => navigate("/orders")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] transition-colors text-left border-b border-[var(--border)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-baraka-sage/20 flex items-center justify-center shrink-0">
                    <ShoppingCart size={14} className="text-baraka-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">{o.orderNumber}</p>
                    <p className="text-xs text-[var(--muted)] truncate">{o.customerName}</p>
                  </div>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                    ${o.status === "DELIVERED" ? "bg-emerald-100 text-emerald-700" : ""}
                    ${o.status === "PENDING"   ? "bg-yellow-100 text-yellow-700"  : ""}
                    ${o.status === "CANCELLED" ? "bg-red-100 text-red-700"        : ""}
                    ${o.status === "CONFIRMED" ? "bg-blue-100 text-blue-700"      : ""}
                  `}>
                    {o.status}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* Customers */}
          {results.customers.length > 0 && (
            <section>
              <p className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide bg-[var(--background)] border-b border-[var(--border)]">
                Customers
              </p>
              {results.customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate("/customers")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] transition-colors text-left border-b border-[var(--border)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <Users size={14} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{c.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {c.phone ?? c.email ?? "No contact"}
                    </p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Suppliers */}
          {results.suppliers.length > 0 && (
            <section>
              <p className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide bg-[var(--background)] border-b border-[var(--border)]">
                Suppliers
              </p>
              {results.suppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate("/suppliers")}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--background)] transition-colors text-left border-b border-[var(--border)]"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <Truck size={14} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{s.name}</p>
                    <p className="text-xs text-[var(--muted)]">{s.country ?? "No country"}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

        </div>
      )}
    </div>
  )
}
