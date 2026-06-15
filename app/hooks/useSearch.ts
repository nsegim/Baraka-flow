"use client"

import { useState, useEffect, useCallback } from "react"

interface SearchProduct {
  id:    string
  name:  string
  stock: number
  price: number
  sku:   string | null
}

interface SearchOrder {
  id:           string
  orderNumber:  string
  customerName: string
  totalAmount:  number
  status:       string
}

interface SearchResults {
  products: SearchProduct[]
  orders:   SearchOrder[]
}

export function useSearch() {
  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<SearchResults>({ products: [], orders: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen,    setIsOpen]    = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ products: [], orders: [] })
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
      setIsOpen(true)
    } catch {
      console.error("Search failed")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce — wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 300)

    // Cleanup — cancel the timer if user types again
    // before 300ms is up
    return () => clearTimeout(timer)
  }, [query, search])

  function clearSearch() {
    setQuery("")
    setResults({ products: [], orders: [] })
    setIsOpen(false)
  }

  return {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    clearSearch,
  }
}