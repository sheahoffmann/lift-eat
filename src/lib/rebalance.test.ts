import { afterEach, describe, expect, it } from 'vitest'
import { canMake, itemsOnHand, rebalancePlan } from './rebalance'
import { applyMyLabels, myLabels } from '../data/myLabels'
import { mealsById } from '../data/meals'
import { checkDay, dayVariants } from './nutrition'

const plan = {
  picks: { breakfast: 'yogurt-bowl', lunch: 'chicken-rice-bowl', snack: 'snack-shake', dinner: ['meatballs-potato'], evening: null, extras: [] },
  pantryHave: [],
  portion: 1,
}
const t = { calories: 2400, protein: 215 } // a tougher target, so the plan misses it

afterEach(() => applyMyLabels(false))

describe('balance my macros', () => {
  it('only proposes meals you can make with food on hand, and they hit the targets', () => {
    applyMyLabels(true)
    const r = rebalancePlan(plan, t, Object.keys(myLabels))
    const base = dayVariants(plan.picks, 1)[0]
    expect(r).not.toBeNull()
    if (!r) return
    expect(r.fixes.length).toBeGreaterThan(0)
    if (r.onHand) {
      const have = itemsOnHand(plan, Object.keys(myLabels))
      for (const f of r.fixes)
        for (const c of f.changes) {
          const id = c.kind === 'swap' || c.kind === 'swapDinner' ? c.to : c.kind === 'addExtra' ? c.id : c.kind === 'evening' ? c.to : null
          if (id) expect(canMake(mealsById[id], have)).toBe(true)
        }
    }
    for (const f of r.fixes) for (const v of f.variants) expect(checkDay(v, t).ok).toBe(true)
  })

  it('returns null when the plan is already on target', () => {
    const fixed = rebalancePlan(plan, { calories: Math.round(dayVariants(plan.picks, 1)[0].cal), protein: 100 })
    expect(fixed).toBeNull()
  })
})
