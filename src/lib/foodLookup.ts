// Barcode → nutrition. Open Food Facts first, USDA FoodData Central as fallback.
// Only the barcode number is sent; nothing personal.

export type ScannedFood = {
  barcode: string
  name: string
  servingLabel: string
  servingGrams: number | null
  per100: { cal: number; protein: number; carbs: number; fat: number } | null
  perServing: { cal: number; protein: number; carbs: number; fat: number } | null
  source: 'Open Food Facts' | 'USDA'
}

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0)

async function openFoodFacts(code: string): Promise<ScannedFood | null> {
  const r = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_size,serving_quantity`,
  )
  if (!r.ok) return null
  const j = await r.json()
  if (j.status !== 1 || !j.product) return null
  const p = j.product
  const n = p.nutriments ?? {}
  const kcal100 = num(n['energy-kcal_100g']) || num(n['energy_100g']) / 4.184
  const per100 = kcal100 ? { cal: kcal100, protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g) } : null
  const kcalServ = num(n['energy-kcal_serving'])
  const perServing = kcalServ
    ? { cal: kcalServ, protein: num(n.proteins_serving), carbs: num(n.carbohydrates_serving), fat: num(n.fat_serving) }
    : per100 && num(p.serving_quantity)
      ? scale(per100, num(p.serving_quantity) / 100)
      : null
  if (!per100 && !perServing) return null
  return {
    barcode: code,
    name: [p.brands?.split(',')[0], p.product_name].filter(Boolean).join(' ').trim() || 'Scanned food',
    servingLabel: p.serving_size || (num(p.serving_quantity) ? `${num(p.serving_quantity)} g` : '1 serving'),
    servingGrams: num(p.serving_quantity) || null,
    per100,
    perServing,
    source: 'Open Food Facts',
  }
}

async function usda(code: string, apiKey: string): Promise<ScannedFood | null> {
  const r = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(code)}&dataType=Branded&pageSize=1&api_key=${encodeURIComponent(apiKey)}`)
  if (!r.ok) return null
  const j = await r.json()
  const f = j.foods?.[0]
  if (!f || (f.gtinUpc && !f.gtinUpc.endsWith(code.replace(/^0+/, '')) && f.gtinUpc !== code)) return null
  const get = (id: number) => num(f.foodNutrients?.find((x: { nutrientId: number; value: number }) => x.nutrientId === id)?.value)
  // Branded foods report nutrients per 100 g.
  const per100 = { cal: get(1008), protein: get(1003), carbs: get(1005), fat: get(1004) }
  const grams = f.servingSizeUnit?.toLowerCase() === 'g' ? num(f.servingSize) : null
  return {
    barcode: code,
    name: [f.brandName || f.brandOwner, f.description].filter(Boolean).join(' '),
    servingLabel: f.householdServingFullText || (grams ? `${grams} g` : '1 serving'),
    servingGrams: grams,
    per100,
    perServing: grams ? scale(per100, grams / 100) : null,
    source: 'USDA',
  }
}

export function scale(m: { cal: number; protein: number; carbs: number; fat: number }, f: number) {
  return { cal: m.cal * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f }
}

export async function lookupBarcode(code: string, usdaKey = 'DEMO_KEY'): Promise<ScannedFood | null> {
  try {
    const off = await openFoodFacts(code)
    if (off) return off
  } catch {
    /* fall through */
  }
  try {
    return await usda(code, usdaKey)
  } catch {
    return null
  }
}
