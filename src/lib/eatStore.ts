// Reads and writes for plans, the food log and My Foods.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type FoodLogEntry, type MyFood, type Picks, type WeekPlan } from './db'
import { mealsById, slotMeta, type Slot } from '../data/meals'
import { add, mealMacros, mealsForDay, round, zero, type Macros } from './nutrition'
import { todayISO } from './profile'
import { daysBetween } from './season'
import { PLAN_DAYS } from './grocery'

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + n))
}

/** The plan covering `date`, if any. */
export function usePlanFor(date: string) {
  return useLiveQuery(
    async () => {
      const plans = await db.plans.where('startDate').belowOrEqual(date).toArray()
      return plans.filter((p) => p.endDate >= date).sort((a, b) => b.lockedAt.localeCompare(a.lockedAt))[0] ?? null
    },
    [date],
    undefined,
  )
}

export function useLatestPlan() {
  return useLiveQuery(() => db.plans.orderBy('startDate').last(), [], undefined)
}

export async function lockPlan(input: {
  picks: Picks
  portion: number
  calorieTarget: number
  proteinTarget: number
  pantryHave: string[]
  startDate: string
}) {
  const plan: WeekPlan = {
    id: uid(),
    ...input,
    endDate: addDays(input.startDate, PLAN_DAYS - 1),
    checked: [],
    lockedAt: new Date().toISOString(),
  }
  // Replace any plan that starts on the same day.
  await db.transaction('rw', db.plans, async () => {
    await db.plans.where('startDate').equals(input.startDate).delete()
    await db.plans.add(plan)
  })
  return plan
}

export async function toggleChecked(plan: WeekPlan, key: string) {
  // Read the latest saved list inside a transaction so quick taps never overwrite each other.
  await db.transaction('rw', db.plans, async () => {
    const fresh = (await db.plans.get(plan.id))?.checked ?? []
    const checked = fresh.includes(key) ? fresh.filter((k) => k !== key) : [...fresh, key]
    await db.plans.update(plan.id, { checked })
  })
}

/** Hide (or bring back) the grocery card on Eat. */
export async function markShopped(plan: WeekPlan, shopped: boolean) {
  await db.plans.update(plan.id, { shoppedAt: shopped ? new Date().toISOString() : undefined })
}

export function useDayLog(date: string) {
  return useLiveQuery(() => db.foodLog.where('date').equals(date).sortBy('createdAt'), [date], undefined)
}

export type PlannedMeal = {
  slot: Slot | 'extra'
  mealId: string
  name: string
  time: string
  startHour: number
  macros: Macros
  entry?: FoodLogEntry // what was actually logged for this slot (planned or replacement)
}

/** Today's planned meals in order, matched with log entries. */
export function plannedMealsFor(plan: WeekPlan, date: string, log: FoodLogEntry[]): PlannedMeal[] {
  const dayIndex = daysBetween(plan.startDate, new Date(date + 'T12:00:00'))
  const usedEntries = new Set<string>()
  return mealsForDay(plan.picks, dayIndex).map(({ slot, id }) => {
    const meal = mealsById[id]
    const entry = log.find(
      (e) => !usedEntries.has(e.id) && (slot === 'extra' ? e.slot === 'extra' && e.mealId === id : e.slot === slot),
    )
    if (entry) usedEntries.add(entry.id)
    const meta = slot === 'extra' ? { time: 'Anytime', startHour: 21 } : slotMeta[slot]
    return {
      slot,
      mealId: id,
      name: meal.name,
      time: meta.time,
      startHour: meta.startHour,
      macros: round(mealMacros(meal, plan.portion)),
      entry,
    }
  })
}

/** The meal to highlight, based on time of day: the first unlogged meal whose
 *  window hasn't passed (window = start + 2 h). Earlier unlogged meals stay
 *  loggable in the list, without nagging. Falls back to the last unlogged one. */
export function nextMeal(meals: PlannedMeal[], now = new Date()) {
  const hour = now.getHours() + now.getMinutes() / 60
  const open = meals.filter((m) => !m.entry && m.slot !== 'extra')
  return open.find((m) => m.startHour + 2 > hour) ?? open.at(-1) ?? meals.find((m) => !m.entry) ?? null
}

export function totals(log: FoodLogEntry[]): Macros {
  return log.reduce((s, e) => add(s, { cal: e.cal, protein: e.protein, carbs: e.carbs, fat: e.fat }), zero)
}

export async function logPlanned(date: string, m: PlannedMeal) {
  await db.foodLog.add({
    id: uid(),
    date,
    slot: m.slot,
    mealId: m.mealId,
    planned: true,
    name: m.name,
    servings: 1,
    ...m.macros,
    createdAt: new Date().toISOString(),
  })
}

export async function removeEntry(id: string) {
  await db.foodLog.delete(id)
}

/** Log something unplanned, optionally in place of a planned slot. Saves it to My Foods. */
export async function logOther(input: {
  date: string
  slot: Slot | 'extra' | 'other'
  replacesMealId?: string
  food: { name: string; servingLabel: string; cal: number; protein: number; carbs: number; fat: number; source?: MyFood['source']; barcode?: string }
  servings: number
  myFoodId?: string
}) {
  const { food, servings } = input
  const now = new Date().toISOString()
  let myFoodId = input.myFoodId
  await db.transaction('rw', db.myFoods, db.foodLog, async () => {
    if (myFoodId) {
      const existing = await db.myFoods.get(myFoodId)
      if (existing) await db.myFoods.update(myFoodId, { uses: existing.uses + 1, lastUsed: now })
    } else {
      const dup = await db.myFoods.where('name').equalsIgnoreCase(food.name.trim()).first()
      if (dup) {
        myFoodId = dup.id
        await db.myFoods.update(dup.id, { uses: dup.uses + 1, lastUsed: now, cal: food.cal, protein: food.protein, carbs: food.carbs, fat: food.fat })
      } else {
        myFoodId = uid()
        await db.myFoods.add({
          id: myFoodId,
          name: food.name.trim(),
          servingLabel: food.servingLabel,
          cal: food.cal,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          source: food.source ?? 'manual',
          barcode: food.barcode,
          uses: 1,
          lastUsed: now,
        })
      }
    }
    await db.foodLog.add({
      id: uid(),
      date: input.date,
      slot: input.slot,
      mealId: input.slot === 'extra' ? input.replacesMealId : undefined,
      planned: false,
      name: food.name.trim(),
      servings,
      cal: Math.round(food.cal * servings),
      protein: Math.round(food.protein * servings),
      carbs: Math.round(food.carbs * servings),
      fat: Math.round(food.fat * servings),
      myFoodId,
      createdAt: now,
    })
  })
}

export function useMyFoods() {
  return useLiveQuery(() => db.myFoods.orderBy('lastUsed').reverse().toArray(), [], undefined)
}
