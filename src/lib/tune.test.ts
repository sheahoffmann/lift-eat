import { afterEach, describe, expect, it } from 'vitest'
import { applyMyLabels } from '../data/myLabels'
import { registerTuned, tunePlan, amountText } from './tune'
import { checkDay } from './nutrition'
import { mealsById } from '../data/meals'

const plan = { id: 'plan-123456', picks: { breakfast: 'yogurt-bowl', lunch: 'chicken-rice-bowl', snack: 'whey-milk-snack', dinner: ['meatballs-potato'], evening: null, extras: [] }, portion: 1, tuned: [] }

afterEach(() => { applyMyLabels(false); registerTuned([]) })

describe('auto portions', () => {
  it('brings a short day onto the goals by changing amounts, not meals', () => {
    applyMyLabels(true)
    const goals = { calories: 2250, protein: 190, carbs: 215, fat: 70 }
    const r = tunePlan(plan, goals)!
    expect(r).not.toBeNull()
    console.log('BEFORE', JSON.stringify(r.before), 'AFTER', JSON.stringify(r.after))
    for (const c of r.changes) console.log('  ', c.mealName, '·', c.itemName, amountText(c))
    expect(checkDay(r.after, goals).ok).toBe(true)
    expect(Math.abs(r.after.cal - goals.calories)).toBeLessThan(Math.abs(r.before.cal - goals.calories) + 1)
    // Same meals: only tuned copies of the original ids.
    expect(r.picks.breakfast.split('~')[0]).toBe('yogurt-bowl')
    registerTuned([{ ...plan, picks: r.picks, tuned: r.tuned } as never])
    for (const t of r.tuned) expect(mealsById[t.id]).toBeTruthy()
  })

  it('returns null when nothing needs changing', () => {
    applyMyLabels(true)
    const r1 = tunePlan(plan, { calories: 2250, protein: 190, carbs: 215, fat: 70 })!
    registerTuned([{ ...plan, picks: r1.picks, tuned: r1.tuned } as never])
    const again = tunePlan({ ...plan, picks: r1.picks, tuned: r1.tuned }, { calories: 2250, protein: 190, carbs: 215, fat: 70 })
    expect(again === null || again.changes.length <= r1.changes.length).toBe(true)
  })
})
