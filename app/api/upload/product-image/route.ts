import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSupabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase-server"
import sharp from "sharp"
import { randomUUID } from "crypto"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]
const MAX_BYTES      = 10 * 1024 * 1024  // 10 MB raw input limit

// POST /api/upload/product-image
// Accepts a single image file in FormData field "file".
// Resizes to max 800×800px, converts to WebP at 82% quality, uploads to Supabase Storage.
// Returns { url: string }
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const formData = await request.formData()
    const file     = formData.get("file") as File | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Use JPEG, PNG, WebP or HEIC." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 })
    }

    // Read file bytes
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── COMPRESSION ──────────────────────────────────────────────────────────
    // Resize to fit within 800×800px (preserves aspect ratio, never upscales),
    // strip metadata, convert to WebP at 82% quality.
    // Benchmark: a 4 MB phone JPEG → ~70–120 KB WebP (35–55× smaller)
    const compressed = await sharp(buffer)
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .withMetadata({ orientation: undefined }) // strip GPS/EXIF, keep orientation
      .toBuffer()

    // ── UPLOAD ───────────────────────────────────────────────────────────────
    const filename  = `${session.user.businessId}/${randomUUID()}.webp`
    const supabase  = getSupabaseAdmin()

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, compressed, {
        contentType:  "image/webp",
        cacheControl: "3600",
        upsert:       false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename)

    return NextResponse.json({ url: publicUrl })

  } catch (error) {
    console.error("Upload error:", error)
    const message = error instanceof Error ? error.message : "Failed to upload image"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/upload/product-image?path=<storage-path>
// Removes a product image from Supabase Storage when a product is deleted or image replaced.
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!["OWNER", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const path = request.nextUrl.searchParams.get("path")
    if (!path) return NextResponse.json({ error: "No path provided" }, { status: 400 })

    // Safety: only allow deleting files under this business's folder
    if (!path.startsWith(session.user.businessId + "/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    await supabase.storage.from(STORAGE_BUCKET).remove([path])

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 })
  }
}
