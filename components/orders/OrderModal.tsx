"use client"

import { useState, useEffect } from "react"
import { X, Plus, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Product {
  id:    string
  name:  string
  price: number
  stock: number
  unit:  string
}

interface OrderItem {
  productId: string
  productName: string
  quantity:  number
  unitPrice: number
}

interface OrderModalProps {
  isOpen:  boolean
  onClose: () => void
  onSave:  (data: {
    customerName:  string
    customerPhone: string
    notes:         string
    items:         OrderItem[]
  }) => Promise<void>
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

export default function OrderModal({
  isOpen,
  onClose,
  onSave,
}: OrderModalProps) {
  const [customerName,  setCustomerName]  = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [notes,         setNotes]         = useState("")
  const [items,         setItems]         = useState<OrderItem[]>([])
  const [products,      setProducts]      = useState<Product[]>([])
  const [isLoading,     setIsLoading]     = useState(false)
  const [error,         setError]         = useState("")

  // Fetch products and reset the form when the modal opens.
  // All setState calls are inside the .then() callback (asynchronous) — not in the
  // synchronous effect body — which satisfies the React linter rule.
  useEffect(() => {
    if (!isOpen) return

    fetch("/api/products?all=true")
      .then(r => r.json())
      .then(data => {
        setProducts(data)
        setCustomerName("")
        setCustomerPhone("")
        setNotes("")
        setItems([])
        setError("")
      })
  }, [isOpen])

  // Add empty item row
  function addItem() {
    setItems(prev => [...prev, {
      productId:   "",
      productName: "",
      quantity:    1,
      unitPrice:   0,
    }])
  }

  // Update a specific item field
  function updateItem(
    index: number,
    field: keyof OrderItem,
    value: string | number
  ) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item

      // When product changes — auto-fill price from product
      if (field === "productId") {
        const product = products.find(p => p.id === value)
        return {
          ...item,
          productId:   value as string,
          productName: product?.name || "",
          unitPrice:   product?.price || 0,
        }
      }

      return { ...item, [field]: value }
    }))
  }

  // Remove an item row
  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Calculate total
  const total = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  )

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError("")

    if (!customerName.trim()) {
      setError("Customer name is required")
      return
    }

    if (items.length === 0) {
      setError("Add at least one product to the order")
      return
    }

    const invalidItem = items.find(i => !i.productId || i.quantity < 1)
    if (invalidItem) {
      setError("Please select a product and quantity for all items")
      return
    }

    setIsLoading(true)
    try {
      await onSave({ customerName, customerPhone, notes, items })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="
        relative z-10 w-full max-w-2xl
        bg-white rounded-2xl shadow-2xl
        max-h-[90vh] overflow-y-auto
      ">

        {/* Header */}
        <div className="
          flex items-center justify-between
          p-6 border-b border-baraka-sage/20
          sticky top-0 bg-white z-10
        ">
          <div>
            <h2 className="text-lg font-bold text-baraka-dark">
              New Order
            </h2>
            <p className="text-sm text-baraka-sage mt-0.5">
              Record a sale to a client
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-baraka-cream transition-colors"
          >
            <X size={18} className="text-baraka-sage" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                Customer Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Karemera Furniture Store"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-baraka-dark mb-1.5">
                Phone / WhatsApp
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+250 788 123 456"
                className={inputClass}
              />
            </div>
          </div>

          {/* Order items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-baraka-dark">
                Order Items *
              </label>
              <button
                type="button"
                onClick={addItem}
                className="
                  flex items-center gap-1.5 text-xs
                  text-baraka-primary hover:text-baraka-dark
                  font-medium transition-colors
                "
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div
                onClick={addItem}
                className="
                  border-2 border-dashed border-baraka-sage/30
                  rounded-xl p-6 text-center cursor-pointer
                  hover:border-baraka-primary/40
                  hover:bg-baraka-cream/30
                  transition-colors
                "
              >
                <Plus size={20} className="text-baraka-sage mx-auto mb-1" />
                <p className="text-sm text-baraka-sage">
                  Click to add products to this order
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 px-1">
                  <span className="col-span-5 text-xs text-baraka-sage font-medium">
                    Product
                  </span>
                  <span className="col-span-2 text-xs text-baraka-sage font-medium">
                    Qty
                  </span>
                  <span className="col-span-4 text-xs text-baraka-sage font-medium">
                    Unit Price (RWF)
                  </span>
                  <span className="col-span-1" />
                </div>

                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">

                    {/* Product select */}
                    <div className="col-span-5">
                      <select
                        value={item.productId}
                        onChange={e => updateItem(index, "productId", e.target.value)}
                        className={inputClass}
                        required
                      >
                        <option value="">Select product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.stock} in stock)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        min="1"
                        className={inputClass}
                        required
                      />
                    </div>

                    {/* Unit price — auto-filled but editable */}
                    <div className="col-span-4">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={e => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        min="0"
                        className={inputClass}
                        required
                      />
                    </div>

                    {/* Remove button */}
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="
                          p-1.5 rounded-lg
                          hover:bg-red-50 text-baraka-sage
                          hover:text-red-500 transition-colors
                        "
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                  </div>
                ))}

                {/* Order total */}
                <div className="
                  flex justify-end
                  pt-3 border-t border-baraka-sage/20
                ">
                  <div className="text-right">
                    <p className="text-xs text-baraka-sage">Order Total</p>
                    <p className="text-xl font-bold text-baraka-dark">
                      RWF {total.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Buttons */}
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
                  Creating order...
                </span>
              ) : (
                "Create Order"
              )}
            </Button>
          </div>

        </form>
      </div>
    </div>
  )
}