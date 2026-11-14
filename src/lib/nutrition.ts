// Nutrition math for the planner: meal macros, day totals, target checks
// and "fix it" suggestions when a week's picks miss the targets.
import { groceryItems } from '../data/groceryItems'
import { mealsById, optionsFor, slotMeta, type MealOption, type Slot } from '../data/meals'
import type { Picks } from './db'

export type Macros = { cal: number; protein: number; carbs: number; fat: number }
export const zero: Macros = { cal: 0, protein: 0, carbs: 0, fat: 0 }

export const add = (a: Macros, b: Macros): Macros => ({
  cal: a.cal + b.cal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
})

/** Base plan the meal portions are written for. */
export const BASE_CALORIES = 2250

/** Ingredient scale for a calorie target, rounded to 5%. */
export function portionFor(calorieTarget: number) {
  const f = calorieTarget / BASE_CALORIES
  return Math.min(1.25, Math.max(0.7, Math.round(f * 20) / 20))
}

/** Weighed ingredients scale; counted ones (eggs, bottles, cups) stay whole. */
export function scaledAmount(itemId: string, amount: number, portion: number) {
  const item = groceryItems[itemId]
  return item?.unit === 'g' ? Math.round(amount * portion) : amount
}

export function mealMacros(meal: MealOption, portion = 1): Macros {
  const fixed = meal.restaurant ?? meal.custom
  if (fixed) {
    const { cal, protein, carbs, fat } = fixed
    return { cal, protein, carbs, fat }
  }
  return meal.ingredients.reduce((sum, ing) => {
    const item = groceryItems[ing.item]
    if (!item) return sum
    const amt = scaledAmount(ing.item, ing.amount, portion)
    return add(sum, { cal: item.cal * amt, protein: item.protein * amt, carbs: item.carbs * amt, fat: item.fat * amt })
  }, zero)
}

export const round = (m: Macros): Macros => ({
  cal: Math.round(m.cal),
  protein: Math.round(m.protein),
  carbs: Math.round(m.carbs),
  fat: Math.round(m.fat),
})

/** Meal ids eaten on a given plan day (dinners alternate by day index). */
export function mealsForDay(picks: Picks, dayIndex: number) {
  const ids: { slot: Slot | 'extra'; id: string }[] = [
    { slot: 'breakfast', id: picks.breakfast },
    { slot: 'lunch', id: picks.lunch },
    { slot: 'snack', id: picks.snack },
  ]
  const dinners = picks.dinner.filter(Boolean)
  if (dinners.length) ids.push({ slot: 'dinner', id: dinners[dayIndex % dinners.length] })
  if (picks.evening) ids.push({ slot: 'evening', id: picks.evening })
  for (const e of picks.extras) ids.push({ slot: 'extra', id: e })
  return ids.filter((x) => x.id && mealsById[x.id])
}

/** Distinct day variants (1, or 2 when dinners alternate). */
export function dayVariants(picks: Picks, portion: number): Macros[] {
  const n = Math.max(1, picks.dinner.filter(Boolean).length)
  return Array.from({ length: n }, (_, d) =>
    mealsForDay(picks, d).reduce((sum, m) => add(sum, mealMacros(mealsById[m.id], portion)), zero),
  )
}

export type Targets = { calories: number; protein: number }

/** Fuel range: target −200 / +100 calories; protein at least target −5 g. */
export function calorieRange(t: Targets): [number, number] {
  return [t.calories - 200, t.calories + 100]
}

export type DayCheck = {
  ok: boolean
  calStatus: 'under' | 'ok' | 'over'
  proteinOk: boolean
  calGap: number // + means need more calories, − means too many
  proteinGap: number // + means need more protein
}

export function checkDay(m: Macros, t: Targets): DayCheck {
  const [lo, hi] = calorieRange(t)
  const cal = Math.round(m.cal)
  const calStatus = cal < lo ? 'under' : cal > hi ? 'over' : 'ok'
  const proteinGap = Math.max(0, Math.round(t.protein - 5 - m.protein))
  return {
    ok: calStatus === 'ok' && proteinGap === 0,
    calStatus,
    proteinOk: proteinGap === 0,
    calGap: calStatus === 'under' ? lo - cal : calStatus === 'over' ? hi - cal : 0,
    proteinGap,
  }
}

export function isComplete(p: Picks) {
  return Boolean(p.breakfast && p.lunch && p.snack && p.dinner.filter(Boolean).length)
}

// ---------- Fix-it suggestions ----------

export type Change =
  | { kind: 'swap'; slot: 'breakfast' | 'lunch' | 'snack'; from: string; to: string }
  | { kind: 'swapDinner'; index: number; from: string; to: string }
  | { kind: 'evening'; from: string | null; to: string | null }
  | { kind: 'addExtra'; id: string }
  | { kind: 'removeExtra'; id: string }

export type Suggestion = {
  changes: Change[]
  picks: Picks
  /** Average change in daily macros. */
  delta: Macros
  variants: Macros[]
}

function applyChange(p: Picks, c: Change): Picks {
  switch (c.kind) {
    case 'swap':
      return { ...p, [c.slot]: c.to }
    case 'swapDinner': {
      const dinner = [...p.dinner]
      dinner[c.index] = c.to
      return { ...p, dinner }
    }
    case 'evening':
      return { ...p, evening: c.to }
    case 'addExtra':
      return { ...p, extras: [...p.extras, c.id] }
    case 'removeExtra':
      return { ...p, extras: p.extras.filter((e) => e !== c.id) }
  }
}

