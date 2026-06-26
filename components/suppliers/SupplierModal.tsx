"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface Supplier {
  id:                 string
  name:               string
  email:              string | null
  phone:              string | null
  country:            string | null
  outstandingBalance: number
  _count:             { products: number }
}

interface SupplierModalProps {
  onClose:   () => void
  onSave:    (data: Partial<Supplier>) => Promise<void>
  supplier?: Supplier | null
}

const inputClass = `
  w-full px-3 py-2.5 rounded-lg
  border border-baraka-sage/40
  bg-baraka-cream/50
  text-baraka-dark text-sm
  placeholder:text-baraka-sage
  outline-none
  focus:border-baraka-primary
  focus:ring-2 focus:ring-baraka-primary/20
  transition-colors
`

export default function SupplierModal({ onClose, onSave, supplier }: SupplierModalProps) {
  const isEditMode = !!supplier

  const [form,      setForm]      = useState({
    name:    supplier?.name    ?? "",
    email:   supplier?.email   ?? "",
    phone:   supplier?.phone   ?? "",
    country: supplier?.country ?? "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState("")

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!form.name.trim()) {
      setError("Supplier name is required")
      return
    }

    setIsLoading(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-baraka-sage/20">
          <div>
            <h2 className="text-lg font-bold text-baraka-dark">
              {isEditMode ? "Edit Supplier" : "Add New Supplier"}
            </h2>
            <p className="text-sm text-baraka-sage mt-0.5">
              {isEditMode ? "Update supplier details" : "Add a supplier for your imported products"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-baraka-cream transition-colors">
            <X size={18} className="text-baraka-sage" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Supplier Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Guangzhou Furniture Co."
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Country
            </label>
            <select value={form.country} onChange={set("country")} className={inputClass}>
              <option value="">Select country</option>
              <option value="China">China</option>
              <option value="Dubai">Dubai (UAE)</option>
              <option value="Rwanda">Rwanda (Local)</option>
              <option value="Kenya">Kenya</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="supplier@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-baraka-dark mb-1.5">
              Phone / WhatsApp
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+86 123 456 7890"
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-baraka-cream hover:bg-baraka-sage/20 text-baraka-dark border border-baraka-sage/40 rounded-lg transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-baraka-primary hover:bg-baraka-dark text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </span>
              ) : (
                isEditMode ? "Save Changes" : "Add Supplier"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
