import { describe, expect, it } from 'vitest'
import { mealChanges, mealSnapshot, planDay, splitOf, verdict } from './weekReview'
import { applyMyLabels } from '../data/myLabels'

const picks = { breakfast: 'yogurt-bowl', lunch: 'chicken-rice-bowl', snack: 'whey-milk-snack', dinner: ['meatballs-potato'], evening: 'casein-shake', extras: [] }
const goals = { calories: 2250, protein: 190, carbs: 215, fat: 70 }

describe('week review', () => {
  it('matches the hand check for the real week with label numbers', () => {
    applyMyLabels(true)
    const day = planDay(picks, 1)
    expect(day).toEqual({ cal: 2281, protein: 216, carbs: 190, fat: 73 })
    expect(splitOf(day)).toEqual({ protein: 38, carbs: 33, fat: 29 })
    const v = verdict(day, goals)
    expect(v.ok).toBe(true)
    expect(v.lines.map((l) => l.tone)).toEqual(['good', 'good', 'good', 'good'])
    applyMyLabels(false)
  })

  it('flags protein and calories when off', () => {
    const v = verdict({ cal: 1800, protein: 150, carbs: 200, fat: 60 }, goals)
    expect(v.ok).toBe(false)
    expect(v.lines[0].tone).toBe('fix')
    expect(v.lines[1].text).toContain('40 g short')
  })

  it('lists meals whose numbers changed', () => {
    applyMyLabels(false)
    const before = mealSnapshot(picks, 1)
    applyMyLabels(true)
    const changed = mealChanges(before, mealSnapshot(picks, 1)).map((c) => c.id)
    applyMyLabels(false)
    expect(changed).toContain('meatballs-potato')
    expect(changed).toContain('yogurt-bowl')
  })
})
