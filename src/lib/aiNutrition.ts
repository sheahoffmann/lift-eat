// Client for the /api/nutrition Netlify function (label photo or link → macros).

export type AINutrition = {
  name: string
  servingLabel: string
  servingGrams: number | null
  calories: number
  protein: number
  carbs: number
  fat: number
  note: string
}

/** Downscale a photo to ≤1568px JPEG (keeps uploads small and fast). */
export async function photoToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await img.decode()
    return img
  })
  const w = 'width' in bitmap ? bitmap.width : 0
  const h = 'height' in bitmap ? bitmap.height : 0
  const scale = Math.min(1, 1568 / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
}

export async function readNutrition(input: { image?: { data: string; mediaType: string }; url?: string }, passcode: string): Promise<AINutrition> {
  let r: Response
  try {
    r = await fetch('/api/nutrition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, passcode }),
    })
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.")
  }
  const body = await r.json().catch(() => ({}))
  if (r.status === 404) throw new Error('Photo and link reading only works on the live site, not the Wi-Fi test link.')
  if (!r.ok) throw new Error(body.error ?? 'Something went wrong.')
  return body as AINutrition
}
