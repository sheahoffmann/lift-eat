// Workout lifecycle: start → log sets (live PR detection) → finish.
// In-progress workouts live in IndexedDB, so closing the app never loses a session.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type CardioLog, type PR, type SetLog, type Workout } from './db'
import { exercises } from '../data/exercises'
import { programs, sessionFor, type Phase, type Program } from '../data/programs'
import { settingsOf, todayISO, type Profile } from './profile'
import { autoSubstitute } from './swaps'
import { detectPR, setVolume } from './training'
import { bodyWeightOn } from './weighins'
import { currentSeason } from './season'
import { weekStart } from './game'

export function phaseOf(profile: Profile): Phase {
  const s = settingsOf(profile)
  // Deload week: Preseason-style volume (half sets, extra reps in reserve).
  if ((s.deloadWeeks ?? []).includes(weekStart(todayISO()))) return 'preseason'
  if (s.buildStartedAt) return 'build'
  return currentSeason(profile.startDate).key as Phase
}

/** Build the exercise plan for a session: phase scaling → program overrides → equipment profile. */
export async function resolvePlan(profile: Profile, program: Program, day: number) {
  const phase = phaseOf(profile)
  const s = sessionFor(program, day, phase)
  const settings = settingsOf(profile)
  const available = settings.equipment[settings.equipmentProfile]
  const overrides = await db.overrides.toArray()
  const byId = new Map(overrides.map((o) => [o.id, o.replacement]))
  return {
    session: s,
    phase,
    plan: s.exercises.map((e) => {
      const programmed = byId.get(`${s.key}:${e.ex}`) ?? e.ex
      const ex = autoSubstitute(programmed, available, e.home)
      const restKey = e.role as keyof typeof settings.rest
      return {
        slotEx: e.ex,
        ex,
        sets: e.sets,
        reps: e.reps,
        rest: settings.rest[restKey] ?? e.rest,
        perSide: e.perSide,
        seconds: e.seconds,
        yards: e.yards,
        role: e.role,
      }
    }),
  }
}

export async function startWorkout(profile: Profile, day: number) {
  const program = programs[profile.program]
  const { session, phase, plan } = await resolvePlan(profile, program, day)
  const w: Workout = {
    id: uid(),
    date: todayISO(),
    sessionKey: session.key,
    name: session.name,
    kind: session.kind,
    phase,
    equipmentProfile: settingsOf(profile).equipmentProfile,
    startedAt: new Date().toISOString(),
    plan,
  }
  await db.workouts.add(w)
  return w
}

