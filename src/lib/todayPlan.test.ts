import { describe, expect, it } from 'vitest'
import { buildTodayItems, pickUpNext, timeLabel } from './todayPlan'
import { programs } from '../data/programs'
import type { PlannedMeal } from './eatStore'

const meal = (slot: PlannedMeal['slot'], startHour: number, logged = false): PlannedMeal => ({
  slot,
  mealId: slot,
  name: slot,
  time: '',
  startHour,
  macros: { cal: 500, protein: 40, carbs: 50, fat: 15 },
  entry: logged ? { id: slot, date: '', slot, planned: true, name: slot, servings: 1, cal: 500, protein: 40, carbs: 50, fat: 15, createdAt: '' } : undefined,
})
const lowerA = programs.athletic.week[0]
const base = {
  hasPlan: true,
  meals: [meal('breakfast', 7), meal('lunch', 12), meal('snack', 15), meal('dinner', 18)],
  session: lowerA,
  sessionDone: false,
  supplements: [{ id: 'creatine', name: 'Creatine', dose: '5 g', timing: '', cal: 0, protein: 0 }],
  suppsTaken: new Set<string>(),
}

describe('today checklist', () => {
  it('orders items by time with supplements last', () => {
    const items = buildTodayItems(base)
    expect(items.map((i) => i.kind)).toEqual(['weigh', 'meal', 'meal', 'meal', 'session', 'meal', 'supp'])
  })

  it('morning: weigh-in is up next', () => {
    expect(pickUpNext(buildTodayItems(base), 6.5)?.kind).toBe('weigh')
  })

  it('midday: skips past windows to lunch, no nagging about breakfast', () => {
    expect(pickUpNext(buildTodayItems(base), 12.2)?.id).toBe('meal:lunch:lunch')
  })

  it('late afternoon: the workout', () => {
    const items = buildTodayItems({ ...base, meals: [meal('breakfast', 7, true), meal('lunch', 12, true), meal('snack', 15, true), meal('dinner', 18)], weighedLb: 190 })
    expect(pickUpNext(items, 17)?.kind).toBe('session')
  })

  it('no plan: planning comes first', () => {
    expect(pickUpNext(buildTodayItems({ ...base, hasPlan: false, meals: [] }), 13)?.kind).toBe('plan')
  })

  it('everything done → nothing up next; rest days count as done', () => {
    const items = buildTodayItems({
      ...base,
      weighedLb: 190,
      meals: base.meals.map((m) => meal(m.slot, m.startHour, true)),
      session: programs.athletic.week[2],
      suppsTaken: new Set(['creatine']),
    })
    expect(pickUpNext(items, 20)).toBeNull()
  })

  it('formats times', () => {
    expect(timeLabel(17.5)).toBe('5:30')
    expect(timeLabel(7)).toBe('7:00')
  })
})
