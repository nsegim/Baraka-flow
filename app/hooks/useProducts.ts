"use client"

import { useState, useEffect, useCallback } from "react"

// Define the shape of a product as returned by our API
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
  createdAt:   string
  category: {
    id:   string
    name: string
  } | null
  supplier: {
    id:   string
    name: string
  } | null
}

export function useProducts() {
  const [products,  setProducts]  = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  // ── FETCH ALL PRODUCTS ──
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/products")

      if (!response.ok) {
        throw new Error("Failed to fetch products")
      }

      const data = await response.json()
      setProducts(data)

    } catch (err) {
      setError("Could not load products. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch products when hook is first used
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // ── ADD PRODUCT ──
  const addProduct = async (productData: Partial<Product>) => {
    const response = await fetch("/api/products", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(productData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create product")
    }

    const newProduct = await response.json()

    // Add new product to the top of the list immediately
    // without refetching everything
    setProducts(prev => [newProduct, ...prev])

    return newProduct
  }

  // ── UPDATE PRODUCT ──
  const updateProduct = async (id: string, productData: Partial<Product>) => {
    const response = await fetch(`/api/products/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(productData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update product")
    }

    const updatedProduct = await response.json()

    // Replace the old product in the list with the updated one
    setProducts(prev =>
      prev.map(p => p.id === id ? updatedProduct : p)
    )

    return updatedProduct
  }

  // ── DELETE PRODUCT ──
  const deleteProduct = async (id: string) => {
    // Optimistic update — remove from UI immediately
    const previousProducts = products
    setProducts(prev => prev.filter(p => p.id !== id))

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        // Server failed — put the product back
        setProducts(previousProducts)
        throw new Error("Failed to delete product")
      }

    } catch (err) {
      // Network failed — put the product back
      setProducts(previousProducts)
      throw err
    }
  }

  return {
    products,
    isLoading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
  }
}