"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Truck, Mail, Phone,
  Globe, Pencil, Trash2,
  Loader2, AlertTriangle, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import SupplierModal, { Supplier } from "@/components/suppliers/SupplierModal"

export default function SuppliersPage() {
  const [suppliers,   setSuppliers]   = useState<Supplier[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState("")
  const [showModal,   setShowModal]   = useState(false)
  const [selected,    setSelected]    = useState<Supplier | null>(null)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [toDelete,    setToDelete]    = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError("")
      const res  = await fetch("/api/suppliers")
      const data = await res.json()
      setSuppliers(data)
    } catch {
      setError("Failed to load suppliers")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // ── ADD or EDIT ──
  async function handleSave(data: Partial<Supplier>) {
    if (selected) {
      // Edit mode
      const res  = await fetch(`/api/suppliers/${selected.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const updated = await res.json()
      setSuppliers(prev =>
        prev.map(s => s.id === selected.id ? updated : s)
      )
    } else {
      // Add mode
      const res  = await fetch("/api/suppliers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data)
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      const newSupplier = await res.json()
      setSuppliers(prev => [newSupplier, ...prev])
    }
  }

  // ── DELETE ──
  async function handleDelete() {
    if (!toDelete) return
    setDeletingId(toDelete.id)
    try {
      await fetch(`/api/suppliers/${toDelete.id}`, {
        method: "DELETE"
      })
      setSuppliers(prev => prev.filter(s => s.id !== toDelete.id))
      setShowConfirm(false)
      setToDelete(null)
    } catch {
      setError("Failed to delete supplier")
    } finally {
      setDeletingId(null)
    }
  }

  function handleEditClick(supplier: Supplier) {
    setSelected(supplier)
    setShowModal(true)
  }

  function handleDeleteClick(supplier: Supplier) {
    setToDelete(supplier)
    setShowConfirm(true)
  }

  function handleAddClick() {
    setSelected(null)
    setShowModal(true)
  }

  // Country flag emoji helper
  function countryFlag(country: string | null) {
    const flags: Record<string, string> = {
      "China":   "🇨🇳",
      "Dubai":   "🇦🇪",
      "Rwanda":  "🇷🇼",
      "Kenya":   "🇰🇪",
      "Tanzania":"🇹🇿",
    }
    return country ? (flags[country] || "🌍") : "🌍"
  }

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Suppliers
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={handleAddClick}
          className="
            flex items-center gap-2
            bg-baraka-primary hover:bg-baraka-dark
            text-white px-4 py-2.5 rounded-lg
            transition-colors
          "
        >
          <Plus size={18} />
          Add Supplier
        </Button>
      </div>

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-[var(--muted)]">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">Loading suppliers...</span>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <Button onClick={fetchSuppliers}>Try again</Button>
        </div>
      )}

      {/* ── EMPTY ── */}
      {!isLoading && !error && suppliers.length === 0 && (
        <div className="
          flex flex-col items-center justify-center
          py-16 gap-3
          bg-[var(--card)] rounded-xl border border-[var(--border)]
        ">
          <Truck size={40} className="text-baraka-sage/40" />
          <p className="text-sm font-medium text-[var(--foreground)]">
            No suppliers yet
          </p>
          <p className="text-xs text-[var(--muted)]">
            Add your China and Dubai suppliers to track where products come from
          </p>
          <Button
            onClick={handleAddClick}
            className="
              mt-2 flex items-center gap-2
              bg-baraka-primary hover:bg-baraka-dark
              text-white px-4 py-2 rounded-lg text-sm
            "
          >
            <Plus size={16} />
            Add First Supplier
          </Button>
        </div>
      )}

      {/* ── SUPPLIERS GRID ── */}
      {!isLoading && !error && suppliers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(supplier => (
            <div
              key={supplier.id}
              className="
                bg-[var(--card)] rounded-xl
                border border-[var(--border)]
                shadow-sm hover:shadow-md
                transition-shadow p-5
                group
              "
            >
              {/* Card top — name + actions */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Country flag circle */}
                  <div className="
                    w-10 h-10 rounded-full
                    bg-baraka-sage/20
                    flex items-center justify-center
                    text-lg
                  ">
                    {countryFlag(supplier.country)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] text-sm">
                      {supplier.name}
                    </h3>
                    {supplier.country && (
                      <p className="text-xs text-[var(--muted)]">
                        {supplier.country}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons — visible on hover */}
                <div className="
                  flex items-center gap-1
                  opacity-0 group-hover:opacity-100
                  transition-opacity
                ">
                  <button
                    onClick={() => handleEditClick(supplier)}
                    className="
                      p-1.5 rounded-lg
                      hover:bg-baraka-primary/10
                      text-baraka-sage hover:text-baraka-primary
                      transition-colors
                    "
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(supplier)}
                    className="
                      p-1.5 rounded-lg
                      hover:bg-red-50
                      text-baraka-sage hover:text-red-500
                      transition-colors
                    "
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Contact details */}
              <div className="space-y-2">
                {supplier.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-baraka-sage shrink-0" />
                    <span className="text-xs text-[var(--muted)] truncate">
                      {supplier.email}
                    </span>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-baraka-sage shrink-0" />
                    <span className="text-xs text-[var(--muted)]">
                      {supplier.phone}
                    </span>
                  </div>
                )}
                {!supplier.email && !supplier.phone && (
                  <p className="text-xs text-[var(--muted)] italic">
                    No contact details
                  </p>
                )}
              </div>

              {/* Products count badge */}
              <div className="
                mt-4 pt-3
                border-t border-[var(--border)]
                flex items-center gap-2
              ">
                <Globe size={13} className="text-baraka-sage" />
                <span className="text-xs text-[var(--muted)]">
                  {supplier._count.products} product
                  {supplier._count.products !== 1 ? "s" : ""} linked
                </span>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── ADD/EDIT MODAL ── */}
      <SupplierModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        supplier={selected}
      />

      {/* ── DELETE CONFIRM ── */}
      {showConfirm && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="
            relative z-10 w-full max-w-sm
            bg-white rounded-2xl shadow-2xl p-6
          ">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-baraka-dark mb-2">
              Delete Supplier
            </h2>
            <p className="text-sm text-baraka-sage mb-1">
              Are you sure you want to delete:
            </p>
            <p className="text-sm font-semibold text-baraka-dark mb-3">
              {toDelete.name}
            </p>
            <p className="text-xs text-baraka-sage mb-6">
              Products linked to this supplier will not be deleted —
              they will just become unlinked.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirm(false)}
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
                onClick={handleDelete}
                disabled={!!deletingId}
                className="
                  flex-1 py-2.5
                  bg-red-500 hover:bg-red-600
                  text-white rounded-lg
                  transition-colors disabled:opacity-50
                "
              >
                {deletingId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </span>
                ) : "Yes, Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}