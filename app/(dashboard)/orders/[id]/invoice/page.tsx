"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Printer, ArrowLeft, Loader2, MessageCircle } from "lucide-react"
import Link from "next/link"

interface OrderItem {
  id:        string
  quantity:  number
  unitPrice: number
  product:   { name: string }
}

interface Payment {
  id:     string
  amount: number
  method: string
  paidAt: string
}

interface Order {
  id:            string
  orderNumber:   string
  customerName:  string
  customerPhone: string | null
  status:        string
  paymentStatus: string
  subtotal:      number | null
  taxRate:       number | null
  taxAmount:     number | null
  totalAmount:   number
  amountPaid:    number
  notes:         string | null
  createdAt:     string
  items:         OrderItem[]
  payments:      Payment[]
  user:          { name: string }
}

interface Business {
  name:    string
  email:   string
  phone:   string | null
  address: string | null
}

function formatRWF(n: number) {
  return `RWF ${Number(n).toLocaleString()}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-RW", { day: "numeric", month: "long", year: "numeric" })
}

const METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  MOBILE_MONEY:  "Mobile Money",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT:        "Credit",
}

export default function InvoicePage() {
  const params   = useParams()
  const orderId  = params.id as string

  const [order,    setOrder]    = useState<Order | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")

  useEffect(() => {
    Promise.all([
      fetch(`/api/orders/${orderId}`).then(r => r.json()),
      fetch("/api/business").then(r => r.json()),
    ]).then(([o, b]) => {
      if (o.error) { setError(o.error); setLoading(false); return }
      setOrder(o)
      setBusiness(b)
      setLoading(false)
    }).catch(() => { setError("Failed to load invoice"); setLoading(false) })
  }, [orderId])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin text-baraka-sage" />
    </div>
  )

  if (error || !order || !business) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-600">{error || "Invoice not found"}</p>
      <Link href="/orders" className="text-baraka-primary text-sm hover:underline">← Back to Orders</Link>
    </div>
  )

  const hasTax   = order.taxRate && order.taxRate > 0 && order.taxAmount && order.taxAmount > 0
  const subtotal = order.subtotal ?? order.totalAmount
  const balance  = order.totalAmount - order.amountPaid

  // Normalise a phone number to WhatsApp international format (no +, no spaces)
  // Rwanda: 0788123456 → 250788123456 | +250 788 123 456 → 250788123456
  function toWANumber(phone: string): string | null {
    const digits = phone.replace(/\D/g, "")
    if (digits.startsWith("250") && digits.length >= 11) return digits
    if (digits.startsWith("0")   && digits.length === 10) return "250" + digits.slice(1)
    if (digits.length >= 9) return "250" + digits.slice(-9)
    return null
  }

  function buildWhatsAppMessage(): string {
    const o = order!
    const b = business!
    const lines: string[] = []
    lines.push(`Hello ${o.customerName},`)
    lines.push("")
    lines.push(`Here is your invoice from *${b.name}*:`)
    lines.push("")
    lines.push(`📋 *Invoice #${o.orderNumber}*`)
    lines.push(`📅 ${formatDate(o.createdAt)}`)
    lines.push("")
    lines.push("*ITEMS:*")
    o.items.forEach(item => {
      const lineTotal = item.unitPrice * item.quantity
      lines.push(`▪ ${item.product.name} (${item.quantity} × ${formatRWF(item.unitPrice)}) = ${formatRWF(lineTotal)}`)
    })
    lines.push("")
    lines.push("*TOTAL:*")
    if (hasTax) {
      lines.push(`Subtotal: ${formatRWF(subtotal)}`)
      lines.push(`VAT (${Math.round(Number(o.taxRate) * 100)}%): ${formatRWF(Number(o.taxAmount))}`)
    }
    lines.push(`*Total: ${formatRWF(o.totalAmount)}*`)
    if (o.amountPaid > 0) {
      lines.push(`Amount Paid: ${formatRWF(o.amountPaid)}`)
    }
    lines.push(`*Balance Due: ${formatRWF(balance)}*`)
    lines.push("")
    lines.push("Thank you for your business! 🙏")
    if (b.phone) lines.push(b.phone)
    return lines.join("\n")
  }

  function handleShareWhatsApp() {
    const message = buildWhatsAppMessage()
    const encoded = encodeURIComponent(message)
    const waNumber = order!.customerPhone ? toWANumber(order!.customerPhone) : null
    const url = waNumber
      ? `https://wa.me/${waNumber}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
        <Link href="/orders" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          <ArrowLeft size={16} /> Back to Orders
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <MessageCircle size={16} /> Share via WhatsApp
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-baraka-primary hover:bg-baraka-dark text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Invoice — A4-like layout */}
      <div className="max-w-2xl mx-auto p-8 print:p-6 print:max-w-none">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{business.name}</h1>
            {business.phone   && <p className="text-sm text-[var(--muted)] mt-1">{business.phone}</p>}
            {business.address && <p className="text-sm text-[var(--muted)]">{business.address}</p>}
            <p className="text-sm text-[var(--muted)]">{business.email}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-baraka-primary">INVOICE</p>
            <p className="text-sm font-mono text-[var(--foreground)] mt-1">{order.orderNumber}</p>
            <p className="text-sm text-[var(--muted)] mt-1">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Billed To */}
        <div className="mb-8 p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Billed To</p>
          <p className="font-semibold text-[var(--foreground)]">{order.customerName}</p>
          {order.customerPhone && <p className="text-sm text-[var(--muted)]">{order.customerPhone}</p>}
        </div>

        {/* Line items */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-[var(--foreground)]">
              <th className="text-left text-sm font-semibold text-[var(--foreground)] pb-2">Item</th>
              <th className="text-right text-sm font-semibold text-[var(--foreground)] pb-2">Qty</th>
              <th className="text-right text-sm font-semibold text-[var(--foreground)] pb-2">Unit Price</th>
              <th className="text-right text-sm font-semibold text-[var(--foreground)] pb-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map(item => (
              <tr key={item.id} className="border-b border-[var(--border)]">
                <td className="py-3 text-sm text-[var(--foreground)]">{item.product.name}</td>
                <td className="py-3 text-sm text-right text-[var(--muted)]">{item.quantity}</td>
                <td className="py-3 text-sm text-right text-[var(--muted)]">{formatRWF(item.unitPrice)}</td>
                <td className="py-3 text-sm text-right font-medium text-[var(--foreground)]">
                  {formatRWF(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted)]">Subtotal</span>
              <span className="text-[var(--foreground)]">{formatRWF(subtotal)}</span>
            </div>
            {hasTax && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">
                  VAT ({Math.round(Number(order.taxRate) * 100)}%)
                </span>
                <span className="text-[var(--foreground)]">{formatRWF(Number(order.taxAmount))}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-[var(--border)] pt-2">
              <span className="text-[var(--foreground)]">Total</span>
              <span className="text-[var(--foreground)]">{formatRWF(order.totalAmount)}</span>
            </div>
            {order.amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Amount Paid</span>
                <span className="text-emerald-600">−{formatRWF(order.amountPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold border-t border-[var(--foreground)] pt-2 mt-1">
              <span className="text-[var(--foreground)]">Balance Due</span>
              <span className={balance > 0 ? "text-red-600" : "text-emerald-600"}>
                {formatRWF(balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Payments made */}
        {order.payments.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Payments Received</p>
            <div className="space-y-1">
              {order.payments.map(p => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">
                    {METHOD_LABELS[p.method] ?? p.method} — {formatDate(p.paidAt)}
                  </span>
                  <span className="text-emerald-600">{formatRWF(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-[var(--foreground)]">{order.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-[var(--border)] pt-6 text-center">
          <p className="text-sm text-[var(--muted)]">Thank you for your business!</p>
          <p className="text-xs text-[var(--muted)] mt-1">Generated by BarakaFlow</p>
        </div>

      </div>
    </div>
  )
}
