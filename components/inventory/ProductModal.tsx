"use client"

import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Product } from "../../app/hooks/useProducts"

interface ProductModalProps {
  isOpen:   boolean
  onClose:  () => void
  onSave:   (data: Partial<Product>) => Promise<void>
  product?: Product | null  // if provided = edit mode, if null = add mode
}

// Reusable input component to avoid repeating styles
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-baraka-dark mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass = `
  w-full px-3 py-2 rounded-lg
  border border-baraka-sage/40
  bg-baraka-cream/50
  text-baraka-dark text-sm
  placeholder:text-baraka-sage
  outline-none
  focus:border-baraka-primary
  focus:ring-2 focus:ring-baraka-primary/20
  transition-colors
`

export default function ProductModal({
  isOpen,
  onClose,
  onSave,
  product,
}: ProductModalProps) {
  const isEditMode = !!product

  // Form state
  const [name,        setName]        = useState("")
  const [description, setDescription] = useState("")
  const [sku,         setSku]         = useState("")
  const [price,       setPrice]       = useState("")
  const [costPrice,   setCostPrice]   = useState("")
  const [stock,       setStock]       = useState("")
  const [minStock,    setMinStock]    = useState("5")
  const [unit,        setUnit]        = useState("piece")
  const [origin,      setOrigin]      = useState("")
  const [isLoading,   setIsLoading]   = useState(false)
  const [error,       setError]       = useState("")
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])
  const [categoryId, setCategoryId] = useState("")

  const [suppliers,  setSuppliers]  = useState<{id: string, name: string}[]>([])
  const [supplierId, setSupplierId] = useState("")


  // When editing — pre-fill form with existing product data
  useEffect(() => {

      // Fetch categories
    fetch("/api/categories")
      .then(r => r.json())
      .then(data => setCategories(data))
    
      // Add this alongside the categories fetch
    fetch("/api/suppliers")
      .then(r => r.json())
      .then(data => setSuppliers(data)) 


   if (product) {
    setName(product.name              || "")
    setDescription(product.description || "")
    setSku(product.sku                || "")
    setPrice(product.price.toString() || "")
    setCostPrice(product.costPrice?.toString() || "")
    setStock(product.stock.toString() || "")
    setMinStock(product.minStock.toString() || "5")
    setUnit(product.unit              || "piece")
    setOrigin(product.origin          || "")
    setCategoryId(product.category?.id || "") // ← pre-fill if editing
  } 
  // Pre-fill supplierId if editing
  if (product?.supplier) {
    setSupplierId(product.supplier.id)
  }

   else {
    setName("")
    setDescription("")
    setSku("")
    setPrice("")
    setCostPrice("")
    setStock("")
    setMinStock("5")
    setUnit("piece")
    setOrigin("")
    setCategoryId("")
    setSupplierId("")

  }

  


    setError("")
  }, [product, isOpen])


  

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!name || !price) {
      setError("Product name and price are required")
      return
    }

    setIsLoading(true)

    try {
      await onSave({
        name,
        description,
        sku,
        price:     parseFloat(price),
        costPrice: costPrice ? parseFloat(costPrice) : undefined,
        stock:     parseInt(stock) || 0,
        minStock:  parseInt(minStock) || 5,
        unit,
        origin,
        categoryId: categoryId || undefined, 
        supplierId:  supplierId  || undefined, 
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render anything if modal is closed
  if (!isOpen) return null

  return (
    // Backdrop — dark overlay behind modal
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      {/* Dark background overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}  // clicking outside closes modal
      />

      {/* Modal box */}
      <div className="
        relative z-10 w-full max-w-lg
        bg-white rounded-2xl shadow-2xl
        max-h-[90vh] overflow-y-auto
      ">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-baraka-sage/20">
          <div>
            <h2 className="text-lg font-bold text-baraka-dark">
              {isEditMode ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="text-sm text-baraka-sage mt-0.5">
              {isEditMode
                ? "Update product details"
                : "Add a new product to your inventory"
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-baraka-cream transition-colors"
          >
            <X size={18} className="text-baraka-sage" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Product name */}
          <Field label="Product Name *">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Leather Sofa Set 3-Piece"
              className={inputClass}
              required
            />
          </Field>

          {/* SKU + Origin in a row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU Code">
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="e.g. SF-001"
                className={inputClass}
              />
            </Field>
            <Field label="Origin">
              <select
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className={inputClass}
              >
                <option value="">Select origin</option>
                <option value="China">China</option>
                <option value="Dubai">Dubai</option>
                <option value="Local">Local (Rwanda)</option>
                <option value="Other">Other</option>
              </select>
            </Field>
          </div>

          {/* Price + Cost Price */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Selling Price (RWF) *">
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 450000"
                min="0"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Cost Price (RWF)">
              <input
                type="number"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="e.g. 280000"
                min="0"
                className={inputClass}
              />
            </Field>
          </div>

          {/* Stock + Min Stock + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Current Stock">
              <input
                type="number"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="0"
                min="0"
                className={inputClass}
              />
            </Field>
            <Field label="Min Stock Alert">
              <input
                type="number"
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
                placeholder="5"
                min="0"
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className={inputClass}
              >
                <option value="piece">Piece</option>
                <option value="set">Set</option>
                <option value="pair">Pair</option>
                <option value="box">Box</option>
              </select>
            </Field>
          </div>

          {/* Category */}
          <Field label="Category">
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">-Select category-</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage categories in{" "}
              <a href="/settings" className="text-baraka-primary hover:underline">
                Settings
              </a>
            </p>
          </Field>

          {/* Supplier */}
          <Field label="Supplier">
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className={inputClass}
            >
              <option value="">-Select supplier-</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)] mt-1">
              Manage suppliers in{" "}
              <a href="/suppliers" className="text-baraka-primary hover:underline">
                Suppliers page
              </a>
            </p>
          </Field>


          {/* Description */}
          <Field label="Description">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional product description..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="
                flex-1 py-2.5
                bg-baraka-cream hover:bg-baraka-sage/20
                text-baraka-dark border border-baraka-sage/40
                rounded-lg transition-colors
              "
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="
                flex-1 py-2.5
                bg-baraka-primary hover:bg-baraka-dark
                text-white rounded-lg
                transition-colors disabled:opacity-50
              "
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </span>
              ) : (
                isEditMode ? "Save Changes" : "Add Product"
              )}
            </Button>
          </div>

        </form>
      </div>
    </div>
  )
}