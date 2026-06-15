"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Tag, Loader2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Category {
  id:   string
  name: string
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [newName,    setNewName]    = useState("")
  const [isAdding,   setIsAdding]   = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error,      setError]      = useState("")
  const [success,    setSuccess]    = useState("")

  // Edit state — tracks which category is being edited
  // and what the new name is
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isSaving,    setIsSaving]    = useState(false)

  // Auto-focus the edit input when it appears
  const editInputRef = useRef<HTMLInputElement>(null)



  // When editingId changes — focus the input automatically
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
    }
  }, [editingId])

  async function fetchCategories() {
    try {
      setIsLoading(true)
      const res  = await fetch("/api/categories")
      const data = await res.json()
      setCategories(data)
    } catch {
      setError("Failed to load categories")
    } finally {
      setIsLoading(false)
    }
  }

    useEffect(() => {
    fetchCategories()
  }, [])

  // ── ADD ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setIsAdding(true)
    setError("")
    setSuccess("")

    try {
      const res  = await fetch("/api/categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: newName.trim() })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to add category")
        return
      }

      setCategories(prev => [...prev, data])
      setNewName("")
      showSuccess(`"${data.name}" added successfully`)

    } catch {
      setError("Something went wrong")
    } finally {
      setIsAdding(false)
    }
  }

  // ── START EDITING ──
  function handleStartEdit(cat: Category) {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setError("")
  }

  // ── CANCEL EDITING ──
  function handleCancelEdit() {
    setEditingId(null)
    setEditingName("")
  }

  // ── SAVE EDIT ──
  async function handleSaveEdit(id: string) {
    if (!editingName.trim()) return

    // If name didn't change — just cancel
    const original = categories.find(c => c.id === id)
    if (original?.name === editingName.trim()) {
      handleCancelEdit()
      return
    }

    setIsSaving(true)
    setError("")

    try {
      const res  = await fetch(`/api/categories/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: editingName.trim() })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to update category")
        return
      }

      // Update name in the list instantly
      setCategories(prev =>
        prev.map(c => c.id === id ? { ...c, name: data.name } : c)
      )
      handleCancelEdit()
      showSuccess(`Category renamed to "${data.name}"`)

    } catch {
      setError("Something went wrong")
    } finally {
      setIsSaving(false)
    }
  }

  // ── DELETE ──
  async function handleDelete(id: string, name: string) {
    setDeletingId(id)
    setError("")

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE"
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to delete")
        return
      }

      setCategories(prev => prev.filter(c => c.id !== id))
      showSuccess(`"${name}" deleted`)

    } catch {
      setError("Something went wrong")
    } finally {
      setDeletingId(null)
    }
  }

  // ── HELPER — show success then clear after 3s ──
  function showSuccess(message: string) {
    setSuccess(message)
    setTimeout(() => setSuccess(""), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Manage your business configuration
        </p>
      </div>

      {/* Categories card */}
      <div className="
        bg-[var(--card)] rounded-xl
        border border-[var(--border)] overflow-hidden
      ">

        {/* Card header */}
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 mb-1">
            <Tag size={18} className="text-baraka-primary" />
            <h2 className="font-semibold text-[var(--foreground)]">
              Product Categories
            </h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Organize your products by category.
            Deleting a category does not delete its products.
          </p>
        </div>

        <div className="p-6 space-y-4">

          {/* Feedback */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
              ✓ {success}
            </div>
          )}

          {/* Add form */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Bedroom, Office Furniture..."
              className="
                flex-1 px-3 py-2.5 rounded-lg
                border border-baraka-sage/40
                bg-baraka-cream/50
                text-baraka-dark text-sm
                placeholder:text-baraka-sage
                outline-none
                focus:border-baraka-primary
                focus:ring-2 focus:ring-baraka-primary/20
                transition-colors
              "
            />
            <Button
              type="submit"
              disabled={!newName.trim() || isAdding}
              className="
                flex items-center gap-2
                bg-baraka-primary hover:bg-baraka-dark
                text-white px-4 py-2.5 rounded-lg
                transition-colors disabled:opacity-50
                whitespace-nowrap
              "
            >
              {isAdding
                ? <Loader2 size={16} className="animate-spin" />
                : <Plus size={16} />
              }
              Add
            </Button>
          </form>

          {/* Categories list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-baraka-sage" />
            </div>

          ) : categories.length === 0 ? (
            <div className="text-center py-8">
              <Tag size={32} className="text-baraka-sage/30 mx-auto mb-2" />
              <p className="text-sm text-[var(--muted)]">
                No categories yet
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Add your first category above
              </p>
            </div>

          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="
                    flex items-center justify-between
                    px-4 py-3 rounded-lg
                    bg-[var(--background)]
                    border border-[var(--border)]
                    group
                  "
                >
                  {editingId === cat.id ? (
                    // ── EDIT MODE — show input + save/cancel ──
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter")  handleSaveEdit(cat.id)
                          if (e.key === "Escape") handleCancelEdit()
                        }}
                        className="
                          flex-1 px-2 py-1 rounded-md
                          border border-baraka-primary
                          bg-white text-baraka-dark text-sm
                          outline-none
                          focus:ring-2 focus:ring-baraka-primary/20
                        "
                      />
                      {/* Save button */}
                      <button
                        onClick={() => handleSaveEdit(cat.id)}
                        disabled={!editingName.trim() || isSaving}
                        className="
                          p-1.5 rounded-lg
                          bg-baraka-primary hover:bg-baraka-dark
                          text-white transition-colors
                          disabled:opacity-50
                        "
                        title="Save"
                      >
                        {isSaving
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Check size={14} />
                        }
                      </button>
                      {/* Cancel button */}
                      <button
                        onClick={handleCancelEdit}
                        className="
                          p-1.5 rounded-lg
                          hover:bg-red-50
                          text-baraka-sage hover:text-red-500
                          transition-colors
                        "
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>

                  ) : (
                    // ── VIEW MODE — show name + edit/delete buttons ──
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-baraka-primary" />
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {cat.name}
                        </span>
                      </div>
                      <div className="
                        flex items-center gap-1
                        opacity-0 group-hover:opacity-100
                        transition-opacity
                      ">
                        {/* Edit button */}
                        <button
                          onClick={() => handleStartEdit(cat)}
                          className="
                            p-1.5 rounded-lg
                            hover:bg-baraka-primary/10
                            text-baraka-sage hover:text-baraka-primary
                            transition-colors
                          "
                          title="Rename category"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDelete(cat.id, cat.name)}
                          disabled={deletingId === cat.id}
                          className="
                            p-1.5 rounded-lg
                            hover:bg-red-50
                            text-baraka-sage hover:text-red-500
                            transition-colors disabled:opacity-50
                          "
                          title="Delete category"
                        >
                          {deletingId === cat.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}