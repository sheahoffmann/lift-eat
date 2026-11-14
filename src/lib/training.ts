// Training math: e1RM, effective load, volume, PR detection, progression cues,
// weight availability and muscles worked. Pure functions (unit-tested).
import type { Exercise, LoadType } from '../data/exerciseTypes'
import type { MuscleSlug } from '../anatomy/muscles'
import type { PR, SetLog } from './db'
import type { Settings } from './profile'

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

/** Load actually moved per rep (body weight share + added load; assisted subtracts). */
export function effectiveLoad(ex: Exercise, weight: number, bodyweight: number) {
  if (ex.id.startsWith('assisted')) return Math.max(0, bodyweight - weight)
  return ex.bodyweightFactor * bodyweight + weight
}

export function setVolume(ex: Exercise, s: Pick<SetLog, 'weight' | 'reps' | 'yards'>, bodyweight: number, perSide = false) {
  if (ex.logType === 'timed') return 0
  if (ex.logType === 'distance') return s.weight * (ex.unilateral ? 1 : 2) * Math.max(1, Math.round((s.yards ?? 0) / 10)) // carries: rough load × 10-yd segments
  const reps = s.reps * (perSide ? 2 : 1)
  return Math.round(effectiveLoad(ex, s.weight, bodyweight) * reps)
}

/** Score used for "best set" comparisons. */
export function setScore(ex: Exercise, s: Pick<SetLog, 'weight' | 'reps' | 'seconds' | 'yards'>, bodyweight: number) {
  switch (ex.logType) {
    case 'timed':
      return s.seconds ?? 0
    case 'distance':
      return s.weight * 1000 + (s.yards ?? 0)
    case 'bodyweight':
      return s.weight > 0 ? e1rm(effectiveLoad(ex, s.weight, bodyweight), s.reps) : s.reps
    default:
      return e1rm(effectiveLoad(ex, s.weight, bodyweight), s.reps)
  }
}

/**
 * PR check for a completed set against all earlier sets of this exercise variant
 * (`history` = previous workouts + earlier sets this workout). First-ever performance
 * is a baseline, not a PR. Returns the most meaningful PR or null.
 */
export function detectPR(ex: Exercise, set: SetLog, history: SetLog[], bodyweight: number): PR | null {
  if (!history.length) return null
  if (ex.logType === 'timed') {
    const best = Math.max(...history.map((h) => h.seconds ?? 0))
    return (set.seconds ?? 0) > best ? { exerciseId: ex.id, kind: 'duration', value: set.seconds ?? 0, previous: best } : null
  }
  if (ex.logType === 'distance') {
    const best = Math.max(...history.map((h) => h.weight))
    return set.weight > best ? { exerciseId: ex.id, kind: 'weight', value: set.weight, previous: best, weight: set.weight } : null
  }
  if (ex.logType === 'bodyweight' && set.weight === 0) {
    const best = Math.max(...history.filter((h) => h.weight === 0).map((h) => h.reps), 0)
    return set.reps > best && best > 0 ? { exerciseId: ex.id, kind: 'reps', value: set.reps, previous: best, reps: set.reps } : null
  }
  const assisted = ex.id.startsWith('assisted')
  const load = (s: SetLog) => effectiveLoad(ex, s.weight, s.bodyweight ?? bodyweight)
  const cur = e1rm(load(set), set.reps)
  const bestE1 = Math.max(...history.map((h) => e1rm(load(h), h.reps)))
  // Heaviest weight ever (for assisted: least assistance).
  const weightPR = assisted
    ? set.weight < Math.min(...history.map((h) => h.weight))
    : set.weight > Math.max(...history.map((h) => h.weight))
  if (weightPR && set.reps >= 1) {
    const prev = assisted ? Math.min(...history.map((h) => h.weight)) : Math.max(...history.map((h) => h.weight))
    return { exerciseId: ex.id, kind: 'weight', value: set.weight, previous: prev, weight: set.weight, reps: set.reps }
  }
  if (cur > bestE1 + 0.5) {
    return { exerciseId: ex.id, kind: 'e1rm', value: Math.round(cur), previous: Math.round(bestE1), weight: set.weight, reps: set.reps }
  }
  // Rep PR at this weight or heavier.
  const atWeight = history.filter((h) => (assisted ? h.weight <= set.weight : h.weight >= set.weight))
  if (atWeight.length) {
    const best = Math.max(...atWeight.map((h) => h.reps))
    if (set.reps > best) return { exerciseId: ex.id, kind: 'reps', value: set.reps, previous: best, weight: set.weight, reps: set.reps }
  }
  return null
}

/** Closest near-miss to a PR this workout, for the recap (e.g. "1 rep away from a squat PR"). */
export function nearMiss(ex: Exercise, sets: SetLog[], history: SetLog[], bodyweight: number) {
  if (!history.length || !sets.length || ex.logType === 'timed' || ex.logType === 'distance') return null
  const load = (s: SetLog) => effectiveLoad(ex, s.weight, s.bodyweight ?? bodyweight)
  const best = Math.max(...history.map((h) => e1rm(load(h), h.reps)))
  let closest: { reps: number; weight: number } | null = null
  for (const s of sets) {
    const l = load(s)
    if (l <= 0) continue
    // Reps needed at this weight to beat the best e1RM.
    const need = Math.floor(30 * (best / l - 1)) + 1
    const gap = need - s.reps
    if (gap > 0 && gap <= 3 && (!closest || gap < closest.reps)) closest = { reps: gap, weight: s.weight }
  }
  return closest
}

