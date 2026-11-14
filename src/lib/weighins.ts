// Weigh-ins (daily weight, weekly waist). Stored in IndexedDB.
// Migrates any M0 localStorage weigh-ins on first load.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WeighIn } from './db'
import { todayISO } from './profile'

export type { WeighIn }

const LEGACY_KEY = 'lift-eat:weighins:v1'

async function migrate() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const list = JSON.parse(raw) as WeighIn[]
    if (list.length) await db.weighIns.bulkPut(list)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}
migrate()

export async function logWeighIn(lb: number, date = todayISO()) {
  const existing = await db.weighIns.get(date)
  await db.weighIns.put({ ...existing, date, lb })
}

export async function logWaist(waist: number, date = todayISO()) {
  const existing = await db.weighIns.get(date)
  await db.weighIns.put({ lb: existing?.lb ?? 0, ...existing, date, waist })
}

/** All weigh-ins, oldest first. */
export function useWeighIns(): WeighIn[] {
  return useLiveQuery(() => db.weighIns.orderBy('date').toArray(), [], [] as WeighIn[])
}

/** Most recent body weight on or before a date (for bodyweight volume). */
export async function bodyWeightOn(date: string, fallback = 180) {
  const w = await db.weighIns.where('date').belowOrEqual(date).reverse().filter((x) => x.lb > 0).first()
  return w?.lb ?? fallback
}

/** 7-day trailing average for each weigh-in date. */
export function movingAverage(list: WeighIn[], days = 7) {
  const valid = list.filter((w) => w.lb > 0)
  return valid.map((w, i) => {
    const t = new Date(w.date + 'T12:00:00').getTime()
    const window = valid.slice(0, i + 1).filter((x) => t - new Date(x.date + 'T12:00:00').getTime() < days * 86_400_000)
    return { date: w.date, lb: w.lb, avg: window.reduce((s, x) => s + x.lb, 0) / window.length }
  })
}
