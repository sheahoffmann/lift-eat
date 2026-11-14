// Export everything (JSON backup + CSVs) and restore from a backup file.
import { db } from './db'
import { saveProfile, type Profile } from './profile'
import { exercises } from '../data/exercises'

const tables = ['plans', 'foodLog', 'myFoods', 'workouts', 'sets', 'exerciseSettings', 'overrides', 'weighIns', 'xp', 'achievements', 'attributes', 'customMeals', 'runs'] as const

export async function buildBackup(profile: Profile | null) {
  const data: Record<string, unknown[]> = {}
  for (const t of tables) data[t] = await db.table(t).toArray()
  return { app: 'lift-eat', version: 2, exportedAt: new Date().toISOString(), profile, data }
}

function download(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type })
  const file = new File([blob], filename, { type })
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch(() => {})
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export async function exportJSON(profile: Profile | null) {
  const b = await buildBackup(profile)
  download(JSON.stringify(b, null, 1), `lift-eat-backup-${stamp()}.json`, 'application/json')
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCSV = (rows: Record<string, unknown>[], cols: string[]) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')

export async function exportCSV(kind: 'sets' | 'food' | 'weight' | 'workouts') {
  if (kind === 'sets') {
    const rows = (await db.sets.toArray()).map((s) => ({ ...s, exercise: exercises[s.exerciseId]?.name ?? s.exerciseId }))
    download(toCSV(rows, ['date', 'exercise', 'setIndex', 'weight', 'reps', 'seconds', 'yards', 'bodyweight', 'workoutId']), `lift-eat-sets-${stamp()}.csv`, 'text/csv')
  } else if (kind === 'food') {
    const rows = await db.foodLog.toArray()
    download(toCSV(rows as never, ['date', 'slot', 'name', 'servings', 'cal', 'protein', 'carbs', 'fat', 'planned']), `lift-eat-food-${stamp()}.csv`, 'text/csv')
  } else if (kind === 'weight') {
    const rows = await db.weighIns.orderBy('date').toArray()
    download(toCSV(rows as never, ['date', 'lb', 'waist']), `lift-eat-weight-${stamp()}.csv`, 'text/csv')
  } else {
    const rows = (await db.workouts.toArray()).map((w) => ({ ...w, prs: w.prs?.length ?? 0, cardioType: w.cardio?.type, cardioMinutes: w.cardio?.minutes }))
    download(toCSV(rows as never, ['date', 'name', 'durationSec', 'volume', 'setsDone', 'prs', 'cardioType', 'cardioMinutes']), `lift-eat-workouts-${stamp()}.csv`, 'text/csv')
  }
}

/** Replace all local data with a backup file's contents. */
export async function restoreBackup(file: File) {
  const json = JSON.parse(await file.text())
  if (json?.app !== 'lift-eat' || !json.data) throw new Error('Not a Lift & Eat backup file.')
  await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
    for (const t of tables) {
      await db.table(t).clear()
      const rows = json.data[t]
      if (Array.isArray(rows) && rows.length) await db.table(t).bulkPut(rows)
    }
  })
  if (json.profile) saveProfile(json.profile)
}
