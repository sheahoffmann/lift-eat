// Auto portions: nudge ingredient amounts in this week's meals until a day on the
// plan lands on your goals — same meals, slightly different quantities.
import { db, type Picks, type TunedMeal, type WeekPlan } from './db'
import { baseMealId, mealsById, setTunedMeals, type MealOption } from '../data/meals'
import { groceryItems } from '../data/groceryItems'
import { add, calorieRange, mealMacros, mealsForDay, round, scaledAmount, zero, type Macros } from './nutrition'
import type { MacroTargets } from './profile'

/** Build the MealOption for a tuned meal (amounts replace the base recipe's). */
export function tunedOption(t: TunedMeal): MealOption | null {
  const base = mealsById[t.base]
  if (!base) return null
  return {
    ...base,
    id: t.id,
    ingredients: base.ingredients.map((ing) =>
      t.amounts[ing.item] !== undefined && t.amounts[ing.item] !== ing.amount ? { item: ing.item, amount: t.amounts[ing.item] } : ing,
    ),
  }
}

// Register a plan's tuned meals the moment it's read from the database, so they
// exist before anything (recipes, macros, grocery list) looks them up.
db.plans.hook('reading', (p: WeekPlan) => {
  if (p?.tuned?.length) registerTuned([p])
  return p
})

/** Standard-recipe picks (tuned copies → their base meals). */
export function basePicks(p: Picks): Picks {
  return { ...p, breakfast: baseMealId(p.breakfast), lunch: baseMealId(p.lunch), snack: baseMealId(p.snack), dinner: p.dinner.map((d) => (d ? baseMealId(d) : d)), evening: p.evening ? baseMealId(p.evening) : null, extras: p.extras.map(baseMealId) }
}

/** Register every plan's tuned meals (call when plans change). */
export function registerTuned(plans: WeekPlan[]) {
  setTunedMeals(plans.flatMap((p) => (p.tuned ?? []).map(tunedOption).filter((m): m is MealOption => !!m)))
}

// Step size and bounds per ingredient. Counted items move in whole (or half) pieces.
const HALF_OK = new Set(['whey', 'casein', 'rice-cup'])
function stepFor(item: string, baseAmount: number) {
  const g = groceryItems[item]
  if (!g || g.unit === 'each') return HALF_OK.has(item) ? 0.5 : 1
  return Math.max(5, Math.round((baseAmount * 0.1) / 5) * 5) // ~10% of the recipe, in 5 g steps
}
const bounds = (base: number) => [base * 0.5, base * 1.6] as const

type Slot = { mealId: string; item: string; base: number }

/** How far a day is from the goals (lower is better). Protein short and calories out of range cost most. */
function score(day: Macros, t: MacroTargets) {
  const [lo, hi] = calorieRange({ calories: t.calories, protein: t.protein })
  let s = 0
  if (day.cal < lo) s += ((lo - day.cal) / 50) ** 2 * 10
  if (day.cal > hi) s += ((day.cal - hi) / 50) ** 2 * 10
  if (day.protein < t.protein - 5) s += ((t.protein - 5 - day.protein) / 5) ** 2 * 10
  s += ((day.cal - t.calories) / t.calories) ** 2 * 40
  s += (Math.min(0, day.protein - t.protein) / t.protein) ** 2 * 60 + (Math.max(0, day.protein - t.protein) / t.protein) ** 2 * 6
  s += ((day.carbs - t.carbs) / t.carbs) ** 2 * 12
  s += ((day.fat - t.fat) / t.fat) ** 2 * 12
  return s
}

export type TuneChange = { mealId: string; mealName: string; item: string; itemName: string; from: number; to: number; unit: 'g' | 'each' }
export type TuneResult = { changes: TuneChange[]; picks: Picks; tuned: TunedMeal[]; before: Macros; after: Macros }

/** Average day for picks with the given per-meal amounts. */
function dayFor(picks: Picks, portion: number, amounts: Record<string, Record<string, number>>) {
  const days = Math.max(1, picks.dinner.filter(Boolean).length)
  let total = zero
  for (let d = 0; d < days; d++) {
    for (const m of mealsForDay(picks, d)) {
      const meal = mealsById[m.id]
      const base = baseMealId(m.id)
      const a = amounts[base]
      const opt = a ? { ...meal, ingredients: mealsById[base].ingredients.map((i) => ({ item: i.item, amount: a[i.item] ?? i.amount })) } : meal
      total = add(total, mealMacros(opt, portion))
    }
  }
  return { cal: total.cal / days, protein: total.protein / days, carbs: total.carbs / days, fat: total.fat / days }
}

