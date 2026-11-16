// Turning a scanned nutrition label into catalog numbers: guess which planner
// ingredient it is, and convert per-serving values to the catalog's base unit.
import { groceryItems, type GroceryItem } from '../data/groceryItems'
import { mealOptions } from '../data/meals'
import { originalItem } from '../data/myLabels'
import type { AINutrition } from './aiNutrition'
import type { ScannedLabel } from './profile'

/** Ingredients actually used by planner meals (the ones a label can replace). */
export function mealIngredients(): GroceryItem[] {
  const ids = new Set(mealOptions.flatMap((m) => m.ingredients.map((i) => i.item)))
  return [...ids].map((id) => groceryItems[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
}

const STOP = new Set(['the', 'and', 'with', 'of', 'a', 'fully', 'cooked', 'frozen', 'style', 'single', 'pack', 'oz', 'lb', 'protein', 'powder', 'original', 'plain', 'italian', 'nonfat', 'lowfat', 'low', 'fat'])
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.replace(/(es|s)$/, ''))
    .filter((w) => w.length > 2 && !STOP.has(w))

// A few words that mean the same thing on labels vs. in the planner.
const ALIAS: Record<string, string> = { guacamole: 'guac', isolate: 'whey', casein: 'casein', verde: 'salsa' }

/** Best-guess planner ingredient for a label name, or null. */
export function guessItem(labelName: string, candidates: GroceryItem[] = mealIngredients()): string | null {
  const lw = new Set(words(labelName).flatMap((w) => [w, ALIAS[w] ?? w]))
  let best: { id: string; score: number } | null = null
  for (const c of candidates) {
    const base = originalItem(c.id) ?? c
    const cw = new Set([...words(base.name), ...words(c.id.replace(/-/g, ' '))])
    let score = 0
    for (const w of cw) if (lw.has(w)) score += w.length >= 5 ? 2 : 1
    if (score > (best?.score ?? 0)) best = { id: c.id, score }
  }
  return best && best.score >= 2 ? best.id : null
}

const MEASURES = /^(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|g|gram|grams|ml|fl|container|serving|package|pouch|bottle)$/i
const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75 }

/** Pieces in one serving for counted items: "4 meatballs (85 g)" → 4, "1 scoop" → 1, "1 cup" → 1. */
export function piecesPerServing(servingLabel: string) {
  const m = servingLabel.trim().match(/^(\d+\/\d+|[\d.]+|[½⅓⅔¼¾])\s*([a-zA-Z]+)?/)
  if (!m) return 1
  const [a, b] = m[1].split('/')
  const n = FRACTIONS[m[1]] ?? (b ? Number(a) / Number(b) : Number(m[1]))
  if (!n || !isFinite(n)) return 1
  return m[2] && MEASURES.test(m[2]) ? 1 : n
}

/** Per-serving label → per-base-unit catalog values. null if grams are needed but unknown. */
export function toCatalog(item: GroceryItem, label: AINutrition, gramsOverride?: number): ScannedLabel | null {
  let div: number
  if (item.unit === 'g') {
    const g = gramsOverride ?? label.servingGrams
    if (!g || g <= 0) return null
    div = g
  } else div = piecesPerServing(label.servingLabel)
  const r = (n: number) => Math.round((n / div) * 10000) / 10000
  return {
    name: label.name,
    cal: r(label.calories),
    protein: r(label.protein),
    carbs: r(label.carbs),
    fat: r(label.fat),
    serving: `${label.servingLabel}: ${Math.round(label.calories)} cal, ${Math.round(label.protein)} g protein`,
    scannedAt: new Date().toISOString(),
  }
}
