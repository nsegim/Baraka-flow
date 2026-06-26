"use client"

import { useState, useMemo, useRef } from "react"
import {
  Plus, Search, Package,
  AlertTriangle, Pencil, Trash2,
  RefreshCw, BarChart2, Upload, X, CheckCircle2, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useProducts, Product } from "../../../app/hooks/useProducts"
import ProductModal from "@/components/inventory/ProductModal"
import DeleteConfirmModal from "@/components/inventory/DeleteConfirmModal"
import StockAdjustModal from "@/components/inventory/StockAdjustModal"
import Image from "next/image"
import { useTranslations } from "next-intl"

function formatRWF(amount: number): string {
  return `RWF ${amount.toLocaleString()}`
}

function StockBadge({ stock, minStock, t }: {
  stock: number
  minStock: number
  t: ReturnType<typeof useTranslations<"inventory">>
}) {
  if (stock === 0) {
    return (
      <span className="flex items-center gap-1.5 text-red-600 font-semibold text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        {t("outOfStock")}
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
      {stock} {t("inStock")}
    </span>
  )
}

export default function InventoryPage() {
  const t       = useTranslations("inventory")
  const tCommon = useTranslations("common")

  const {
    products,
    meta,
    isLoading,
    error,
    fetchProducts,
    goToPage,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useProducts()

  const [search,   setSearch]   = useState("")

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const [showImport,   setShowImport]   = useState(false)
  const [importFile,   setImportFile]   = useState<File | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; skippedItems: string[] } | null>(null)
  const [importError,  setImportError]  = useState("")

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportError("")
    setImportResult(null)
    const fd = new FormData()
    fd.append("file", importFile)
    try {
      const res  = await fetch("/api/products/import", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { setImportError(json.error || t("importFailed")); return }
      setImportResult(json)
      fetchProducts()
    } catch {
      setImportError(t("importFailed"))
    } finally {
      setImporting(false)
    }
  }

  function closeImport() {
    setShowImport(false)
    setImportFile(null)
    setImportResult(null)
    setImportError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const [showAddModal,    setShowAddModal]    = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isEditMode,      setIsEditMode]      = useState(false)
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)

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

  const totalProducts  = products.length
  const lowStockCount  = products.filter(p => p.stock <= p.minStock && p.stock > 0).length
  const outOfStock     = products.filter(p => p.stock === 0).length

  function handleEdit(product: Product) {
    setSelectedProduct(product)
    setIsEditMode(true)
    setShowAddModal(true)
  }

  function handleDeleteClick(product: Product) {
    setSelectedProduct(product)
    setShowDeleteModal(true)
  }

  function handleAddClick() {
    setSelectedProduct(null)
    setIsEditMode(false)
    setShowAddModal(true)
  }

  function handleAdjust(product: Product) {
    setAdjustingProduct(product)
  }

  async function handleSave(data: Partial<Product>) {
    if (isEditMode && selectedProduct) {
      await updateProduct(selectedProduct.id, data)
    } else {
      await addProduct(data)
    }
  }

  async function handleDeleteConfirm() {
    if (selectedProduct) {
      await deleteProduct(selectedProduct.id)
    }
  }

  const from  = Math.min((meta.page - 1) * meta.limit + 1, meta.total)
  const to    = Math.min(meta.page * meta.limit, meta.total)

  return (
    <div className="space-y-6">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{t("title")}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {t("productsTotal", { count: totalProducts })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(true); setImportResult(null); setImportError("") }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] transition-colors text-sm"
          >
            <Upload size={16} />
            {t("importCsv")}
          </button>
          <Button
            onClick={handleAddClick}
            className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={18} />
            {t("addProduct")}
          </Button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("product")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("lowStock")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{lowStockCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">{t("outOfStock")}</p>
              <p className="text-xl font-bold text-[var(--foreground)]">{outOfStock}</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── SEARCH ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-[var(--card)] rounded-lg px-3 py-2.5 flex-1 border border-[var(--border)]">
          <Search size={16} className="text-[var(--muted)]" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none text-[var(--foreground)] w-full placeholder:text-[var(--muted)]"
          />
        </div>
        <Button
          onClick={fetchProducts}
          className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--background)] transition-colors"
        >
          <RefreshCw size={16} className="text-[var(--muted)]" />
        </Button>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-[var(--muted)]">
              <RefreshCw size={20} className="animate-spin" />
              <span className="text-sm">{tCommon("loading")}</span>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle size={32} className="text-red-400" />
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <Button onClick={fetchProducts} className="text-sm text-baraka-primary">
              {tCommon("tryAgain")}
            </Button>
          </div>
        )}

        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package size={40} className="text-baraka-sage/40" />
            <p className="text-sm font-medium text-[var(--foreground)]">
              {search ? t("noProductsSearch") : t("noProducts")}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {search ? t("tryDifferentSearch") : t("clickAddHint")}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredProducts.length > 0 && (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]">
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                  {t("product")}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  {t("sku")}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  {t("origin")}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  {t("stock")}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  {t("price")}
                </th>
                <th className="text-left text-xs font-semibold text-[var(--muted)] px-4 py-3 uppercase tracking-wide">
                  {tCommon("category")}
                </th>
                <th className="text-right text-xs font-semibold text-[var(--muted)] px-6 py-3 uppercase tracking-wide">
                  {tCommon("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-[var(--background)] transition-colors">

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-[var(--border)]">
                          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="40px" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center shrink-0">
                          <Package size={16} className="text-[var(--muted)]" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-xs">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-xs font-mono text-[var(--muted)] bg-[var(--background)] px-2 py-1 rounded">
                      {product.sku || "—"}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-sm text-[var(--muted)]">{product.origin || "—"}</span>
                  </td>

                  <td className="px-4 py-4">
                    <StockBadge stock={product.stock} minStock={product.minStock} t={t} />
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{formatRWF(product.price)}</p>
                    {product.costPrice && (
                      <p className="text-xs text-[var(--muted)]">{t("costLabel")} {formatRWF(product.costPrice)}</p>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {product.category ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-baraka-sage/20 text-baraka-primary font-medium">
                        {product.category.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAdjust(product)}
                        className="p-2 rounded-lg hover:bg-baraka-sage/10 text-baraka-sage hover:text-baraka-primary transition-colors"
                        title={t("adjustStock")}
                      >
                        <BarChart2 size={15} />
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 rounded-lg hover:bg-baraka-primary/10 text-baraka-sage hover:text-baraka-primary transition-colors"
                        title={t("editProduct")}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(product)}
                        className="p-2 rounded-lg hover:bg-red-50 text-baraka-sage hover:text-red-500 transition-colors"
                        title={t("deleteProduct")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* ── PAGINATION ── */}
        {!isLoading && meta.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              {t("showingOfProducts", { from, to, total: meta.total })}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(meta.page - 1)}
                disabled={meta.page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {tCommon("previous")}
              </button>
              <span className="text-sm text-[var(--muted)] px-2">
                {tCommon("pageOf", { page: meta.page, pages: meta.pages })}
              </span>
              <button
                onClick={() => goToPage(meta.page + 1)}
                disabled={meta.page >= meta.pages}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {tCommon("next")}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── MODALS ── */}
      {showAddModal && (
        <ProductModal
          key={isEditMode ? (selectedProduct?.id ?? "edit") : "add"}
          onClose={() => setShowAddModal(false)}
          onSave={handleSave}
          product={isEditMode ? selectedProduct : null}
        />
      )}

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        product={selectedProduct}
      />

      {adjustingProduct && (
        <StockAdjustModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onAdjusted={fetchProducts}
        />
      )}

      {/* ── CSV IMPORT MODAL ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeImport}>
          <div className="bg-[var(--card)] rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-baraka-primary/10 rounded-lg flex items-center justify-center">
                  <Upload size={18} className="text-baraka-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--foreground)]">{t("importTitle")}</h2>
                  <p className="text-xs text-[var(--muted)]">{t("csvColumnsHint")}</p>
                </div>
              </div>
              <button onClick={closeImport} className="p-2 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">

              {!importResult && (
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-baraka-primary hover:bg-baraka-primary/5 transition-colors">
                  <FileText size={32} className="text-baraka-sage" />
                  {importFile ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-[var(--foreground)]">{importFile.name}</p>
                      <p className="text-xs text-[var(--muted)]">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-medium text-[var(--foreground)]">{t("clickChooseCsv")}</p>
                      <p className="text-xs text-[var(--muted)]">{t("dragDropHint")}</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportError("") }}
                  />
                </label>
              )}

              {importError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{importError}</p>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">{t("importComplete")}</p>
                      <p className="text-xs text-emerald-700">
                        {importResult.imported} {importResult.imported !== 1 ? t("product").toLowerCase() + "s" : t("product").toLowerCase()} imported
                        {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
                      </p>
                    </div>
                  </div>
                  {importResult.skippedItems.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold text-yellow-800 mb-1">{t("skippedRows")}</p>
                      {importResult.skippedItems.map((item, i) => (
                        <p key={i} className="text-xs text-yellow-700">{item}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={closeImport} className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--background)] transition-colors">
                  {importResult ? tCommon("close") : tCommon("cancel")}
                </button>
                {!importResult && (
                  <button
                    onClick={handleImport}
                    disabled={!importFile || importing}
                    className="flex-1 py-2.5 rounded-lg bg-baraka-primary hover:bg-baraka-dark text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Upload size={15} />
                    {importing ? tCommon("importing") : tCommon("import")}
                  </button>
                )}
                {importResult && (
                  <button
                    onClick={() => { setImportResult(null); setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                    className="flex-1 py-2.5 rounded-lg bg-baraka-primary hover:bg-baraka-dark text-white text-sm font-medium transition-colors"
                  >
                    {t("importAnother")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
