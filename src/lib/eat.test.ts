import { describe, expect, it } from 'vitest'
import { mealOptions, mealsById, optionsFor } from '../data/meals'
import { groceryItems } from '../data/groceryItems'
import type { Picks } from './db'
import { checkDay, dayVariants, mealMacros, portionFor, suggestFixes, round } from './nutrition'
import { buildGroceryList, stapleCandidates } from './grocery'

const athletic = { calories: 2250, protein: 190 }
const glute = { calories: 1800, protein: 125 }

const picks = (p: Partial<Picks>): Picks => ({
  breakfast: 'yogurt-bowl',
  lunch: 'chicken-rice-bowl',
  snack: 'snack-shake',
  dinner: ['chicken-rice-veg'],
  evening: null,
  extras: [],
  ...p,
})

describe('meal data', () => {
  it('every ingredient exists in the grocery catalog', () => {
    for (const m of mealOptions) for (const i of m.ingredients) expect(groceryItems[i.item], `${m.id} → ${i.item}`).toBeDefined()
  })

  it('computed macros stay close to the planned numbers', () => {
    const expected: Record<string, [number, number]> = {
      'yogurt-bowl': [500, 52],
      'egg-mug': [420, 42],
      'shake-banana': [335, 43],
      'chicken-rice-bowl': [600, 55],
      'chipotle-bowl': [560, 66],
      'tuna-wrap': [480, 42],
      'snack-shake': [230, 42],
      'jerky-apple': [255, 21],
      'cottage-fruit': [200, 19],
      'chicken-rice-veg': [620, 58],
      'salmon-potato': [650, 40],
      'meatballs-potato': [560, 37],
      'cottage-cup': [140, 19],
      'casein-shake': [120, 24],
    }
    for (const [id, [cal, p]] of Object.entries(expected)) {
      const m = round(mealMacros(mealsById[id]))
      expect(Math.abs(m.cal - cal), `${id} cal ${m.cal}`).toBeLessThanOrEqual(cal * 0.1)
      expect(Math.abs(m.protein - p), `${id} protein ${m.protein}`).toBeLessThanOrEqual(5)
    }
  })

  it('portion scales by calorie target', () => {
    expect(portionFor(2250)).toBe(1)
    expect(portionFor(1800)).toBe(0.8)
  })
})

describe('day checks and fix-it', () => {
  it('flags a low-protein day and finds a fix', () => {
    const p = picks({ breakfast: 'shake-banana', lunch: 'tuna-wrap', snack: 'cottage-fruit', dinner: ['meatballs-potato'] })
    const [day] = dayVariants(p, 1)
    const check = checkDay(day, athletic)
    expect(check.ok).toBe(false)
    expect(check.proteinGap).toBeGreaterThan(0)
    const fixes = suggestFixes(p, 1, athletic)
    expect(fixes.length).toBeGreaterThan(0)
    for (const f of fixes) for (const v of f.variants) expect(checkDay(v, athletic).ok).toBe(true)
  })

  it('returns no suggestions when the plan already works', () => {
    const p = picks({ evening: 'cottage-cup' })
    expect(dayVariants(p, 1).every((d) => checkDay(d, athletic).ok)).toBe(true)
    expect(suggestFixes(p, 1, athletic)).toEqual([])
  })

  it('checks both days when dinners alternate', () => {
    const p = picks({ dinner: ['chicken-rice-veg', 'salmon-potato'], evening: 'cottage-cup' })
    expect(dayVariants(p, 1)).toHaveLength(2)
    const fixes = suggestFixes(p, 1, athletic)
    for (const f of fixes) for (const v of f.variants) expect(checkDay(v, athletic).ok).toBe(true)
  })

  it('every complete combination can be fixed for both profiles', () => {
    for (const [t, portion] of [
      [athletic, 1],
      [glute, 0.8],
    ] as const) {
      for (const b of optionsFor('breakfast'))
        for (const l of optionsFor('lunch'))
          for (const s of optionsFor('snack'))
            for (const d of optionsFor('dinner')) {
              const p = picks({ breakfast: b.id, lunch: l.id, snack: s.id, dinner: [d.id] })
              const ok = dayVariants(p, portion).every((v) => checkDay(v, t).ok)
              if (!ok) expect(suggestFixes(p, portion, t).length, `${b.id}/${l.id}/${s.id}/${d.id}`).toBeGreaterThan(0)
            }
    }
  })
})

describe('grocery list', () => {
  it('rounds up to whole packs and skips restaurant meals', () => {
    const p = picks({ lunch: 'chipotle-bowl' })
    const list = buildGroceryList(p, 1)
    expect(list.restaurantMeals).toContain('Chipotle bowl')
    const yogurt = list.shop['Dairy & Eggs'].find((l) => l.item.id === 'greek-yogurt')!
    expect(yogurt.amount).toBe(250 * 7)
    expect(yogurt.packs).toBe(2) // 1,750 g / 907 g tubs
  })

  it('puts the second half of perishables on the top-up list', () => {
    const p = picks({ breakfast: 'shake-banana' })
    const list = buildGroceryList(p, 1)
    const shopBananas = list.shop.Produce.find((l) => l.item.id === 'banana')!
    const topBananas = list.topup.find((l) => l.item.id === 'banana')!
    expect(shopBananas.amount).toBe(3)
    expect(topBananas.amount).toBe(4)
  })

  it('leaves out items already in the kitchen', () => {
    const p = picks({})
    const list = buildGroceryList(p, 1, ['whey'])
    expect(list.skipped.map((s) => s.id)).toContain('whey')
    expect(Object.values(list.shop).flat().some((l) => l.item.id === 'whey')).toBe(false)
    expect(stapleCandidates(p, 1).some((i) => i.id === 'whey')).toBe(true)
  })

  it('shares rice cups across meals', () => {
    const p = picks({}) // lunch bowl + dinner both use 1 rice cup
    const rice = buildGroceryList(p, 1).shop.Pantry.find((l) => l.item.id === 'rice-cup')!
    expect(rice.amount).toBe(14)
    expect(rice.packs).toBe(7)
  })
})

describe('custom meals', () => {
  it('count toward totals and add free-text items to the grocery list', async () => {
    const { setCustomMeals } = await import('../data/meals')
    const { toMealOption } = await import('./customMeals')
    setCustomMeals([
      toMealOption({
        id: 'custom-shake',
        slot: 'snack',
        name: 'My shake',
        desc: '',
        cal: 450,
        protein: 50,
        carbs: 25,
        fat: 16,
        groceries: [
          { name: 'Whole milk', amount: 16, unit: 'oz' },
          { name: 'Whey', amount: 2, unit: 'scoops' },
        ],
        createdAt: '',
      }),
    ])
    const p = picks({ snack: 'custom-shake' })
    const base = dayVariants(picks({}), 1)[0]
    const withShake = dayVariants(p, 1)[0]
    expect(Math.round(withShake.cal - base.cal)).toBe(450 - round(mealMacros(mealsById['snack-shake'])).cal)
    const list = buildGroceryList(p, 1)
    const milk = list.shop.Other.find((l) => l.item.name === 'Whole milk')!
    expect(milk.amount).toBe(16 * 7)
    setCustomMeals([])
  })
})
