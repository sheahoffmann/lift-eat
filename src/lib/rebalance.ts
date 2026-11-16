// "Balance my macros": when the current week's plan misses the targets (e.g. after
// switching to exact label numbers), propose the fewest meal changes that fix it —
// using only meals you can make with food you already have.
import type { WeekPlan } from './db'
import { mealsById, type MealOption } from '../data/meals'
import { checkDay, dayVariants, mealsForDay, suggestFixes, type DayCheck, type Suggestion, type Targets } from './nutrition'

/** Grocery items on hand: everything in this week's meals, pantry staples you said you have, plus extras (e.g. labeled products). */
export function itemsOnHand(plan: Pick<WeekPlan, 'picks' | 'pantryHave'>, extra: string[] = []) {
  const have = new Set<string>([...plan.pantryHave, ...extra])
  const days = Math.max(1, plan.picks.dinner.filter(Boolean).length)
  for (let d = 0; d < days; d++) for (const m of mealsForDay(plan.picks, d)) for (const ing of mealsById[m.id].ingredients) have.add(ing.item)
  return have
}

export function canMake(meal: MealOption | undefined, have: Set<string>) {
  if (!meal || meal.restaurant || meal.custom) return false
  return meal.ingredients.length > 0 && meal.ingredients.every((i) => have.has(i.item))
}

export type Rebalance = { check: DayCheck; fixes: Suggestion[]; onHand: boolean } | null

/** null when the plan is already on target. */
export function rebalancePlan(plan: Pick<WeekPlan, 'picks' | 'pantryHave' | 'portion'>, t: Targets, extraOnHand: string[] = []): Rebalance {
  const variants = dayVariants(plan.picks, plan.portion)
  const checks = variants.map((v) => checkDay(v, t))
  if (checks.every((c) => c.ok)) return null
  // Report the worst day (biggest protein gap, then calories).
  const check = [...checks].sort((a, b) => b.proteinGap - a.proteinGap || Math.abs(b.calGap) - Math.abs(a.calGap))[0]
  const have = itemsOnHand(plan, extraOnHand)
  const onHand = suggestFixes(plan.picks, plan.portion, t, 3, (id) => canMake(mealsById[id], have))
  if (onHand.length) return { check, fixes: onHand, onHand: true }
  return { check, fixes: suggestFixes(plan.picks, plan.portion, t, 3), onHand: false }
}
