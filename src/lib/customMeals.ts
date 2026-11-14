// User-added planner options: stored in IndexedDB, registered into the meal list.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type CustomMeal } from './db'
import { setCustomMeals, type MealOption } from '../data/meals'

export function toMealOption(c: CustomMeal): MealOption {
  return {
    id: c.id,
    slot: c.slot,
    name: c.name,
    desc: c.desc || 'Your own option.',
    prep: 'No cook',
    minutes: 0,
    steps: c.groceries.length ? c.groceries.map((g) => `${g.amount} ${g.unit} ${g.name}`) : ['Your own option.'],
    ingredients: [],
    custom: { cal: c.cal, protein: c.protein, carbs: c.carbs, fat: c.fat, groceries: c.groceries },
  }
}

/** Keeps the meal registry in sync with the database. Call once near the app root. */
export function useCustomMealsSync() {
  const list = useLiveQuery(() => db.customMeals.orderBy('slot').toArray(), [], undefined)
  if (list) setCustomMeals(list.map(toMealOption))
  return list !== undefined
}

export async function saveCustomMeal(input: Omit<CustomMeal, 'id' | 'createdAt'> & { id?: string }) {
  const meal: CustomMeal = { ...input, id: input.id ?? `custom-${uid()}`, createdAt: new Date().toISOString() }
  await db.customMeals.put(meal)
  return meal
}

export async function deleteCustomMeal(id: string) {
  await db.customMeals.delete(id)
}