/** Find small quantity changes that bring the plan onto your goals. null if nothing helps. */
export function tunePlan(plan: Pick<WeekPlan, 'picks' | 'portion' | 'tuned' | 'id'>, t: MacroTargets, maxMoves = 14): TuneResult | null {
  // Start from the plan's current amounts (re-tuning keeps earlier tweaks).
  const amounts: Record<string, Record<string, number>> = {}
  const slots: Slot[] = []
  const days = Math.max(1, plan.picks.dinner.filter(Boolean).length)
  const seen = new Set<string>()
  for (let d = 0; d < days; d++)
    for (const m of mealsForDay(plan.picks, d)) {
      const baseId = baseMealId(m.id)
      const base = mealsById[baseId]
      if (!base || base.restaurant || base.custom || seen.has(baseId)) continue
      seen.add(baseId)
      const cur = mealsById[m.id]
      amounts[baseId] = Object.fromEntries(cur.ingredients.map((i) => [i.item, i.amount]))
      for (const ing of base.ingredients) if (groceryItems[ing.item]) slots.push({ mealId: baseId, item: ing.item, base: ing.amount })
    }

  const before = round(dayFor(plan.picks, plan.portion, {}))
  let best = score(dayFor(plan.picks, plan.portion, amounts), t)
  for (let move = 0; move < maxMoves; move++) {
    let pick: { slot: Slot; to: number; s: number } | null = null
    for (const slot of slots) {
      const cur = amounts[slot.mealId][slot.item]
      const step = stepFor(slot.item, slot.base)
      const [min, max] = bounds(slot.base)
      for (const dir of [-1, 1]) {
        const to = Math.round((cur + dir * step) * 100) / 100
        if (to < min - 1e-9 || to > max + 1e-9 || to <= 0) continue
        amounts[slot.mealId][slot.item] = to
        // Small cost per move so it prefers fewer, more meaningful changes.
        const s = score(dayFor(plan.picks, plan.portion, amounts), t) + 0.02
        amounts[slot.mealId][slot.item] = cur
        if (s < best - 1e-6 && (!pick || s < pick.s)) pick = { slot, to, s }
      }
    }
    if (!pick) break
    amounts[pick.slot.mealId][pick.slot.item] = pick.to
    best = pick.s - 0.02
  }

  // Collect what changed vs. the standard recipes.
  const tuned: TunedMeal[] = []
  const changes: TuneChange[] = []
  const tag = plan.id.replace(/[^a-z0-9]/gi, '').slice(0, 6)
  for (const [mealId, a] of Object.entries(amounts)) {
    const base = mealsById[mealId]
    const diff = base.ingredients.filter((i) => Math.abs((a[i.item] ?? i.amount) - i.amount) > 1e-9)
    if (!diff.length) continue
    tuned.push({ id: `${mealId}~t${tag}`, base: mealId, amounts: Object.fromEntries(diff.map((i) => [i.item, a[i.item]])) })
    for (const i of diff) {
      const g = groceryItems[i.item]
      changes.push({
        mealId,
        mealName: base.name,
        item: i.item,
        itemName: g.name,
        from: scaledAmount(i.item, i.amount, plan.portion),
        to: scaledAmount(i.item, a[i.item], plan.portion),
        unit: g.unit,
      })
    }
  }
  const after = round(dayFor(plan.picks, plan.portion, amounts))
  // Only worth offering if it actually moved the day closer.
  if (!changes.length || score(after, t) >= score(before, t) - 0.05) return null
  const toId = (id: string) => tuned.find((x) => x.base === baseMealId(id))?.id ?? baseMealId(id)
  const p = plan.picks
  const picks: Picks = {
    breakfast: toId(p.breakfast),
    lunch: toId(p.lunch),
    snack: toId(p.snack),
    dinner: p.dinner.map((d) => (d ? toId(d) : d)),
    evening: p.evening ? toId(p.evening) : null,
    extras: p.extras.map(toId),
  }
  return { changes, picks, tuned, before, after }
}

/** Save tuned portions into the plan (registers them right away). */
export async function applyTuning(plan: WeekPlan, r: TuneResult) {
  const next = { ...plan, picks: r.picks, tuned: r.tuned }
  registerTuned([next])
  await db.plans.update(plan.id, { picks: r.picks, tuned: r.tuned })
}

/** Back to the standard recipes for this week. */
export async function resetTuning(plan: WeekPlan) {
  await db.plans.update(plan.id, { picks: basePicks(plan.picks), tuned: [] })
}

/** "40 → 50 g", "1 → 1½ scoops" style text. */
export function amountText(c: TuneChange) {
  const n = (v: number) => (v % 1 === 0.5 ? `${Math.floor(v) || ''}½` : String(v))
  return c.unit === 'g' ? `${c.from} → ${c.to} g` : `${n(c.from)} → ${n(c.to)}`
}
