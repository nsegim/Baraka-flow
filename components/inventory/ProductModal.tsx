"use client"

import { useState, useEffect, useRef } from "react"
import { X, Loader2, ImagePlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Product } from "../../app/hooks/useProducts"
import Image from "next/image"

interface ProductModalProps {
  onClose:  () => void
  onSave:   (data: Partial<Product>) => Promise<void>
  product?: Product | null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-baraka-dark mb-1.5">{label}</label>
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

// No isOpen prop — the parent renders this only when needed ({open && <Modal/>}).
// A key prop on the parent call resets state when product/mode changes.
export default function ProductModal({ onClose, onSave, product }: ProductModalProps) {
  const isEditMode = !!product

  // State initialized from props — reset happens via parent key prop, not useEffect.
  const [name,        setName]        = useState(product?.name              ?? "")
  const [description, setDescription] = useState(product?.description       ?? "")
  const [sku,         setSku]         = useState(product?.sku               ?? "")
  const [price,       setPrice]       = useState(product?.price.toString()  ?? "")
  const [costPrice,   setCostPrice]   = useState(product?.costPrice?.toString() ?? "")
  const [stock,       setStock]       = useState(product?.stock.toString()  ?? "")
  const [minStock,    setMinStock]    = useState(product?.minStock.toString() ?? "5")
  const [unit,        setUnit]        = useState(product?.unit              ?? "piece")
  const [origin,      setOrigin]      = useState(product?.origin            ?? "")
  const [categoryId,  setCategoryId]  = useState(product?.category?.id     ?? "")
  const [supplierId,  setSupplierId]  = useState(product?.supplier?.id     ?? "")
  const [imageUrl,    setImageUrl]    = useState<string | null>(product?.imageUrl ?? null)

  const [isLoading,   setIsLoading]   = useState(false)
  const [error,       setError]       = useState("")

  const [categories,  setCategories]  = useState<{ id: string; name: string }[]>([])
  const [suppliers,   setSuppliers]   = useState<{ id: string; name: string }[]>([])

  // Image upload state
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const [imageFile,    setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removedImage, setRemovedImage] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [imgError,     setImgError]    = useState("")

  // Fetch reference data — this is external-system sync, which is the correct useEffect use
  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {})
    fetch("/api/suppliers").then(r => r.json()).then(setSuppliers).catch(() => {})
  }, [])

  // Revoke blob URL on unmount to avoid memory leaks
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setImgError("Max file size is 10 MB"); return }
    setImgError("")
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
    setRemovedImage(false)
  }

  function handleRemoveImage() {
    setImageFile(null)
    if (imagePreview) { URL.revokeObjectURL(imagePreview); setImagePreview(null) }
    setImageUrl(null)
    setRemovedImage(true)
    setImgError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError("")
    if (!name || !price) { setError("Product name and price are required"); return }
    setIsLoading(true)

    try {
      let finalImageUrl: string | null | undefined = imageUrl

      if (imageFile && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setUploadingImg(true)
        const fd = new FormData()
        fd.append("file", imageFile)
        const res  = await fetch("/api/upload/product-image", { method: "POST", body: fd })
        const json = await res.json()
        setUploadingImg(false)
        if (!res.ok) { setError(json.error || "Image upload failed"); setIsLoading(false); return }
        finalImageUrl = json.url
      } else if (removedImage) {
        finalImageUrl = null
      }

      await onSave({
        name, description, sku,
        price:      parseFloat(price),
        costPrice:  costPrice ? parseFloat(costPrice) : undefined,
        stock:      parseInt(stock)    || 0,
        minStock:   parseInt(minStock) || 5,
        unit, origin,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        imageUrl:   finalImageUrl ?? undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
      setUploadingImg(false)
    }
  }

  const displayImage = imagePreview ?? imageUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-baraka-sage/20">
          <div>
            <h2 className="text-lg font-bold text-baraka-dark">
              {isEditMode ? "Edit Product" : "Add New Product"}
            </h2>
            <p className="text-sm text-baraka-sage mt-0.5">
              {isEditMode ? "Update product details" : "Add a new product to your inventory"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-baraka-cream transition-colors">
            <X size={18} className="text-baraka-sage" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
          )}

          {/* ── PRODUCT PHOTO ── */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-2">Product Photo</label>

            {displayImage ? (
              <div className="relative group">
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-baraka-sage/30 bg-baraka-cream/50">
                  <Image
                    src={displayImage}
                    alt="Product preview"
                    fill
                    className="object-cover"
                    sizes="512px"
                    unoptimized={displayImage.startsWith("blob:")}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white/90 text-baraka-dark text-xs font-medium rounded-lg hover:bg-white transition-colors flex items-center gap-1.5">
                      <ImagePlus size={13} /> Change
                    </button>
                    <button type="button" onClick={handleRemoveImage} className="px-3 py-1.5 bg-red-500/90 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5">
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
                {uploadingImg && (
                  <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin text-baraka-primary" />
                    <span className="text-sm font-medium text-baraka-dark">Uploading…</span>
                  </div>
                )}
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 h-36 rounded-xl border-2 border-dashed border-baraka-sage/40 bg-baraka-cream/30 cursor-pointer hover:border-baraka-primary hover:bg-baraka-primary/5 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-baraka-primary/10 group-hover:bg-baraka-primary/20 flex items-center justify-center transition-colors">
                  <ImagePlus size={20} className="text-baraka-primary" />
                </div>
                <div className="text-center">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                    <>
                      <p className="text-sm font-medium text-baraka-dark">Click to upload a photo</p>
                      <p className="text-xs text-baraka-sage mt-0.5">JPEG, PNG, WebP or HEIC · max 10 MB</p>
                      <p className="text-xs text-baraka-primary/70 mt-1">Auto-compressed to WebP for fast loading</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-baraka-sage">Image upload not configured</p>
                      <p className="text-xs text-baraka-sage/70 mt-0.5">Add Supabase credentials to .env to enable photos</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              className="hidden"
              onChange={handleFileChange}
            />
            {imgError && <p className="text-xs text-red-500 mt-1">{imgError}</p>}
          </div>

          {/* Product name */}
          <Field label="Product Name *">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Leather Sofa Set 3-Piece" className={inputClass} required />
          </Field>

          {/* SKU + Origin */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU Code">
              <input type="text" value={sku} onChange={e => setSku(e.target.value)} placeholder="e.g. SF-001" className={inputClass} />
            </Field>
            <Field label="Origin">
              <select value={origin} onChange={e => setOrigin(e.target.value)} className={inputClass}>
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
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 450000" min="0" className={inputClass} required />
            </Field>
            <Field label="Cost Price (RWF)">
              <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="e.g. 280000" min="0" className={inputClass} />
            </Field>
          </div>

          {/* Stock + Min Stock + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Current Stock">
              <input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" min="0" className={inputClass} />
            </Field>
            <Field label="Min Stock Alert">
              <input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="5" min="0" className={inputClass} />
            </Field>
            <Field label="Unit">
              <select value={unit} onChange={e => setUnit(e.target.value)} className={inputClass}>
                <option value="piece">Piece</option>
                <option value="set">Set</option>
                <option value="pair">Pair</option>
                <option value="box">Box</option>
              </select>
            </Field>
          </div>

          {/* Category */}
          <Field label="Category">
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputClass}>
              <option value="">— Select category —</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </Field>

          {/* Supplier */}
          <Field label="Supplier">
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputClass}>
              <option value="">— Select supplier —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional product description..." rows={3} className={`${inputClass} resize-none`} />
          </Field>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} className="flex-1 py-2.5 bg-baraka-cream hover:bg-baraka-sage/20 text-baraka-dark border border-baraka-sage/40 rounded-lg transition-colors">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  {uploadingImg ? "Uploading photo…" : "Saving…"}
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
