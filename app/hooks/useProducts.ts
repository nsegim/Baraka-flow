"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface AttributeTemplateRef {
  id:        string
  name:      string
  key:       string
  type:      string
  unit:      string | null
  sortOrder: number
}

export interface AttributeValue {
  id:                  string
  value:               string
  attributeTemplateId: string
  attributeTemplate:   AttributeTemplateRef
}

export interface Product {
  id:          string
  name:        string
  description: string | null
  sku:         string | null
  price:       number
  costPrice:   number | null
  stock:       number
  minStock:    number
  unit:        string
  origin:      string | null
  imageUrl:    string | null
  createdAt:   string
  categoryId:  string | null
  supplierId:  string | null
  attributes:  Record<string, unknown> | null
  category:    { id: string; name: string } | null
  supplier:    { id: string; name: string } | null
  attributeValues: AttributeValue[]
}

// Input format for create/update — attributeValues uses templateId (not the stored id)
export type AttributeInput = { templateId: string; value: string }
export type ProductInput   = Omit<Partial<Product>, "attributeValues"> & {
  attributeValues?: AttributeInput[]
}

export interface ProductMeta {
  total: number
  page:  number
  limit: number
  pages: number
}

export interface ProductFilters {
  search?:     string
  categoryId?: string
  supplierId?: string
}

export function useProducts(initialPage = 1, filters: ProductFilters = {}) {
  const [products,  setProducts]  = useState<Product[]>([])
  const [meta,      setMeta]      = useState<ProductMeta>({ total: 0, page: 1, limit: 50, pages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // Two-part trigger: page + key.
  // Changing `page` navigates. Incrementing `key` forces a re-fetch of the same page.
  const [page, setPage] = useState(initialPage)
  const [key,  setKey]  = useState(0)

  // Stable signature for filters so we can detect changes without deep equality
  const filterSig = `${filters.search ?? ""}|${filters.categoryId ?? ""}|${filters.supplierId ?? ""}`
  const prevFilterSig = useRef(filterSig)

  // When filters change reset to page 1 and force a re-fetch
  useEffect(() => {
    if (filterSig === prevFilterSig.current) return
    prevFilterSig.current = filterSig
    setPage(1)
    setKey(k => k + 1)
  }, [filterSig])

  useEffect(() => {
    let cancelled = false

    const sp = new URLSearchParams({ page: String(page), limit: "50" })
    if (filters.search)     sp.set("search",     filters.search)
    if (filters.categoryId) sp.set("categoryId", filters.categoryId)
    if (filters.supplierId) sp.set("supplierId", filters.supplierId)

    fetch(`/api/products?${sp}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch products")
        return res.json()
      })
      .then(json => {
        if (cancelled) return
        setProducts(json.data)
        setMeta(json.meta)
        setError(null)
        setIsLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError("Could not load products. Please try again.")
        setIsLoading(false)
        console.error(err)
      })

    return () => { cancelled = true }
  // Filter values are captured via closure. Filter changes are handled by the effect above,
  // which resets page to 1 and increments key — triggering this effect indirectly.
  // Adding filter values here would cause a double-fetch on every filter change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, key])

  // Navigate to a different page
  const goToPage = useCallback((newPage: number) => {
    setIsLoading(true)
    setError(null)
    setPage(newPage)
  }, [])

  // Force re-fetch of the current page (e.g. after an add/delete)
  const fetchProducts = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setKey(k => k + 1)
  }, [])

  const addProduct = async (productData: ProductInput) => {
    const response = await fetch("/api/products", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(productData),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || "Failed to create product")
    }

    const newProduct = await response.json()
    // Go back to page 1 so the new product appears at the top
    setIsLoading(true)
    setPage(1)
    setKey(k => k + 1)
    return newProduct
  }

  const updateProduct = async (id: string, productData: ProductInput) => {
    const response = await fetch(`/api/products/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(productData),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || "Failed to update product")
    }

    const updated = await response.json()
    setProducts(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }

  const deleteProduct = async (id: string) => {
    const previous = products
    setProducts(prev => prev.filter(p => p.id !== id))

    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" })
      if (!response.ok) {
        setProducts(previous)
        throw new Error("Failed to delete product")
      }
      setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }))
    } catch (err) {
      setProducts(previous)
      throw err
    }
  }

  return {
    products,
    meta,
    isLoading,
    error,
    fetchProducts,
    goToPage,
    addProduct,
    updateProduct,
    deleteProduct,
  }
}
