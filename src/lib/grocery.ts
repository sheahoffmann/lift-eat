// Builds the week's grocery list from the locked meal picks.
// Perishables (keep < 7 days) are split: days 1–3 on the shop list,
// days 4–7 on a mid-week top-up list. Restaurant meals are skipped.
import { groceryItems, sectionOrder, type GroceryItem, type StoreSection } from '../data/groceryItems'
import { mealsById } from '../data/meals'
import type { Picks } from './db'
import { mealsForDay, scaledAmount } from './nutrition'

export type GroceryLine = {
  key: string // itemId + list, used for check-off
  item: GroceryItem
  list: 'shop' | 'topup'
  amount: number // base units needed
  packs: number
  usedIn: string[]
}

export type GroceryList = {
  shop: Record<StoreSection, GroceryLine[]>
  topup: GroceryLine[]
  topupDay: number // plan day index for the top-up trip
  skipped: GroceryItem[] // already in the kitchen
  restaurantMeals: string[]
}

export const PLAN_DAYS = 7
const TOPUP_DAY = 3 // 4th day of the plan

// Free-text items from user-added meals (e.g. "Whole milk, 16 oz").
const customItems = new Map<string, GroceryItem>()
const customItemId = (name: string, unit: string) => `custom:${name.trim().toLowerCase()}|${unit.trim().toLowerCase()}`
function customItem(name: string, unit: string): GroceryItem {
  return {
    id: customItemId(name, unit),
    name: name.trim(),
    section: 'Other',
    unit: 'each',
    cal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    packSize: 1,
    packLabel: unit.trim(),
    shelfDays: 30,
    customUnit: unit.trim(),
  }
}
const itemFor = (id: string) => groceryItems[id] ?? customItems.get(id)

export function weekIngredientTotals(picks: Picks, portion: number) {
  // itemId → [amount for days before top-up, amount from top-up day on]
  const totals = new Map<string, { early: number; late: number; usedIn: Set<string> }>()
  const restaurant = new Set<string>()
  for (let d = 0; d < PLAN_DAYS; d++) {
    for (const { id } of mealsForDay(picks, d)) {
      const meal = mealsById[id]
      if (meal.restaurant) {
        restaurant.add(meal.name)
        continue
      }
      if (meal.custom) {
        for (const g of meal.custom.groceries) {
          const id = customItemId(g.name, g.unit)
          customItems.set(id, customItem(g.name, g.unit))
          const t = totals.get(id) ?? { early: 0, late: 0, usedIn: new Set<string>() }
          t.early += g.amount // custom items aren't split into a top-up
          t.usedIn.add(meal.name)
          totals.set(id, t)
        }
        continue
      }
      for (const ing of meal.ingredients) {
        const amt = scaledAmount(ing.item, ing.amount, portion)
        const t = totals.get(ing.item) ?? { early: 0, late: 0, usedIn: new Set<string>() }
        if (d < TOPUP_DAY) t.early += amt
        else t.late += amt
        t.usedIn.add(meal.name)
        totals.set(ing.item, t)
      }
    }
  }
  return { totals, restaurant: [...restaurant] }
}

/** Grocery items in this plan that keep a long time, for the "still in your kitchen?" check. */
export function stapleCandidates(picks: Picks, portion: number) {
  const { totals } = weekIngredientTotals(picks, portion)
  return [...totals.keys()]
    .map((id) => itemFor(id)!)
    .filter((i) => i && (i.staple || i.frozen))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function buildGroceryList(picks: Picks, portion: number, pantryHave: string[] = []): GroceryList {
  const { totals, restaurant } = weekIngredientTotals(picks, portion)
  const shop = Object.fromEntries(sectionOrder.map((s) => [s, [] as GroceryLine[]])) as Record<StoreSection, GroceryLine[]>
  const topup: GroceryLine[] = []
  const skipped: GroceryItem[] = []

  for (const [id, t] of totals) {
    const item = itemFor(id)
    if (!item) continue
    if (pantryHave.includes(id)) {
      skipped.push(item)
      continue
    }
    const usedIn = [...t.usedIn]
    const perishable = item.shelfDays < PLAN_DAYS
    const mk = (list: 'shop' | 'topup', amount: number): GroceryLine => ({
      key: `${id}:${list}`,
      item,
      list,
      amount,
      packs: Math.max(1, Math.ceil(amount / item.packSize - 1e-9)),
      usedIn,
    })
    if (perishable && t.late > 0) {
      if (t.early > 0) shop[item.section].push(mk('shop', t.early))
      topup.push(mk('topup', t.late))
    } else {
      shop[item.section].push(mk('shop', t.early + t.late))
    }
  }
  for (const s of sectionOrder) shop[s].sort((a, b) => a.item.name.localeCompare(b.item.name))
  topup.sort((a, b) => a.item.name.localeCompare(b.item.name))
  return { shop, topup, topupDay: TOPUP_DAY, skipped, restaurantMeals: restaurant }
}

/** "2 × 32 oz tub" or "7 bananas". */
export function packText(line: GroceryLine) {
  const { item, packs } = line
  if (item.customUnit != null) return `${Math.round(line.amount * 10) / 10} ${item.customUnit} for the week`
  if (item.packSize === 1) return `${packs} ${item.packLabel}${packs === 1 ? '' : item.packLabel.endsWith('h') ? 'es' : 's'}`
  return `${packs} × ${item.packLabel}`
}

/** What the week actually uses, in US units. */
export function needText(line: GroceryLine) {
  const { item, amount } = line
  if (item.customUnit != null) return ''
  if (item.unit === 'each') return item.packSize === 1 ? '' : `uses ${amount}`
  const oz = amount / 28.35
  return oz >= 32 ? `uses ${(oz / 16).toFixed(1)} lb` : `uses ${Math.round(oz)} oz`
}

export function listAsText(list: GroceryList, title: string, topupLabel: string) {
  const lines: string[] = [title, '']
  for (const s of sectionOrder) {
    const rows = list.shop[s]
    if (!rows.length) continue
    lines.push(s.toUpperCase())
    for (const r of rows) lines.push(`☐ ${r.item.name}: ${packText(r)}`)
    lines.push('')
  }
  if (list.topup.length) {
    lines.push(`MID-WEEK TOP-UP (${topupLabel})`)
    for (const r of list.topup) lines.push(`☐ ${r.item.name}: ${packText(r)}`)
  }
  return lines.join('\n').trim()
}
