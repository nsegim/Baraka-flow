"use client"

import { useState, useMemo } from "react"
import {
  Plus, Search, Package,
  AlertTriangle, Pencil, Trash2,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProducts, Product } from "../../../app/hooks/useProducts"
import ProductModal from "@/components/inventory/ProductModal"
import DeleteConfirmModal from "@/components/inventory/DeleteConfirmModal"

// Format number as RWF
function formatRWF(amount: number): string {
  return `RWF ${amount.toLocaleString()}`
}

// Stock level indicator
function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock === 0) {
    return (
      <span className="flex items-center gap-1.5 text-red-600 font-semibold text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Out of stock
      </span>
    )
  }
  if (stock <= minStock) {
    return (
      <span className="flex items-center gap-1.5 text-yellow-600 font-semibold text-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        {stock} left
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      {stock} in stock
    </span>
  )
}

export default function InventoryPage() {
  const {
    products,
    isLoading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useProducts()

  // Search and filter state
  const [search,   setSearch]   = useState("")

  // Modal state
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isEditMode,      setIsEditMode]      = useState(false)

  // Filter products by search term
  // useMemo means: only recalculate when products or search changes
  // not on every single render — better performance
  const filteredProducts = useMemo(() => {
    if (!search) return products

    const lower = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(lower)        ||
      p.sku?.toLowerCase().includes(lower)        ||
      p.origin?.toLowerCase().includes(lower)     ||
      p.category?.name.toLowerCase().includes(lower)
    )
  }, [products, search])

  // Summary numbers
  const totalProducts  = products.length
  const lowStockCount  = products.filter(p => p.stock <= p.minStock && p.stock > 0).length
  const outOfStock     = products.filter(p => p.stock === 0).length

  // Open edit modal
  function handleEdit(product: Product) {
    setSelectedProduct(product)
    setIsEditMode(true)
    setShowAddModal(true)
  }

  // Open delete modal
  function handleDeleteClick(product: Product) {
    setSelectedProduct(product)
    setShowDeleteModal(true)
  }

  // Open add modal
  function handleAddClick() {
    setSelectedProduct(null)
    setIsEditMode(false)
    setShowAddModal(true)
  }

  // Save — handles both add and edit
  async function handleSave(data: Partial<Product>) {
    if (isEditMode && selectedProduct) {
      await updateProduct(selectedProduct.id, data)
    } else {
      await addProduct(data)
    }
  }

  // Confirm delete
  async function handleDeleteConfirm() {
    if (selectedProduct) {
      await deleteProduct(selectedProduct.id)
    }
  }

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Inventory
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {totalProducts} products total
          </p>
        </div>
        <Button
          onClick={handleAddClick}
          className="
            flex items-center gap-2
            bg-baraka-primary hover:bg-baraka-dark
            text-white px-4 py-2.5
            rounded-lg transition-colors
          "
        >
          <Plus size={18} />
          Add Product
        </Button>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-3 gap-4">

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Total Products</p>
              <p className="text-xl font-bold text-[var(--foreground)]">
                {totalProducts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Low Stock</p>
              <p className="text-xl font-bold text-[var(--foreground)]">
                {lowStockCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Out of Stock</p>
              <p className="text-xl font-bold text-[var(--foreground)]">
                {outOfStock}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* ── SEARCH ── */}
      <div className="flex items-center gap-3">
        <div className="
          flex items-center gap-2
          bg-[var(--card)] rounded-lg
          px-3 py-2.5 flex-1
          border border-[var(--border)]
        ">
          <Search size={16} className="text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search by name, SKU, origin, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="
              bg-transparent text-sm outline-none
              text-[var(--foreground)] w-full
              placeholder:text-[var(--muted)]
            "
          />
        </div>
        <Button
          onClick={fetchProducts}
          className="
            p-2.5 rounded-lg
            bg-[var(--card)] border border-[var(--border)]
            hover:bg-[var(--background)]
            transition-colors
          "
        >
          <RefreshCw size={16} className="text-[var(--muted)]" />
        </Button>
      </div>

      {/* ── TABLE ── */}
      <div className="
        bg-[var(--card)] rounded-xl
        border border-[var(--border)]
        shadow-sm overflow-hidden
      ">

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-[var(--muted)]">
              <RefreshCw size={20} className="animate-spin" />
              <span className="text-sm">Loading products...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Button onClick={fetchProducts} className="text-sm text-baraka-primary">
              Try again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package size={40} className="text-baraka-sage/40" />
            <p className="text-sm font-medium text-[var(--foreground)]">
              {search ? "No products match your search" : "No products yet"}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {search
                ? "Try a different search term"
                : "Click 'Add Product' to add your first product"
              }
            </p>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && filteredProducts.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  SKU
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  Origin
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  Stock
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  Price
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  Category
                </th>
                <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-[var(--background)] transition-colors"
                >
                  {/* Product name + description */}
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {product.name}
                    </p>
                    {product.description && (
                      <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-xs">
                        {product.description}
                      </p>
                    )}
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-4">
                    <span className="text-xs font-mono text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded">
                      {product.sku || "—"}
                    </span>
                  </td>

                  {/* Origin */}
                  <td className="px-4 py-4">
                    <span className="text-sm text-[var(--muted)]">
                      {product.origin || "—"}
                    </span>
                  </td>

                  {/* Stock badge */}
                  <td className="px-4 py-4">
                    <StockBadge
                      stock={product.stock}
                      minStock={product.minStock}
                    />
                  </td>

                  {/* Price */}
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatRWF(product.price)}
                    </p>
                    {product.costPrice && (
                      <p className="text-xs text-[var(--muted)]">
                        Cost: {formatRWF(product.costPrice)}
                      </p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4">
                    {product.category ? (
                      <span className="
                        text-xs px-2 py-1 rounded-full
                        bg-baraka-sage/20 text-baraka-primary
                        font-medium
                      ">
                        {product.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="
                          p-2 rounded-lg
                          hover:bg-baraka-primary/10
                          text-baraka-sage hover:text-baraka-primary
                          transition-colors
                        "
                        title="Edit product"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product)}
                        className="
                          p-2 rounded-lg
                          hover:bg-red-50
                          text-baraka-sage hover:text-red-500
                          transition-colors
                        "
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>

      {/* ── MODALS ── */}
      <ProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSave}
        product={isEditMode ? selectedProduct : null}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        product={selectedProduct}
      />

    </div>
  )
}