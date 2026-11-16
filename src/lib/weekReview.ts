// "Check my week": the plan's daily totals vs. your goals, the macro split, and a
// plain-language verdict. Also a per-meal before → after when label numbers change.
import type { Picks } from './db'
import type { MacroTargets } from './profile'
import { mealsById } from '../data/meals'
import { add, calorieRange, dayVariants, mealMacros, mealsForDay, round, zero, type Macros } from './nutrition'

export type Split = { protein: number; carbs: number; fat: number }

export function splitOf(m: Macros): Split {
  const cal = m.protein * 4 + m.carbs * 4 + m.fat * 9 || 1
  return { protein: Math.round((m.protein * 400) / cal), carbs: Math.round((m.carbs * 400) / cal), fat: Math.round((m.fat * 900) / cal) }
}

/** Average day of the plan (dinners alternate, so average the variants). */
export function planDay(picks: Picks, portion: number): Macros {
  const v = dayVariants(picks, portion)
  const s = v.reduce(add, zero)
  return round({ cal: s.cal / v.length, protein: s.protein / v.length, carbs: s.carbs / v.length, fat: s.fat / v.length })
}

export type Line = { tone: 'good' | 'note' | 'fix'; text: string }

/** Verdict lines, most important first. Protein + calories decide; carbs/fat get gentle notes. */
export function verdict(day: Macros, t: MacroTargets): { ok: boolean; lines: Line[] } {
  const [lo, hi] = calorieRange({ calories: t.calories, protein: t.protein })
  const lines: Line[] = []
  const calOk = day.cal >= lo && day.cal <= hi
  const proteinOk = day.protein >= t.protein - 5
  lines.push(
    calOk
      ? { tone: 'good', text: `Calories ${day.cal.toLocaleString()}: inside your ${lo.toLocaleString()}–${hi.toLocaleString()} range.` }
      : { tone: 'fix', text: `Calories ${day.cal.toLocaleString()}: ${day.cal < lo ? `${lo - day.cal} under` : `${day.cal - hi} over`} your ${lo.toLocaleString()}–${hi.toLocaleString()} range.` },
  )
  lines.push(
    proteinOk
      ? { tone: 'good', text: `Protein ${day.protein} g: ${day.protein >= t.protein ? `${day.protein - t.protein} g over your goal, good on a cut.` : 'right on your goal.'}` }
      : { tone: 'fix', text: `Protein ${day.protein} g: ${t.protein - day.protein} g short of your ${t.protein} g goal.` },
  )
  // Within ~15% (or 15 g) counts as fine for carbs and fat.
  const soft = (name: string, got: number, goal: number, tip: string) => {
    const diff = got - goal
    if (Math.abs(diff) <= Math.max(15, goal * 0.15)) lines.push({ tone: 'good', text: `${name} ${got} g: close to your ${goal} g goal.` })
    else lines.push({ tone: 'note', text: `${name} ${got} g: ${Math.abs(diff)} g ${diff < 0 ? 'under' : 'over'} your ${goal} g goal. ${diff < 0 ? tip : ''}`.trim() })
  }
  soft('Carbs', day.carbs, t.carbs, 'If hard sessions feel flat, add half a rice cup or a banana before them.')
  soft('Fat', day.fat, t.fat, '')
  return { ok: calOk && proteinOk, lines }
}

export type MealChange = { id: string; name: string; before: Macros; after: Macros }

/** Macros per planned meal right now (for a before/after comparison). */
export function mealSnapshot(picks: Picks, portion: number): Record<string, Macros> {
  const days = Math.max(1, picks.dinner.filter(Boolean).length)
  const out: Record<string, Macros> = {}
  for (let d = 0; d < days; d++) for (const m of mealsForDay(picks, d)) out[m.id] ??= round(mealMacros(mealsById[m.id], portion))
  return out
}

export function mealChanges(before: Record<string, Macros>, after: Record<string, Macros>): MealChange[] {
  return Object.keys(after)
    .filter((id) => before[id] && (before[id].cal !== after[id].cal || before[id].protein !== after[id].protein || before[id].fat !== after[id].fat || before[id].carbs !== after[id].carbs))
    .map((id) => ({ id, name: mealsById[id]?.name ?? id, before: before[id], after: after[id] }))
}
