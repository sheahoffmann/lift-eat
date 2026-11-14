// Gamification, derived from real logged data (so undoing a log also undoes its XP).
// XP + levels, player attributes (1–99), card tier, weekly streaks with a monthly
// "injury reserve" freeze, and achievements.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type FoodLogEntry, type SetLog, type WeekPlan, type WeighIn, type Workout, type XPEvent } from './db'
import { exercises } from '../data/exercises'
import { programs, type ProgramId } from '../data/programs'
import { settingsOf, todayISO, type Profile } from './profile'
import { calorieRange, mealsForDay } from './nutrition'
import { daysBetween } from './season'
import { e1rm, effectiveLoad } from './training'
import { movingAverage } from './weighins'
import { achievementDefs, type AchievementDef } from '../data/achievements'

export type Tier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend'

export const XP = {
  workout: 100,
  cardio: 60,
  pr: 50,
  protein: 30,
  weighIn: 15,
  plan: 100,
  checkin: 75,
  allRings: 25,
}

// ---------- Levels ----------

const TITLES = ['Walk-on', 'Starter', 'Captain', 'All-Pro', 'MVP', 'Hall of Fame'] as const

export function levelFromXP(total: number) {
  let level = 1
  let need = 500
  let floor = 0
  while (total >= floor + need) {
    floor += need
    level++
    need = 500 + (level - 1) * 125
  }
  const title = TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 5))]
  return { level, title, into: total - floor, need }
}

export function tierFor(ovr: number): Tier {
  if (ovr >= 90) return 'legend'
  if (ovr >= 80) return 'elite'
  if (ovr >= 70) return 'gold'
  if (ovr >= 60) return 'silver'
  return 'bronze'
}

// ---------- Weeks ----------

/** Monday of the week containing `iso`. */
export function weekStart(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return todayISO(d)
}

export function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

// ---------- Inputs ----------

export type GameData = {
  workouts: Workout[]
  sets: SetLog[]
  food: FoodLogEntry[]
  plans: WeekPlan[]
  weighIns: WeighIn[]
  xpEvents: XPEvent[]
}

type DayFuel = { date: string; protein: number; cal: number; fuel: boolean; mealsPlanned: number; mealsLogged: number }

function dailyFuel(data: GameData, profile: Profile): Map<string, DayFuel> {
  const [lo, hi] = calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })
  const byDay = new Map<string, DayFuel>()
  for (const e of data.food) {
    const d = byDay.get(e.date) ?? { date: e.date, protein: 0, cal: 0, fuel: false, mealsPlanned: 0, mealsLogged: 0 }
    d.protein += e.protein
    d.cal += e.cal
    byDay.set(e.date, d)
  }
  for (const d of byDay.values()) {
    d.fuel = d.protein >= profile.proteinTarget - 5 && d.cal >= lo && d.cal <= hi
    const plan = data.plans.find((p) => p.startDate <= d.date && p.endDate >= d.date)
    if (plan) {
      const meals = mealsForDay(plan.picks, daysBetween(plan.startDate, new Date(d.date + 'T12:00:00')))
      d.mealsPlanned = meals.length
      const slots = new Set(data.food.filter((f) => f.date === d.date && f.slot !== 'other').map((f) => `${f.slot}:${f.slot === 'extra' ? f.mealId : ''}`))
      d.mealsLogged = Math.min(meals.length, slots.size)
    }
  }
  return byDay
}

// ---------- Strength standards (ratio of e1RM to body weight for a 99) ----------

const strengthLifts: Record<ProgramId, { id: string; std: number }[]> = {
  athletic: [
    { id: 'back-squat', std: 2.0 },
    { id: 'trap-bar-deadlift', std: 2.5 },
    { id: 'bench-press', std: 1.5 },
    { id: 'weighted-pull-up', std: 1.6 },
    { id: 'overhead-press', std: 1.0 },
  ],
  glute: [
    { id: 'hip-thrust', std: 2.0 },
    { id: 'romanian-deadlift', std: 1.25 },
    { id: 'goblet-squat', std: 0.6 },
    { id: 'leg-press', std: 2.5 },
    { id: 'db-bench-press', std: 0.4 },
  ],
}

