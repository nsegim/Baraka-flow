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

interface SearchCustomer {
  id:    string
  name:  string
  phone: string | null
  email: string | null
}

interface SearchSupplier {
  id:      string
  name:    string
  country: string | null
}

interface SearchResults {
  products:  SearchProduct[]
  orders:    SearchOrder[]
  customers: SearchCustomer[]
  suppliers: SearchSupplier[]
}

const EMPTY: SearchResults = { products: [], orders: [], customers: [], suppliers: [] }

export function useSearch() {
  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<SearchResults>(EMPTY)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen,    setIsOpen]    = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults(EMPTY)
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

  useEffect(() => {
    const timer = setTimeout(() => { search(query) }, 300)
    return () => clearTimeout(timer)
  }, [query, search])

  function clearSearch() {
    setQuery("")
    setResults(EMPTY)
    setIsOpen(false)
  }

  return { query, setQuery, results, isLoading, isOpen, setIsOpen, clearSearch }
}
