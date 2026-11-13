export type PhotoError = 'type' | 'size' | 'unreadable'

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function checkPhoto(file: File): PhotoError | null {
  if (!TYPES.includes(file.type)) return 'type'
  if (file.size > PHOTO_MAX_BYTES) return 'size'
  return null
}

/** Centre-crops the photo to a square and re-encodes it as a JPEG. */
export async function toSquareJpeg(file: File, size = 512): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('no blob')
    return blob
  } catch {
    throw new Error('unreadable')
  }
}