export function useActiveWorkout() {
  return useLiveQuery(
    async () => (await db.workouts.filter((w) => !w.finishedAt).toArray()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
    [],
    undefined,
  )
}

export function useWorkoutSets(workoutId: string | undefined) {
  return useLiveQuery(
    () => (workoutId ? db.sets.where('workoutId').equals(workoutId).toArray() : Promise.resolve([] as SetLog[])),
    [workoutId],
    [] as SetLog[],
  )
}

/** Sets from the most recent earlier workout that included this exercise variant. */
export async function lastSessionSets(exerciseId: string, beforeWorkoutId?: string) {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const prior = all.filter((s) => s.workoutId !== beforeWorkoutId)
  if (!prior.length) return []
  const latest = prior.reduce((a, b) => (a.completedAt > b.completedAt ? a : b))
  return prior.filter((s) => s.workoutId === latest.workoutId).sort((a, b) => a.setIndex - b.setIndex)
}

export function useLastSession(exerciseId: string, workoutId?: string) {
  return useLiveQuery(() => lastSessionSets(exerciseId, workoutId), [exerciseId, workoutId], [] as SetLog[])
}

export async function exerciseHistory(exerciseId: string) {
  return db.sets.where('exerciseId').equals(exerciseId).toArray()
}

/** Log a completed set. Returns a PR if this set beat every earlier set of the variant. */
export async function completeSet(
  w: Workout,
  index: number,
  setIndex: number,
  values: { weight: number; reps: number; seconds?: number; yards?: number },
): Promise<PR | null> {
  const item = w.plan[index]
  const ex = exercises[item.ex]
  const bodyweight = await bodyWeightOn(w.date)
  const set: SetLog = {
    id: uid(),
    workoutId: w.id,
    date: w.date,
    exerciseId: item.ex,
    slotEx: item.slotEx,
    setIndex,
    weight: values.weight,
    reps: values.reps,
    seconds: values.seconds,
    yards: values.yards,
    bodyweight,
    completedAt: new Date().toISOString(),
  }
  const history = await exerciseHistory(item.ex)
  await db.sets.add(set)
  if (!ex) return null
  const pr = detectPR(ex, set, history, bodyweight)
  if (pr) {
    // Only celebrate if this beats any PR of the same kind already hit this workout.
    const existing = (w.prs ?? []).find((p) => p.exerciseId === pr.exerciseId && p.kind === pr.kind)
    const prs = (w.prs ?? []).filter((p) => !(p.exerciseId === pr.exerciseId && p.kind === pr.kind))
    const merged = existing ? { ...pr, previous: existing.previous } : pr
    await db.workouts.update(w.id, { prs: [...prs, merged] })
    return merged
  }
  return null
}

export async function uncompleteSet(setId: string) {
  await db.sets.delete(setId)
}

export async function setCount(w: Workout, index: number, delta: number) {
  const plan = w.plan.map((p, i) => (i === index ? { ...p, sets: Math.max(1, Math.min(12, p.sets + delta)) } : p))
  await db.workouts.update(w.id, { plan })
}

export async function swapInWorkout(w: Workout, index: number, newEx: string, scope: 'today' | 'program') {
  const plan = w.plan.map((p, i) => (i === index ? { ...p, ex: newEx } : p))
  await db.workouts.update(w.id, { plan })
  if (scope === 'program') await db.overrides.put({ id: `${w.sessionKey}:${w.plan[index].slotEx}`, replacement: newEx })
}

/** Equipment profile switched mid-workout: re-substitute anything not doable, keep completed exercises. */
export async function applyEquipment(w: Workout, profile: Profile, done: Set<number>) {
  const s = settingsOf(profile)
  const available = s.equipment[s.equipmentProfile]
  const program = programs[profile.program]
  const prescriptions = program.week.flatMap((d) => d.exercises)
  const plan = w.plan.map((p, i) => {
    if (done.has(i)) return p
    const home = prescriptions.find((x) => x.ex === p.slotEx)?.home
    return { ...p, ex: autoSubstitute(p.slotEx, available, home) }
  })
  await db.workouts.update(w.id, { plan, equipmentProfile: s.equipmentProfile })
}

export async function saveNote(w: Workout, exerciseId: string, note: string) {
  await db.workouts.update(w.id, { notes: { ...(w.notes ?? {}), [exerciseId]: note } })
}

export async function discardWorkout(w: Workout) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(w.id).delete()
    await db.workouts.delete(w.id)
  })
}

/** Finish: compute duration, volume, sets; returns the finished workout. */
export async function finishWorkout(w: Workout, cardio?: CardioLog) {
  const sets = await db.sets.where('workoutId').equals(w.id).toArray()
  const bw = await bodyWeightOn(w.date)
  let volume = 0
  for (const s of sets) {
    const ex = exercises[s.exerciseId]
    const item = w.plan.find((p) => p.ex === s.exerciseId)
    if (ex) volume += setVolume(ex, s, s.bodyweight ?? bw, item?.perSide)
  }
  const finishedAt = new Date().toISOString()
  const durationSec = cardio ? cardio.minutes * 60 : Math.round((Date.parse(finishedAt) - Date.parse(w.startedAt)) / 1000)
  const patch: Partial<Workout> = { finishedAt, durationSec, volume, setsDone: sets.length, cardio }
  await db.workouts.update(w.id, patch)
  return { ...w, ...patch } as Workout
}

/** Log a cardio session in one step (no live tracking needed). */
export async function logCardio(profile: Profile, day: number, cardio: CardioLog) {
  const w = await startWorkout(profile, day)
  return finishWorkout(w, cardio)
}

export function useWorkoutHistory(limit = 100) {
  return useLiveQuery(
    async () => (await db.workouts.orderBy('date').reverse().filter((w) => !!w.finishedAt).limit(limit).toArray()),
    [limit],
    undefined,
  )
}

export function useWorkoutsOn(date: string) {
  return useLiveQuery(() => db.workouts.where('date').equals(date).filter((w) => !!w.finishedAt).toArray(), [date], [] as Workout[])
}
