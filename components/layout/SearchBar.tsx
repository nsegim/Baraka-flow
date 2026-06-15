"use client"

import { useRef, useEffect } from "react"
import { Search, Loader2, Package, ShoppingCart, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSearch } from "../../app/hooks/useSearch"

function formatRWF(amount: number) {
  return `RWF ${amount.toLocaleString()}`
}

export default function SearchBar() {
  const router      = useRouter()
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const {
    query, setQuery,
    results, isLoading,
    isOpen, setIsOpen,
    clearSearch,
  } = useSearch()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [setIsOpen])

  const hasResults =
    results.products.length > 0 ||
    results.orders.length > 0

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
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => hasResults && setIsOpen(true)}
          placeholder="Search products, orders..."
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
          bg-[var(--card)]
          rounded-xl shadow-xl
          border border-[var(--border)]
          overflow-hidden
          max-h-96 overflow-y-auto
        ">

          {/* No results */}
          {!hasResults && !isLoading && query.length >= 2 && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-[var(--muted)]">
                No results for "{query}"
              </p>
            </div>
          )}

          {/* Products results */}
          {results.products.length > 0 && (
            <div>
              <p className="
                px-4 py-2 text-xs font-semibold
                text-[var(--muted)] uppercase tracking-wide
                bg-[var(--background)]
                border-b border-[var(--border)]
              ">
                Products
              </p>
              {results.products.map(product => (
                <button
                  key={product.id}
                  onClick={() => {
                    router.push("/inventory")
                    clearSearch()
                  }}
                  className="
                    w-full flex items-center gap-3
                    px-4 py-3
                    hover:bg-[var(--background)]
                    transition-colors text-left
                    border-b border-[var(--border)]
                  "
                >
                  <div className="
                    w-8 h-8 rounded-lg
                    bg-blue-100 flex items-center justify-center
                    shrink-0
                  ">
                    <Package size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {product.stock} in stock
                      {product.sku && ` · ${product.sku}`}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[var(--muted)] shrink-0">
                    {formatRWF(product.price)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Orders results */}
          {results.orders.length > 0 && (
            <div>
              <p className="
                px-4 py-2 text-xs font-semibold
                text-[var(--muted)] uppercase tracking-wide
                bg-[var(--background)]
                border-b border-[var(--border)]
              ">
                Orders
              </p>
              {results.orders.map(order => (
                <button
                  key={order.id}
                  onClick={() => {
                    router.push("/orders")
                    clearSearch()
                  }}
                  className="
                    w-full flex items-center gap-3
                    px-4 py-3
                    hover:bg-[var(--background)]
                    transition-colors text-left
                    border-b border-[var(--border)]
                  "
                >
                  <div className="
                    w-8 h-8 rounded-lg
                    bg-baraka-sage/20
                    flex items-center justify-center
                    shrink-0
                  ">
                    <ShoppingCart size={14} className="text-baraka-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-[var(--muted)] truncate">
                      {order.customerName}
                    </p>
                  </div>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                    ${order.status === "DELIVERED"  ? "bg-emerald-100 text-emerald-700" : ""}
                    ${order.status === "PENDING"    ? "bg-yellow-100 text-yellow-700"  : ""}
                    ${order.status === "CANCELLED"  ? "bg-red-100 text-red-700"        : ""}
                    ${order.status === "CONFIRMED"  ? "bg-blue-100 text-blue-700"      : ""}
                  `}>
                    {order.status}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}