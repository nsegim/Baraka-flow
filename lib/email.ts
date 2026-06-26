import { Resend } from "resend"

// Sender address — must be from a verified Resend domain.
// Falls back to onboarding@resend.dev for dev/testing.
const FROM = process.env.EMAIL_FROM ?? "BarakaFlow <onboarding@resend.dev>"

function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

// ── ORDER CONFIRMATION ────────────────────────────────────────────────────────

interface OrderConfirmationParams {
  to:           string
  businessName: string
  orderNumber:  string
  customerName: string
  items: { name: string; quantity: number; unitPrice: number }[]
  totalAmount:  number
  currency?:    string
}

export async function sendOrderConfirmation(params: OrderConfirmationParams) {
  const { to, businessName, orderNumber, customerName, items, totalAmount, currency = "RWF" } = params

  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${currency} ${(i.unitPrice * i.quantity).toLocaleString()}</td>
    </tr>`
  ).join("")

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0E3A43;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">BarakaFlow</h1>
        <p style="color:#68abaf;margin:4px 0 0;font-size:13px">${businessName}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 8px;font-size:18px">Order Confirmation</h2>
        <p style="color:#666;margin:0 0 24px">Hi ${customerName}, your order has been received.</p>

        <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0;font-size:13px;color:#888">Order number</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#2A9D8F">${orderNumber}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">Item</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#888">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:12px;font-weight:700;font-size:15px">Total</td>
              <td style="padding:12px;font-weight:700;font-size:15px;text-align:right;color:#2A9D8F">${currency} ${totalAmount.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <p style="color:#999;font-size:12px;margin-top:32px;text-align:center">
          This is an automated confirmation from ${businessName} via BarakaFlow.
        </p>
      </div>
    </div>
  `

  const resend = getResend()
  if (!resend) return
  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: `Order ${orderNumber} confirmed — ${businessName}`,
    html,
  })
}

// ── PASSWORD RESET ────────────────────────────────────────────────────────────

interface PasswordResetParams {
  to:       string
  name:     string
  resetUrl: string
}

export async function sendPasswordResetEmail(params: PasswordResetParams) {
  const { to, name, resetUrl } = params

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0E3A43;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">BarakaFlow</h1>
        <p style="color:#68abaf;margin:4px 0 0;font-size:13px">Inventory Management</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <h2 style="margin:0 0 8px;font-size:18px">Reset Your Password</h2>
        <p style="color:#666;margin:0 0 24px">Hi ${name}, we received a request to reset your BarakaFlow password.</p>

        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}"
             style="display:inline-block;background:#2A9D8F;color:#fff;text-decoration:none;
                    padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
            Reset Password
          </a>
        </div>

        <p style="color:#888;font-size:13px">
          This link expires in <strong>1 hour</strong>.
          If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color:#bbb;font-size:12px;margin-top:24px;word-break:break-all">
          Or copy this link: ${resetUrl}
        </p>
      </div>
    </div>
  `

  const resend = getResend()
  if (!resend) return
  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: "Reset your BarakaFlow password",
    html,
  })
}

// ── LOW STOCK ALERT ───────────────────────────────────────────────────────────

interface LowStockAlertParams {
  to:           string
  businessName: string
  products: { name: string; sku?: string | null; stock: number; minStock: number }[]
}

export async function sendLowStockAlert(params: LowStockAlertParams) {
  const { to, businessName, products } = params

  const rows = products.map(p =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${p.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888">${p.sku ?? "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${p.stock === 0 ? "#dc2626" : "#d97706"};font-weight:700">
        ${p.stock === 0 ? "Out of stock" : p.stock}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:#888">${p.minStock}</td>
    </tr>`
  ).join("")

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0E3A43;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:22px">BarakaFlow</h1>
        <p style="color:#68abaf;margin:4px 0 0;font-size:13px">${businessName}</p>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="width:40px;height:40px;background:#fef3c7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px">⚠️</div>
          <div>
            <h2 style="margin:0;font-size:18px">Low Stock Alert</h2>
            <p style="margin:4px 0 0;color:#666;font-size:14px">${products.length} product${products.length !== 1 ? "s" : ""} need restocking</p>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">Product</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888">SKU</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888">Stock</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#888">Min</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="color:#999;font-size:12px;margin-top:32px;text-align:center">
          Automated alert from ${businessName} via BarakaFlow.
        </p>
      </div>
    </div>
  `

  const resend = getResend()
  if (!resend) return
  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: `⚠️ Low stock alert — ${products.length} product${products.length !== 1 ? "s" : ""} need restocking`,
    html,
  })
}
