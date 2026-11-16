// Exercises you type in yourself: stored in IndexedDB, registered into the exercise list
// so logging, history, PRs and the muscle map work exactly like built-in ones.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type CustomExercise } from './db'
import { setCustomExercises } from '../data/exercises'
import type { Exercise } from '../data/exerciseTypes'
import type { MuscleSlug } from '../anatomy/muscles'

export function toExercise(c: CustomExercise): Exercise {
  const bodyweight = c.logType === 'bodyweight' || c.logType === 'timed'
  return {
    id: c.id,
    name: c.name,
    pattern: 'isolation',
    primary: c.primary as MuscleSlug[],
    secondary: [],
    equipment: ['bodyweight'], // never auto-swapped away for missing gear
    logType: c.logType,
    loadType: bodyweight ? 'bodyweight' : 'machine',
    bodyweightFactor: c.logType === 'bodyweight' ? 0.6 : 0,
    cues: ['Your own exercise.', 'Control every rep.', 'Add a video link below if you want a form reminder.'],
    mistake: 'Rushing the reps.',
  }
}

/** Keeps the exercise registry in sync with the database. Call once near the app root. */
export function useCustomExercisesSync() {
  const list = useLiveQuery(() => db.customExercises.toArray(), [], undefined)
  if (list) setCustomExercises(list.map(toExercise))
  return list !== undefined
}

export function useCustomExercises() {
  return useLiveQuery(() => db.customExercises.orderBy('name').toArray(), [], [] as CustomExercise[])
}

export async function saveCustomExercise(input: Omit<CustomExercise, 'id' | 'createdAt'>) {
  // Same name again → reuse it, so history stays in one place.
  const existing = (await db.customExercises.toArray()).find((e) => e.name.trim().toLowerCase() === input.name.trim().toLowerCase())
  const ex: CustomExercise = { ...input, name: input.name.trim(), id: existing?.id ?? `custom-${uid()}`, createdAt: existing?.createdAt ?? new Date().toISOString() }
  await db.customExercises.put(ex)
  setCustomExercises((await db.customExercises.toArray()).map(toExercise)) // available immediately
  return ex
}
