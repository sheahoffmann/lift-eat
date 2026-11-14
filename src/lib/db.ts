// On-device database (IndexedDB via Dexie). Nothing leaves the phone.
import Dexie, { type Table } from 'dexie'
import type { Slot } from '../data/meals'

export type Picks = {
  breakfast: string
  lunch: string
  snack: string
  /** One dinner, or two that alternate day by day. */
  dinner: string[]
  evening: string | null
  extras: string[]
}

export type WeekPlan = {
  id: string
  startDate: string // first day the plan covers (ISO)
  endDate: string // last day, inclusive
  picks: Picks
  portion: number // ingredient scale for this profile's calorie target
  calorieTarget: number
  proteinTarget: number
  pantryHave: string[] // grocery item ids skipped because they're already in the kitchen
  checked: string[] // grocery lines checked off in the store
  lockedAt: string
}

export type FoodLogEntry = {
  id: string
  date: string // ISO day
  /** Planned slot this entry fills, or 'extra' for planned extras, or 'other' for unplanned food. */
  slot: Slot | 'extra' | 'other'
  mealId?: string // planned meal or extra id
  planned: boolean
  name: string
  servings: number
  cal: number
  protein: number
  carbs: number
  fat: number
  myFoodId?: string
  createdAt: string
}

export type MyFood = {
  id: string
  name: string
  servingLabel: string
  cal: number
  protein: number
  carbs: number
  fat: number
  /** 'label-photo' is reserved for the future Claude nutrition-label reader. */
  source: 'manual' | 'barcode' | 'label-photo'
  barcode?: string
  uses: number
  lastUsed: string
}

// ---------- Training ----------

export type PRKind = 'weight' | 'reps' | 'e1rm' | 'duration' | 'distance'
export type PR = {
  exerciseId: string
  kind: PRKind
  value: number
  previous: number | null
  weight?: number
  reps?: number
}

export type CardioLog = { type: string; minutes: number; distanceMi?: number; mobility?: boolean; rounds?: number }

export type Workout = {
  id: string
  date: string
  sessionKey: string
  name: string
  kind: 'lift' | 'run' | 'sprint' | 'optional' | 'rest'
  phase: string
  equipmentProfile: string
  startedAt: string
  finishedAt?: string
  durationSec?: number
  /** Exercises as performed, in order (after swaps). */
  plan: { slotEx: string; ex: string; sets: number; reps: [number, number]; rest: number; perSide?: boolean; seconds?: number; yards?: number; role: string }[]
  notes?: Record<string, string>
  cardio?: CardioLog
  volume?: number // lb, includes estimated body weight moved
  setsDone?: number
  prs?: PR[]
  xp?: number
  recapSeen?: boolean
}

export type SetLog = {
  id: string
  workoutId: string
  date: string
  exerciseId: string // the variant actually performed (history/PRs are per variant)
  slotEx: string // the program exercise it fills
  setIndex: number
  weight: number // lb (added load for bodyweight moves; assist weight for assisted)
  reps: number
  seconds?: number
  yards?: number
  bodyweight?: number // body weight at the time, for volume
  completedAt: string
}

export type ExerciseSettings = {
  exerciseId: string
  videoUrl?: string
  videoStart?: number // seconds
  note?: string
}

export type ProgramOverride = {
  id: string // `${sessionKey}:${slotEx}`
  replacement: string
}

export type WeighIn = { date: string; lb: number; waist?: number }

export type XPEvent = { id: string; date: string; amount: number; reason: string; ref?: string }

export type AchievementUnlock = { id: string; unlockedAt: string; seen?: boolean }

/** A GPS-tracked (or GPX-imported) run. Points: [lat, lon, time ms, altitude | null, segment]. */
export type RunRecord = {
  id: string
  status: 'active' | 'done'
  source: 'gps' | 'gpx'
  type: string
  startedAt: string
  endedAt?: string
  points: [number, number, number, number | null, number][]
  /** Paused intervals (ms timestamps); moving time excludes them. */
  pauses: { start: number; end?: number }[]
  distanceM?: number
  movingSec?: number
  splits?: number[]
  elevGainM?: number
  workoutId?: string
  name?: string
}

/** Training pet (dinosaur). One active at a time; captured ones stay forever. */
export type Pet = {
  id: string
  species: string
  status: 'active' | 'captured'
  hatchedAt: string // ISO day growth starts counting
  capturedAt?: string
  createdAt: string
}

/** A meal option the user added to the planner. */
export type CustomMeal = {
  id: string
  slot: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening'
  name: string
  desc: string
  cal: number
  protein: number
  carbs: number
  fat: number
  groceries: { name: string; amount: number; unit: string }[]
  createdAt: string
}

export type AttributeSnapshot = { date: string; strength: number; power: number; engine: number; discipline: number; ovr: number }

class LiftEatDB extends Dexie {
  plans!: Table<WeekPlan, string>
  foodLog!: Table<FoodLogEntry, string>
  myFoods!: Table<MyFood, string>
  workouts!: Table<Workout, string>
  sets!: Table<SetLog, string>
  exerciseSettings!: Table<ExerciseSettings, string>
  overrides!: Table<ProgramOverride, string>
  weighIns!: Table<WeighIn, string>
  xp!: Table<XPEvent, string>
  achievements!: Table<AchievementUnlock, string>
  attributes!: Table<AttributeSnapshot, string>
  customMeals!: Table<CustomMeal, string>
  runs!: Table<RunRecord, string>
  pets!: Table<Pet, string>
  supplementLog!: Table<{ id: string; date: string; suppId: string; at: string }, string>

  constructor() {
    super('lift-eat')
    this.version(1).stores({
      plans: 'id, startDate, endDate',
      foodLog: 'id, date, slot, mealId',
      myFoods: 'id, name, lastUsed, barcode',
    })
    this.version(6).stores({
      supplementLog: 'id, date, suppId',
    })
    this.version(5).stores({
      pets: 'id, status, species',
    })
    this.version(4).stores({
      runs: 'id, workoutId, status',
    })
    this.version(3).stores({
      customMeals: 'id, slot',
    })
    this.version(2).stores({
      workouts: 'id, date, sessionKey, finishedAt',
      sets: 'id, workoutId, date, exerciseId, [exerciseId+date]',
      exerciseSettings: 'exerciseId',
      overrides: 'id',
      weighIns: 'date',
      xp: 'id, date, reason, ref',
      achievements: 'id',
      attributes: 'date',
    })
  }
}

export const db = new LiftEatDB()

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

// Ask the browser not to evict our data under storage pressure.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}