// ---------- Progression ----------

export type Suggestion = { weight: number; reps: number; text: string }

/** "Beat last time" cue from last session's matching set. */
export function beatLastTime(
  ex: Exercise,
  last: { weight: number; reps: number } | undefined,
  repRange: [number, number],
  settings: Pick<Settings, 'dumbbellStep' | 'barbellStep' | 'stackStep'>,
): Suggestion | null {
  if (!last) return null
  if (ex.logType === 'timed' || ex.logType === 'distance') return null
  if (ex.logType === 'bodyweight' && last.weight === 0) {
    return { weight: 0, reps: last.reps + 1, text: `${last.reps + 1} reps (+1)` }
  }
  const step = stepFor(ex.loadType, settings)
  const assisted = ex.id.startsWith('assisted')
  if (last.reps >= repRange[1]) {
    const w = assisted ? Math.max(0, last.weight - step) : last.weight + step
    return { weight: w, reps: repRange[0], text: assisted ? `${w} lb assist (−${step})` : `${w} lb (+${step})` }
  }
  return { weight: last.weight, reps: last.reps + 1, text: `${last.weight} × ${last.reps + 1} (+1 rep)` }
}

export function stepFor(load: LoadType, s: Pick<Settings, 'dumbbellStep' | 'barbellStep' | 'stackStep'>) {
  switch (load) {
    case 'barbell':
      return s.barbellStep
    case 'dumbbell':
    case 'kettlebell':
      return s.dumbbellStep
    case 'machine':
    case 'cable':
      return s.stackStep
    default:
      return 5
  }
}

/** Weights you can actually load for this equipment type. */
export function availableWeights(load: LoadType, s: Pick<Settings, 'dumbbellStep' | 'dumbbellMax' | 'barbellStep' | 'stackStep'>) {
  const out: number[] = []
  if (load === 'barbell') for (let w = 45; w <= 700; w += s.barbellStep) out.push(w)
  else if (load === 'dumbbell') for (let w = s.dumbbellStep; w <= s.dumbbellMax; w += s.dumbbellStep) out.push(w)
  else if (load === 'kettlebell') out.push(9, 13, 18, 26, 35, 44, 53, 62, 70, 80, 88, 97, 106)
  else if (load === 'machine' || load === 'cable') for (let w = s.stackStep; w <= 400; w += s.stackStep) out.push(w)
  return out
}

/** If the exact weight isn't available, suggest the nearest one with a rep adjustment that keeps effort similar. */
export function weightAdvice(
  load: LoadType,
  weight: number,
  reps: number,
  s: Pick<Settings, 'dumbbellStep' | 'dumbbellMax' | 'barbellStep' | 'stackStep'>,
) {
  const options = availableWeights(load, s)
  if (!options.length || options.includes(weight) || weight <= 0) return null
  const lower = [...options].reverse().find((w) => w < weight)
  const higher = options.find((w) => w > weight)
  const target = e1rm(weight, reps)
  const repsAt = (w: number) => Math.max(1, Math.round(30 * (target / w - 1)))
  const result: { weight: number; reps: number; text: string }[] = []
  const unit = load === 'dumbbell' ? 's' : ''
  if (lower) {
    const r = repsAt(lower)
    result.push({ weight: lower, reps: r, text: `Use ${lower}${unit} and ${r > reps ? `add ${r - reps} rep${r - reps === 1 ? '' : 's'}` : 'keep the reps'}` })
  }
  if (higher) {
    const r = repsAt(higher)
    result.push({ weight: higher, reps: r, text: `Or ${higher}${unit} for ${r} rep${r === 1 ? '' : 's'}` })
  }
  return result
}

// ---------- Muscles worked ----------

/** Sets per muscle: primary = 1 set, secondary = 0.5. */
export function setsPerMuscle(entries: { ex: Exercise; sets: number }[]) {
  const out: Partial<Record<MuscleSlug, number>> = {}
  for (const { ex, sets } of entries) {
    for (const m of ex.primary) out[m] = (out[m] ?? 0) + sets
    for (const m of ex.secondary) out[m] = (out[m] ?? 0) + sets * 0.5
  }
  return out
}

/** Normalize to 0–1 intensities for the glowing anatomy. */
export function intensities(perMuscle: Partial<Record<MuscleSlug, number>>) {
  const max = Math.max(1, ...Object.values(perMuscle).map((v) => v ?? 0))
  const out: Partial<Record<MuscleSlug, number>> = {}
  for (const [k, v] of Object.entries(perMuscle) as [MuscleSlug, number][]) out[k] = Math.min(1, 0.25 + 0.75 * (v / max))
  return out
}

export function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}