function singleChanges(p: Picks): Change[] {
  const out: Change[] = []
  for (const slot of ['breakfast', 'lunch', 'snack'] as const) {
    for (const o of optionsFor(slot)) if (o.id !== p[slot]) out.push({ kind: 'swap', slot, from: p[slot], to: o.id })
  }
  p.dinner.forEach((d, index) => {
    for (const o of optionsFor('dinner'))
      if (!p.dinner.includes(o.id)) out.push({ kind: 'swapDinner', index, from: d, to: o.id })
  })
  for (const o of [null, ...optionsFor('evening').map((e) => e.id)])
    if (o !== p.evening) out.push({ kind: 'evening', from: p.evening, to: o })
  for (const e of optionsFor('extra')) {
    if (p.extras.includes(e.id)) out.push({ kind: 'removeExtra', id: e.id })
    else out.push({ kind: 'addExtra', id: e.id })
  }
  return out
}

const slotOf = (c: Change) =>
  c.kind === 'swap' ? c.slot : c.kind === 'swapDinner' ? `dinner${c.index}` : c.kind === 'evening' ? 'evening' : `extra:${c.id}`

const avg = (ms: Macros[]) => {
  const s = ms.reduce(add, zero)
  return { cal: s.cal / ms.length, protein: s.protein / ms.length, carbs: s.carbs / ms.length, fat: s.fat / ms.length }
}

/** How far a set of day variants is from the targets (0 = on target). */
function distance(variants: Macros[], t: Targets) {
  return variants.reduce((d, v) => {
    const c = checkDay(v, t)
    // Missing protein matters most; then calories outside the range; then distance from the target itself.
    return d + c.proteinGap * 12 + Math.abs(c.calGap) * 2 + Math.abs(v.cal - t.calories) * 0.05
  }, 0)
}

/** Fewest changes first (1, then 2). Up to `limit` suggestions that put every day on target. */
export function suggestFixes(picks: Picks, portion: number, t: Targets, limit = 3): Suggestion[] {
  if (!isComplete(picks)) return []
  const base = dayVariants(picks, portion)
  if (base.every((v) => checkDay(v, t).ok)) return []
  const baseAvg = avg(base)

  const evaluate = (changes: Change[]): Suggestion | null => {
    const next = changes.reduce(applyChange, picks)
    if (next.extras.length > 2) return null
    const variants = dayVariants(next, portion)
    if (!variants.every((v) => checkDay(v, t).ok)) return null
    const a = avg(variants)
    return {
      changes,
      picks: next,
      variants,
      delta: { cal: a.cal - baseAvg.cal, protein: a.protein - baseAvg.protein, carbs: a.carbs - baseAvg.carbs, fat: a.fat - baseAvg.fat },
    }
  }

  // Prefer swapping meals over adding extras: extras get a small penalty.
  const cost = (s: Suggestion) =>
    distance(s.variants, t) + s.changes.filter((c) => c.kind === 'addExtra').length * 15

  // Beam search: depth 1 and 2 are effectively exhaustive; deeper levels keep the
  // most promising partial plans. Stops at the first depth that finds working plans,
  // so suggestions always use the fewest changes.
  const BEAM = 60
  let frontier: { changes: Change[]; picks: Picks }[] = [{ changes: [], picks }]
  const seen = new Set<string>([JSON.stringify(picks)])

  for (let depth = 1; depth <= 5; depth++) {
    const found: Suggestion[] = []
    const next: { changes: Change[]; picks: Picks; d: number }[] = []
    for (const node of frontier) {
      const used = new Set(node.changes.map(slotOf))
      for (const c of singleChanges(node.picks)) {
        if (used.has(slotOf(c))) continue
        const p2 = applyChange(node.picks, c)
        if (p2.extras.length > 2) continue
        const key = JSON.stringify({ ...p2, extras: [...p2.extras].sort() })
        if (seen.has(key)) continue
        seen.add(key)
        const changes = [...node.changes, c]
        const s = evaluate(changes)
        if (s) found.push(s)
        else next.push({ changes, picks: p2, d: distance(dayVariants(p2, portion), t) })
      }
    }
    if (found.length) return found.sort((a, b) => cost(a) - cost(b)).slice(0, limit)
    frontier = next.sort((a, b) => a.d - b.d).slice(0, BEAM)
    if (!frontier.length) break
  }
  return []
}

export function describeChange(c: Change): string {
  const name = (id: string | null) => (id ? mealsById[id]?.name ?? id : 'nothing')
  switch (c.kind) {
    case 'swap':
      return `${slotMeta[c.slot].label}: ${name(c.from)} → ${name(c.to)}`
    case 'swapDinner':
      return `Dinner: ${name(c.from)} → ${name(c.to)}`
    case 'evening':
      return c.from ? (c.to ? `Evening: ${name(c.from)} → ${name(c.to)}` : `Drop evening ${name(c.from)}`) : `Add evening: ${name(c.to)}`
    case 'addExtra':
      return `Add: ${name(c.id)}`
    case 'removeExtra':
      return `Drop: ${name(c.id)}`
  }
}

/** Plain-language summary of what's off, e.g. "38 g short on protein · 120 cal under". */
export function describeGap(check: DayCheck) {
  const parts: string[] = []
  if (check.proteinGap > 0) parts.push(`${check.proteinGap} g short on protein`)
  if (check.calStatus === 'under') parts.push(`${check.calGap} cal under your range`)
  if (check.calStatus === 'over') parts.push(`${-check.calGap} cal over your range`)
  return parts.join(' · ')
}
