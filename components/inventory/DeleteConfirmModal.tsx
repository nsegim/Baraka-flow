"use client"

import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Product } from "../../app/hooks/useProducts"

interface DeleteConfirmModalProps {
  isOpen:    boolean
  onClose:   () => void
  onConfirm: () => Promise<void>
  product:   Product | null
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  product,
}: DeleteConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm() {
    setIsLoading(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !product) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="
        relative z-10 w-full max-w-sm
        bg-white rounded-2xl shadow-2xl p-6
      ">
        {/* Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>

        <h2 className="text-lg font-bold text-baraka-dark mb-2">
          Delete Product
        </h2>
        <p className="text-sm text-baraka-sage mb-1">
          Are you sure you want to delete:
        </p>
        <p className="text-sm font-semibold text-baraka-dark mb-4">
          {product.name}
        </p>
        <p className="text-xs text-red-500 mb-6">
          This action cannot be undone. All stock movement history
          for this product will also be deleted.
        </p>

        <div className="flex gap-3">
          <Button
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
            onClick={handleConfirm}
            disabled={isLoading}
            className="
              flex-1 py-2.5
              bg-red-500 hover:bg-red-600
              text-white rounded-lg
              transition-colors disabled:opacity-50
            "
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Deleting...
              </span>
            ) : (
              "Yes, Delete"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}