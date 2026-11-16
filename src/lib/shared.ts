// Shared library sync: labels, custom exercises and workout lineups go up to the
// app's shared store; everyone else's come down. Personal data stays on the phone.
// Uses the same passcode as the photo reader (Settings → Photo & link reader).
import { db, type CustomExercise, type LibraryLabel, type SharedWorkout } from './db'
import { settingsOf, type Profile } from './profile'
import { buildLibrary } from '../screens/train/Library'

const PUSHED = 'lift-eat:shared:pushed'
const HIDDEN = 'lift-eat:shared:hidden'
const STATUS = 'lift-eat:shared:status'

const readSet = (k: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(k) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}
const writeSet = (k: string, s: Set<string>) => {
  try {
    localStorage.setItem(k, JSON.stringify([...s].slice(-3000)))
  } catch {
    /* storage full or blocked: sync just repeats next time */
  }
}

export type SyncStatus = { at: string; ok: boolean; message: string; counts?: { labels: number; exercises: number; workouts: number } }
export function syncStatus(): SyncStatus | null {
  try {
    return JSON.parse(localStorage.getItem(STATUS) ?? 'null')
  } catch {
    return null
  }
}
const setStatus = (s: SyncStatus) => {
  try {
    localStorage.setItem(STATUS, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Short stable id for a workout lineup. */
export function lineupId(exIds: string[]) {
  let h = 5381
  for (const c of exIds.join('|')) h = ((h << 5) + h + c.charCodeAt(0)) | 0
  return `w-${(h >>> 0).toString(36)}-${exIds.length}`
}

async function call(passcode: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  const r = await fetch('/api/shared', { method, headers: { 'content-type': 'application/json', 'x-passcode': passcode }, body: body ? JSON.stringify(body) : undefined })
  if (r.status === 404) throw new Error('Sharing works on the live site only.')
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error ?? `Sync failed (${r.status}).`)
  return data
}

let running: Promise<void> | null = null
let lastRun = 0

/** Push what's new here, pull what others added. Safe to call often (throttled). */
export function syncShared(profile: Profile, force = false): Promise<void> {
  const passcode = settingsOf(profile).aiPasscode
  if (!passcode) return Promise.resolve()
  if (running) return running
  if (!force && Date.now() - lastRun < 60_000) return Promise.resolve()
  lastRun = Date.now()
  running = doSync(profile, passcode).finally(() => (running = null))
  return running
}

async function doSync(profile: Profile, passcode: string) {
  const me = profile.name
  const pushed = readSet(PUSHED)
  const hidden = readSet(HIDDEN)
  try {
    // ---- Push what's mine and not shared yet ----
    const labels = (await db.labelLibrary.toArray()).filter((l) => !l.addedBy || l.addedBy === me)
    const newLabels = labels.filter((l) => !pushed.has(`labels:${l.id}`)).map((l) => ({ ...l, addedBy: me }))
    // Any exercise edited here gets shared (including fixes to someone else's).
    const exercises = await db.customExercises.toArray()
    const exKey = (e: CustomExercise) => `exercises:${e.id}@${e.updatedAt ?? e.createdAt}`
    const newExercises = exercises.filter((e) => !pushed.has(exKey(e))).map((e) => ({ ...e, addedBy: e.addedBy ?? me }))
    const workouts = buildLibrary(await db.workouts.filter((w) => !!w.finishedAt && !w.cardio).toArray()).map(
      (e): SharedWorkout => ({
        id: lineupId(e.plan.map((p) => p.ex)),
        name: e.name.replace(/: Refresh$/, ''),
        sessionKey: e.sessionKey,
        plan: e.plan.map((p) => ({ ...p, startWeight: undefined })), // weights stay personal
        addedBy: me,
        updatedAt: e.lastDate,
        timesDone: e.timesDone,
      }),
    )
    const newWorkouts = workouts.filter((w) => !pushed.has(`workouts:${w.id}@${w.timesDone}`))
    // Exercises first, so shared workouts never reference an exercise others don't have.
    if (newExercises.length) await call(passcode, 'POST', { kind: 'exercises', items: newExercises })
    if (newLabels.length) await call(passcode, 'POST', { kind: 'labels', items: newLabels })
    if (newWorkouts.length) await call(passcode, 'POST', { kind: 'workouts', items: newWorkouts })
    for (const l of newLabels) pushed.add(`labels:${l.id}`)
    for (const e of newExercises) pushed.add(exKey(e))
    for (const w of newWorkouts) pushed.add(`workouts:${w.id}@${w.timesDone}`)
    writeSet(PUSHED, pushed)
    // Mark my own items as mine locally.
    await db.labelLibrary.bulkPut(labels.filter((l) => !l.addedBy).map((l) => ({ ...l, addedBy: me })))
    await db.customExercises.bulkPut(exercises.filter((e) => !e.addedBy).map((e) => ({ ...e, addedBy: me })))

    // ---- Pull everyone's ----
    const data = (await call(passcode, 'GET')) as { labels: LibraryLabel[]; exercises: CustomExercise[]; workouts: SharedWorkout[] }
    const haveLabels = new Set((await db.labelLibrary.toArray()).map((l) => l.id))
    await db.labelLibrary.bulkPut(data.labels.filter((l) => l && !haveLabels.has(l.id) && !hidden.has(`labels:${l.id}`)))
    const localEx = new Map((await db.customExercises.toArray()).map((e) => [e.id, e]))
    const stamp = (e?: CustomExercise) => e?.updatedAt ?? e?.createdAt ?? ''
    const incoming = data.exercises.filter((e) => e && (!localEx.has(e.id) || stamp(e) > stamp(localEx.get(e.id))))
    await db.customExercises.bulkPut(incoming)
    // Remember them as already shared so they aren't pushed straight back.
    for (const e of incoming) pushed.add(exKey(e))
    writeSet(PUSHED, pushed)
    await db.transaction('rw', db.sharedWorkouts, async () => {
      await db.sharedWorkouts.clear()
      await db.sharedWorkouts.bulkPut(data.workouts.filter((w) => w && w.addedBy !== me && !hidden.has(`workouts:${w.id}`)))
    })
    setStatus({
      at: new Date().toISOString(),
      ok: true,
      message: 'Synced',
      counts: { labels: data.labels.length, exercises: data.exercises.length, workouts: data.workouts.length },
    })
  } catch (e) {
    setStatus({ at: new Date().toISOString(), ok: false, message: (e as Error).message })
  }
}

/** Remove from this phone; if it's mine, remove it from the shared library too. */
export async function unshare(profile: Profile, kind: 'labels' | 'workouts', id: string, addedBy?: string) {
  const hidden = readSet(HIDDEN)
  hidden.add(`${kind}:${id}`)
  writeSet(HIDDEN, hidden)
  const passcode = settingsOf(profile).aiPasscode
  if (passcode && (!addedBy || addedBy === profile.name)) await call(passcode, 'DELETE', { kind, id }).catch(() => {})
}

// After you add something (scan a label, finish a workout), share it shortly after.
let timer: ReturnType<typeof setTimeout> | null = null
let current: Profile | null = null
export const setSyncProfile = (p: Profile | null) => (current = p)
export function requestSync() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => current && syncShared(current, true), 2500)
}