export function bestE1RM(sets: SetLog[], exId: string, bodyweight: number) {
  const ex = exercises[exId]
  if (!ex) return 0
  return Math.max(0, ...sets.filter((s) => s.exerciseId === exId).map((s) => e1rm(effectiveLoad(ex, s.weight, s.bodyweight ?? bodyweight), s.reps)))
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const rate = (score: number) => Math.round(40 + 59 * clamp01(score))

export type Attributes = { strength: number; power: number; engine: number; discipline: number; ovr: number }

export function computeAttributes(data: GameData, profile: Profile, today = todayISO()): Attributes {
  const bw = data.weighIns.filter((w) => w.lb > 0).at(-1)?.lb ?? (profile.body === 'female' ? 135 : 190)
  const lifts = strengthLifts[profile.program]
  const strength = rate(
    lifts.reduce((s, l) => s + Math.pow(clamp01(bestE1RM(data.sets, l.id, bw) / bw / l.std), 1.15), 0) / lifts.length,
  )

  // Rolling window: last 28 days, or since start if newer.
  const windowDays = Math.max(7, Math.min(28, daysBetween(profile.startDate, new Date(today + 'T12:00:00')) + 1))
  const from = addDaysISO(today, -windowDays + 1)
  const recent = data.workouts.filter((w) => w.finishedAt && w.date >= from && w.date <= today)
  const program = programs[profile.program]
  const weeks = windowDays / 7

  // Power: power-role work (or heavy work for programs without power) + speed days.
  const powerRole = profile.program === 'athletic' ? 'power' : 'heavy'
  const plannedPower = program.week.reduce((n, d) => n + d.exercises.filter((e) => e.role === powerRole).length, 0) * weeks
  const donePower = recent.reduce((n, w) => n + w.plan.filter((p) => p.role === powerRole && data.sets.some((s) => s.workoutId === w.id && s.slotEx === p.slotEx)).length, 0)
  const speedPlanned = program.week.filter((d) => d.kind === 'sprint').length * weeks
  const speedDone = recent.filter((w) => w.kind === 'sprint').length
  const power = rate((donePower + speedDone) / Math.max(1, plannedPower + speedPlanned))

  // Engine: conditioning sessions + minutes (target ≈ 2 sessions / 90 min a week).
  const cardio = recent.filter((w) => w.cardio)
  const minutes = cardio.reduce((m, w) => m + (w.cardio?.minutes ?? 0), 0)
  const engine = rate(0.5 * clamp01(cardio.length / (2 * weeks)) + 0.5 * clamp01(minutes / (90 * weeks)))

  // Discipline: protein days, meals logged, weigh-ins, weeks planned.
  const fuel = dailyFuel(data, profile)
  let proteinDays = 0
  let mealRatio = 0
  for (let i = 0; i < windowDays; i++) {
    const d = fuel.get(addDaysISO(today, -i))
    if (d && d.protein >= profile.proteinTarget - 5) proteinDays++
    if (d && d.mealsPlanned) mealRatio += d.mealsLogged / d.mealsPlanned
  }
  const weighDays = data.weighIns.filter((w) => w.date >= from && w.lb > 0).length
  const weekStarts = new Set<string>()
  for (let i = 0; i < windowDays; i += 7) weekStarts.add(weekStart(addDaysISO(today, -i)))
  const plannedWeeks = [...weekStarts].filter((ws) => data.plans.some((p) => p.startDate <= addDaysISO(ws, 6) && p.endDate >= ws)).length
  const discipline = rate(
    0.35 * (proteinDays / windowDays) + 0.25 * (mealRatio / windowDays) + 0.2 * (weighDays / windowDays) + 0.2 * (plannedWeeks / Math.max(1, weekStarts.size)),
  )

  const ovr = Math.round(strength * 0.3 + power * 0.2 + engine * 0.2 + discipline * 0.3)
  return { strength, power, engine, discipline, ovr }
}

// ---------- XP ----------

export function computeXP(data: GameData, profile: Profile): XPEvent[] {
  const out: XPEvent[] = []
  for (const w of data.workouts) {
    if (!w.finishedAt) continue
    out.push({ id: `workout:${w.id}`, date: w.date, amount: w.cardio ? XP.cardio : XP.workout, reason: w.cardio ? 'Conditioning done' : 'Workout finished', ref: w.id })
    for (const pr of (w.prs ?? []).slice(0, 3)) out.push({ id: `pr:${w.id}:${pr.exerciseId}:${pr.kind}`, date: w.date, amount: XP.pr, reason: 'New PR', ref: w.id })
  }
  for (const wi of data.weighIns) if (wi.lb > 0) out.push({ id: `weigh:${wi.date}`, date: wi.date, amount: XP.weighIn, reason: 'Weigh-in' })
  for (const d of dailyFuel(data, profile).values()) {
    if (d.protein >= profile.proteinTarget - 5) out.push({ id: `protein:${d.date}`, date: d.date, amount: XP.protein, reason: 'Protein target hit' })
  }
  for (const p of data.plans) out.push({ id: `plan:${p.id}`, date: p.lockedAt.slice(0, 10), amount: XP.plan, reason: 'Week locked in' })
  // Explicit events (weekly check-ins, ring bonuses) stored in the ledger.
  for (const e of data.xpEvents) out.push(e)
  return out
}

// ---------- Streaks ----------

export type WeekStatus = { start: string; status: 'hit' | 'frozen' | 'missed' | 'current' | 'rest'; workouts: number; fuelDays: number }

export function computeStreak(data: GameData, profile: Profile, today = todayISO()) {
  const start = weekStart(profile.startDate)
  const current = weekStart(today)
  const fuel = dailyFuel(data, profile)
  const settings = settingsOf(profile)
  const deloads = new Set(settings.deloadWeeks ?? [])
  const weeks: WeekStatus[] = []
  const freezesByMonth = new Map<string, number>()
  let streak = 0

  for (let ws = start; ws <= current; ws = addDaysISO(ws, 7)) {
    const we = addDaysISO(ws, 6)
    const done = data.workouts.filter((w) => w.finishedAt && w.date >= ws && w.date <= we)
    const lifts = done.filter((w) => w.kind === 'lift').length
    const cardio = done.filter((w) => w.kind !== 'lift').length
    const counted = Math.min(lifts, 4) + Math.min(cardio, 1)
    let fuelDays = 0
    for (let i = 0; i < 7; i++) if (fuel.get(addDaysISO(ws, i))?.fuel) fuelDays++
    const hit = counted >= 4 && fuelDays >= 5
    if (ws === current) {
      weeks.push({ start: ws, status: hit ? 'hit' : 'current', workouts: counted, fuelDays })
      if (hit) streak++
      continue
    }
    if (deloads.has(ws)) {
      weeks.push({ start: ws, status: 'rest', workouts: counted, fuelDays })
      continue
    }
    if (hit) {
      streak++
      weeks.push({ start: ws, status: 'hit', workouts: counted, fuelDays })
    } else {
      const month = ws.slice(0, 7)
      if (!freezesByMonth.get(month) && streak > 0) {
        freezesByMonth.set(month, 1)
        weeks.push({ start: ws, status: 'frozen', workouts: counted, fuelDays })
      } else {
        streak = 0
        weeks.push({ start: ws, status: 'missed', workouts: counted, fuelDays })
      }
    }
  }
  const best = weeks.reduce(
    (acc, w) => {
      const run = w.status === 'hit' ? acc.run + 1 : w.status === 'missed' ? 0 : acc.run
      return { run, best: Math.max(acc.best, run) }
    },
    { run: 0, best: 0 },
  ).best
  const freezeAvailable = !freezesByMonth.get(current.slice(0, 7))
  return { streak, best, weeks, freezeAvailable }
}

// ---------- Achievements ----------

export type AchievementState = AchievementDef & { unlocked: boolean; progress: number }

export function computeAchievements(data: GameData, profile: Profile, streakBest: number): AchievementState[] {
  const bw = data.weighIns.filter((w) => w.lb > 0).at(-1)?.lb ?? 190
  const finished = data.workouts.filter((w) => w.finishedAt)
  const prCount = finished.reduce((n, w) => n + (w.prs?.length ?? 0), 0)
  const avg = movingAverage(data.weighIns)
  const lost = avg.length ? Math.max(0, avg[0].lb - avg.at(-1)!.avg) : 0
  const maxWeight = (id: string) => Math.max(0, ...data.sets.filter((s) => s.exerciseId === id && s.reps >= 1).map((s) => s.weight))
  const fuel = [...dailyFuel(data, profile).values()]
  // Consecutive planned weeks.
  const planWeeks = new Set(data.plans.map((p) => weekStart(p.startDate)))
  let planRun = 0
  let bestPlanRun = 0
  const sortedWeeks = [...planWeeks].sort()
  for (let i = 0; i < sortedWeeks.length; i++) {
    planRun = i > 0 && addDaysISO(sortedWeeks[i - 1], 7) === sortedWeeks[i] ? planRun + 1 : 1
    bestPlanRun = Math.max(bestPlanRun, planRun)
  }
  const preseasonDone = daysBetween(profile.startDate) >= 21

  const metric: Record<string, number> = {
    workouts: finished.length,
    prs: prCount,
    streak: streakBest,
    planWeeks: bestPlanRun,
    lost,
    bench: maxWeight('bench-press'),
    squat: maxWeight('back-squat'),
    trapbar: maxWeight('trap-bar-deadlift'),
    pullupAdded: maxWeight('weighted-pull-up'),
    hipThrustRatio: maxWeight('hip-thrust') / bw,
    weighIns: data.weighIns.filter((w) => w.lb > 0).length,
    proteinDays: fuel.filter((d) => d.protein >= profile.proteinTarget - 5).length,
    preseason: preseasonDone ? 1 : 0,
    cardio: finished.filter((w) => w.cardio).length,
  }

  return achievementDefs
    .filter((a) => !a.program || a.program === profile.program)
    .map((a) => {
      const v = metric[a.metric] ?? 0
      return { ...a, unlocked: v >= a.target, progress: clamp01(v / a.target) }
    })
}

// ---------- Hook ----------

export function useGameData(): GameData | undefined {
  return useLiveQuery(async () => {
    const [workouts, sets, food, plans, weighIns, xpEvents] = await Promise.all([
      db.workouts.toArray(),
      db.sets.toArray(),
      db.foodLog.toArray(),
      db.plans.toArray(),
      db.weighIns.orderBy('date').toArray(),
      db.xp.toArray(),
    ])
    return { workouts, sets, food, plans, weighIns, xpEvents }
  }, [])
}

export function computeGame(data: GameData, profile: Profile) {
  const events = computeXP(data, profile)
  const totalXP = events.reduce((s, e) => s + e.amount, 0)
  const level = levelFromXP(totalXP)
  const attributes = computeAttributes(data, profile)
  const streak = computeStreak(data, profile)
  const achievements = computeAchievements(data, profile, streak.best)
  return { events, totalXP, level, attributes, tier: tierFor(attributes.ovr), streak, achievements }
}

export type Game = ReturnType<typeof computeGame>

export function useGame(profile: Profile | null) {
  const data = useGameData()
  if (!data || !profile) return null
  return { data, ...computeGame(data, profile) }
}

/** Persist today's attribute snapshot and first-unlock dates (for history + "new" badges). */
export async function persistGame(game: Game) {
  const today = todayISO()
  await db.attributes.put({ date: today, ...game.attributes })
  const unlocked = game.achievements.filter((a) => a.unlocked)
  const existing = new Set((await db.achievements.toArray()).map((a) => a.id))
  const fresh = unlocked.filter((a) => !existing.has(a.id))
  if (fresh.length) await db.achievements.bulkPut(fresh.map((a) => ({ id: a.id, unlockedAt: new Date().toISOString(), seen: false })))
  return fresh
}

export function xpForWorkout(w: Workout) {
  return (w.cardio ? XP.cardio : XP.workout) + Math.min(3, w.prs?.length ?? 0) * XP.pr
}
