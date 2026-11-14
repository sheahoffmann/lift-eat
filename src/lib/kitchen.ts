// Turns meal ingredients into "how much do I actually use" lines, in kitchen units:
// cups/tbsp/tsp for scoopable foods, oz for meat, counts for whole items.
import { groceryItems } from '../data/groceryItems'
import type { MealOption } from '../data/meals'
import { scaledAmount } from './nutrition'

type Measure =
  | { kind: 'volume'; gPerCup: number; name: string }
  | { kind: 'liquid'; gPerCup: number; name: string }
  | { kind: 'weight'; name: string; cupsPer100g?: number; tip?: string }
  | { kind: 'count'; one: string; many: string }

const measures: Record<string, Measure> = {
  'greek-yogurt': { kind: 'volume', gPerCup: 245, name: 'nonfat Greek yogurt' },
  'egg-whites': { kind: 'volume', gPerCup: 243, name: 'liquid egg whites' },
  'cottage-cheese': { kind: 'volume', gPerCup: 226, name: 'low-fat cottage cheese' },
  'whole-milk': { kind: 'liquid', gPerCup: 244, name: 'whole milk' },
  'chicken-strips': { kind: 'weight', name: 'grilled chicken strips', cupsPer100g: 0.71, tip: 'Weigh it once on a food scale, then eyeball it after.' },
  'chicken-breast': { kind: 'weight', name: 'raw chicken breast', tip: 'About 1 large frozen breast. Weigh raw.' },
  salmon: { kind: 'weight', name: 'salmon', tip: 'About 1 frozen fillet.' },
  berries: { kind: 'volume', gPerCup: 140, name: 'frozen mixed berries' },
  broccoli: { kind: 'volume', gPerCup: 91, name: 'broccoli' },
  'green-beans': { kind: 'volume', gPerCup: 125, name: 'green beans' },
  potato: { kind: 'weight', name: 'russet potato', tip: 'About 1 medium potato (fist-sized).' },
  lettuce: { kind: 'volume', gPerCup: 47, name: 'shredded lettuce' },
  'salad-kit': { kind: 'volume', gPerCup: 50, name: 'bagged salad kit (with its dressing)' },
  granola: { kind: 'volume', gPerCup: 120, name: 'granola' },
  honey: { kind: 'volume', gPerCup: 336, name: 'honey' },
  salsa: { kind: 'volume', gPerCup: 256, name: 'salsa' },
  'light-mayo': { kind: 'volume', gPerCup: 240, name: 'light mayo' },
  marinara: { kind: 'volume', gPerCup: 250, name: 'marinara sauce' },
  'olive-oil': { kind: 'volume', gPerCup: 216, name: 'olive oil' },
  jerky: { kind: 'weight', name: 'beef jerky' },
  eggs: { kind: 'count', one: 'egg', many: 'eggs' },
  'cheese-slices': { kind: 'count', one: 'slice cheddar', many: 'slices cheddar' },
  'cottage-cup': { kind: 'count', one: 'cottage cheese cup', many: 'cottage cheese cups' },
  'string-cheese': { kind: 'count', one: 'string cheese', many: 'string cheeses' },
  'guac-cups': { kind: 'count', one: 'guacamole cup', many: 'guacamole cups' },
  'turkey-meatballs': { kind: 'count', one: 'turkey meatball', many: 'turkey meatballs' },
  banana: { kind: 'count', one: 'banana', many: 'bananas' },
  apple: { kind: 'count', one: 'apple', many: 'apples' },
  'english-muffin': { kind: 'count', one: 'English muffin', many: 'English muffins' },
  tortilla: { kind: 'count', one: 'large flour tortilla', many: 'large flour tortillas' },
  whey: { kind: 'count', one: 'scoop whey protein', many: 'scoops whey protein' },
  casein: { kind: 'count', one: 'scoop casein protein', many: 'scoops casein protein' },
  'rice-cup': { kind: 'count', one: 'microwave rice cup', many: 'microwave rice cups' },
  'tuna-pouch': { kind: 'count', one: 'tuna pouch', many: 'tuna pouches' },
  'core-power': { kind: 'count', one: 'Core Power Elite shake', many: 'Core Power Elite shakes' },
}

const FRACS: [number, string][] = [
  [0, ''],
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
  [1, ''],
]

/** 1.3 → "1⅓", 0.26 → "¼", 2 → "2". */
export function niceNumber(n: number) {
  const whole = Math.floor(n)
  const rest = n - whole
  let best = FRACS[0]
  for (const f of FRACS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f
  const w = best[0] === 1 ? whole + 1 : whole
  const frac = best[0] === 1 ? '' : best[1]
  if (!w && !frac) return '¼'
  return `${w || ''}${frac}`
}

const plural = (n: string, unit: string) => (n === '1' || /^[¼⅓½⅔¾]$/.test(n) ? unit : `${unit}s`)

/** Volume in cups → the most natural kitchen unit. */
export function volumeText(cups: number) {
  if (cups >= 0.22) {
    const n = niceNumber(cups)
    return `${n} ${plural(n, 'cup')}`
  }
  const tbsp = cups * 16
  if (tbsp >= 0.9) {
    const n = niceNumber(Math.round(tbsp * 2) / 2)
    return `${n} tbsp`
  }
  const n = niceNumber(Math.max(0.25, cups * 48))
  return `${n} tsp`
}

export type BuildLine = { amount: string; item: string; detail?: string; tip?: string }

/** Exact ingredients for one serving at this person's portion size. */
export function buildLines(meal: MealOption, portion = 1): BuildLine[] {
  if (meal.restaurant) return [{ amount: 'Order', item: meal.restaurant.order }]
  if (meal.custom) return meal.custom.groceries.map((g) => ({ amount: `${g.amount} ${g.unit}`, item: g.name }))
  return meal.ingredients.map((ing) => {
    const amt = scaledAmount(ing.item, ing.amount, portion)
    const m = measures[ing.item]
    const fallbackName = groceryItems[ing.item]?.name ?? ing.item
    if (!m) return { amount: groceryItems[ing.item]?.unit === 'g' ? `${amt} g` : `${amt}`, item: fallbackName }
    switch (m.kind) {
      case 'count':
        return { amount: String(amt), item: amt === 1 ? m.one : m.many }
      case 'volume':
        return { amount: volumeText(amt / m.gPerCup), item: m.name, detail: `${amt} g` }
      case 'liquid': {
        const floz = (amt / m.gPerCup) * 8
        return { amount: `${Math.round(floz)} fl oz`, item: m.name, detail: `${volumeText(amt / m.gPerCup)} · ${amt} g` }
      }
      case 'weight': {
        const oz = amt / 28.35
        const ozText = `${niceNumber(Math.round(oz * 4) / 4)} oz`
        const cups = m.cupsPer100g ? ` · about ${volumeText((amt / 100) * m.cupsPer100g)}` : ''
        return { amount: ozText, item: m.name, detail: `${amt} g${cups}`, tip: m.tip }
      }
    }
  })
}
