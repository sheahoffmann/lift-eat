import { describe, expect, it } from 'vitest'
import { exercises, exerciseList } from '../data/exercises'
import { programs } from '../data/programs'
import type { SetLog, Workout } from './db'
import { beatLastTime, detectPR, e1rm, setsPerMuscle, weightAdvice } from './training'
import { autoSubstitute, canDo, swapCandidates } from './swaps'
import { computeStreak, levelFromXP, tierFor, weekStart } from './game'
import { defaultSettings, type Profile } from './profile'

const set = (exerciseId: string, weight: number, reps: number, extra: Partial<SetLog> = {}): SetLog => ({
  id: Math.random().toString(),
  workoutId: 'w0',
  date: '2026-11-10',
  exerciseId,
  slotEx: exerciseId,
  setIndex: 0,
  weight,
  reps,
  bodyweight: 190,
  completedAt: '2026-11-10T10:00:00Z',
  ...extra,
})

describe('library + programs', () => {
  it('every programmed exercise and home substitute exists', () => {
    for (const p of Object.values(programs))
      for (const d of p.week)
        for (const e of d.exercises) {
          expect(exercises[e.ex], e.ex).toBeDefined()
          if (e.home) expect(exercises[e.home], e.home).toBeDefined()
        }
  })
  it('every exercise has 3 cues and a mistake', () => {
    for (const e of exerciseList) {
      expect(e.cues).toHaveLength(3)
      expect(e.mistake.length).toBeGreaterThan(5)
    }
  })
})

describe('e1RM + PRs', () => {
  it('Epley', () => {
    expect(e1rm(225, 1)).toBe(225)
    expect(Math.round(e1rm(200, 5))).toBe(233)
  })
  it('first performance is a baseline, not a PR', () => {
    expect(detectPR(exercises['back-squat'], set('back-squat', 225, 5), [], 190)).toBeNull()
  })
  it('detects weight, e1RM and rep PRs', () => {
    const hist = [set('back-squat', 225, 5)]
    expect(detectPR(exercises['back-squat'], set('back-squat', 235, 3), hist, 190)?.kind).toBe('weight')
    expect(detectPR(exercises['back-squat'], set('back-squat', 225, 7), hist, 190)?.kind).toBe('e1rm')
    expect(detectPR(exercises['back-squat'], set('back-squat', 215, 5), hist, 190)).toBeNull()
  })
})

describe('progression + weight availability', () => {
  const s = defaultSettings
  it('adds weight at the top of the rep range, otherwise a rep', () => {
    expect(beatLastTime(exercises['back-squat'], { weight: 225, reps: 6 }, [4, 6], s)?.weight).toBe(230)
    expect(beatLastTime(exercises['back-squat'], { weight: 225, reps: 4 }, [4, 6], s)?.reps).toBe(5)
  })
  it('suggests the nearest dumbbell with more reps', () => {
    const advice = weightAdvice('dumbbell', 47.5, 8, { ...s, dumbbellStep: 5 })!
    expect(advice[0].weight).toBe(45)
    expect(advice[0].reps).toBeGreaterThan(8)
    expect(advice[0].text).toMatch(/Use 45s and add/)
  })
})

describe('swaps', () => {
  it('finds same-pattern alternatives with available gear', () => {
    const travel = defaultSettings.equipment.travel
    const alts = swapCandidates('back-squat', travel, 'no-equipment')
    expect(alts.length).toBeGreaterThanOrEqual(3)
    for (const a of alts) expect(canDo(a, travel)).toBe(true)
  })
  it('home profile turns every Glute Builder exercise into something doable', () => {
    for (const d of programs.glute.week)
      for (const e of d.exercises) {
        const sub = autoSubstitute(e.ex, ['bodyweight'], e.home)
        expect(canDo(exercises[sub], ['bodyweight']), `${e.ex} → ${sub}`).toBe(true)
      }
  })
  it('sets per muscle counts secondary as half', () => {
    const m = setsPerMuscle([{ ex: exercises['bench-press'], sets: 4 }])
    expect(m.chest).toBe(4)
    expect(m.deltoids).toBe(2)
  })
})

describe('levels, tiers, streaks', () => {
  it('levels and titles', () => {
    expect(levelFromXP(0).level).toBe(1)
    expect(levelFromXP(500).level).toBe(2)
    expect(levelFromXP(0).title).toBe('Walk-on')
    expect(tierFor(72)).toBe('gold')
  })
  it('weeks start Monday', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09')
  })
  it('a missed week uses the monthly freeze once the streak has started', () => {
    const profile: Profile = { name: 'T', program: 'athletic', body: 'male', calorieTarget: 2250, proteinTarget: 190, startDate: '2026-11-02', createdAt: '' }
    const workoutsFor = (ws: string, n: number): Workout[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `${ws}-${i}`,
        date: ws,
        sessionKey: 'x',
        name: 'x',
        kind: i < 4 ? 'lift' : 'run',
        phase: 'cut',
        equipmentProfile: 'gym',
        startedAt: '',
        finishedAt: 'x',
        plan: [],
      }))
    const food = (ws: string) =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(ws + 'T12:00:00')
        d.setDate(d.getDate() + i)
        const date = d.toISOString().slice(0, 10)
        return { id: date, date, slot: 'other' as const, planned: false, name: 'x', servings: 1, cal: 2200, protein: 195, carbs: 0, fat: 0, createdAt: '' }
      })
    const data = {
      workouts: [...workoutsFor('2026-11-02', 5), ...workoutsFor('2026-11-16', 5)],
      sets: [],
      food: [...food('2026-11-02'), ...food('2026-11-16')],
      plans: [],
      weighIns: [],
      xpEvents: [],
    }
    const s = computeStreak(data, profile, '2026-11-24')
    expect(s.weeks.map((w) => w.status)).toEqual(['hit', 'frozen', 'hit', 'current'])
    expect(s.streak).toBe(2)
  })
})
