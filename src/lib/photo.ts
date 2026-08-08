/** Edge of the stored portrait. 256 is the largest size any surface renders
 *  (the editor preview card) and small enough that a full custom squad still
 *  fits in localStorage. */
export const PHOTO_SIZE = 256
const QUALITY = 0.8

/**
 * File → centre-cropped 256×256 JPEG data URL, using nothing but the platform:
 * an object URL, an <img>, and a canvas. No decoder, no dependency, no upload.
 */
export function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('not an image'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = PHOTO_SIZE
        canvas.height = PHOTO_SIZE
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        // Square centre crop, so a portrait and a landscape shot both end up as
        // the same card-shaped head-and-shoulders.
        const side = Math.min(img.naturalWidth, img.naturalHeight)
        const sx = (img.naturalWidth - side) / 2
        const sy = (img.naturalHeight - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      } catch (err) {
        reject(err instanceof Error ? err : new Error('resize failed'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('could not decode image'))
    }
    img.src = url
  })
}

/** Rough on-disk cost of a data URL, for the storage hint in the editor. */
export function photoWeightKB(dataUrl: string): number {
  return Math.round((dataUrl.length * 0.75) / 1024)
}
