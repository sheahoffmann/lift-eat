import { describe, expect, it } from 'vitest'
import { computeProgress, rollSpecies } from './pet'
import { dinoSpecies } from '../data/dinos'
import type { GameData } from './game'
import type { Pet, Workout, FoodLogEntry } from './db'
import type { Profile } from './profile'

const profile: Profile = { name: 'T', program: 'athletic', body: 'male', calorieTarget: 2250, proteinTarget: 190, startDate: '2026-11-01', createdAt: '' }
const workout = (date: string): Workout => ({ id: date, date, sessionKey: 'x', name: 'x', kind: 'lift', phase: 'cut', equipmentProfile: 'gym', startedAt: '', finishedAt: 'x', plan: [] })
const meals = (date: string): FoodLogEntry[] =>
  [1, 2, 3].map((i) => ({ id: `${date}-${i}`, date, slot: 'other' as const, planned: false, name: 'x', servings: 1, cal: 700, protein: 65, carbs: 0, fat: 0, createdAt: '' }))
const data = (days: string[], workoutDays = days): GameData => ({
  workouts: workoutDays.map(workout),
  sets: [],
  food: days.flatMap(meals),
  plans: [],
  weighIns: [],
  xpEvents: [],
})
const pet = (species: string, hatchedAt: string): Pet => ({ id: 'p', species, status: 'active', hatchedAt, createdAt: '' })

describe('training pet', () => {
  it('starts as an egg and grows one stage per fed day', () => {
    const p0 = computeProgress(pet('triceratops', '2026-11-16'), data([]), profile, '2026-11-16')
    expect(p0.stage).toBe('Egg')
    // Mon–Wed trained + ate: a common dino (3 days) is ready to capture.
    const p = computeProgress(pet('triceratops', '2026-11-16'), data(['2026-11-16', '2026-11-17', '2026-11-18']), profile, '2026-11-18')
    expect(p.progress).toBe(3)
    expect(p.captureReady).toBe(true)
  })

  it('shrinks on missed days but never back to an egg', () => {
    // Fed Mon+Tue, then missed Wed and Thu (planned lift days, no workout, no food).
    const p = computeProgress(pet('velociraptor', '2026-11-16'), data(['2026-11-16', '2026-11-17']), profile, '2026-11-20')
    expect(p.progress).toBe(1)
    expect(p.trend).toBe('shrinking')
    expect(p.stage).not.toBe('Egg')
  })

  it("doesn't count today against you until it's over", () => {
    const p = computeProgress(pet('velociraptor', '2026-11-16'), data(['2026-11-16']), profile, '2026-11-17')
    expect(p.progress).toBe(1)
    expect(p.todayFed).toBe(false)
  })

  it('rolls an uncaptured species, weighted by rarity', () => {
    const all = dinoSpecies.map((s) => s.id)
    const left = rollSpecies(all.filter((id) => id !== 'brachiosaurus'))
    expect(left.id).toBe('brachiosaurus')
    const counts: Record<string, number> = {}
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 4000; i++) {
      const r = rollSpecies([], rand).rarity
      counts[r] = (counts[r] ?? 0) + 1
    }
    expect(counts.common).toBeGreaterThan(counts.rare)
    expect(counts.rare).toBeGreaterThan(counts.epic)
    expect(counts.epic).toBeGreaterThan(counts.legendary)
  })
})
