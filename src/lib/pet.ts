// Training pet: a random dinosaur egg grows on consistent days and shrinks on missed ones.
// Progress is recomputed from real logged data (so undoing a log undoes the feeding).
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type Pet } from './db'
import { dinoSpecies, rarityInfo, speciesById, type DinoRarity, type DinoSpecies } from '../data/dinos'
import { programs } from '../data/programs'
import { calorieRange } from './nutrition'
import { todayISO, type Profile } from './profile'
import type { GameData } from './game'

export type DayStatus = { date: string; train: boolean; fuel: boolean; log: boolean; fed: boolean; missed: boolean }

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

/** Did this day count? Train ring (workout or planned rest) + Fuel or Log. */
export function dayStatus(data: GameData, profile: Profile, date: string): DayStatus {
  const dow = new Date(date + 'T12:00:00').getDay()
  const planned = programs[profile.program].week[dow]
  const worked = data.workouts.some((w) => w.finishedAt && w.date === date)
  const train = worked || planned.kind === 'rest' || planned.kind === 'optional'
  const food = data.food.filter((f) => f.date === date)
  const protein = food.reduce((s, f) => s + f.protein, 0)
  const cal = food.reduce((s, f) => s + f.cal, 0)
  const [lo, hi] = calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })
  const fuel = protein >= profile.proteinTarget - 5 && cal >= lo && cal <= hi
  const weighed = data.weighIns.some((w) => w.date === date && w.lb > 0)
  const log = food.length >= 3 || (weighed && food.length >= 1)
  const fed = train && (fuel || log)
  return { date, train, fuel, log, fed, missed: !fed }
}

export const STAGES = ['Egg', 'Hatchling', 'Baby', 'Juvenile', 'Adult'] as const
export type Stage = (typeof STAGES)[number] | 'Captured'

export type PetProgress = {
  pet: Pet
  species: DinoSpecies
  target: number
  progress: number // consistent-day points (0..target)
  stage: Stage
  growth: number // 0..1 visual size
  todayFed: boolean
  today: DayStatus
  trend: 'growing' | 'shrinking' | 'steady'
  captureReady: boolean
}

/**
 * Walk each day from hatch: fed +1, missed −1 (never below 1 once hatched).
 * Today only counts once it's fed, so you're never penalized before the day is over.
 */
export function computeProgress(pet: Pet, data: GameData, profile: Profile, today = todayISO()): PetProgress {
  const species = speciesById[pet.species] ?? dinoSpecies[0]
  const target = rarityInfo[species.rarity].daysToCapture
  let p = 0
  let last: 'growing' | 'shrinking' | 'steady' = 'steady'
  for (let d = pet.hatchedAt; d < today; d = addDays(d, 1)) {
    const s = dayStatus(data, profile, d)
    if (s.fed) {
      p = Math.min(target, p + 1)
      last = 'growing'
    } else if (p > 0) {
      p = Math.max(1, p - 1)
      last = 'shrinking'
    }
  }
  const todayStatus = dayStatus(data, profile, today)
  if (pet.hatchedAt <= today && todayStatus.fed) {
    p = Math.min(target, p + 1)
    last = 'growing'
  }
  const frac = p / target
  const stage: Stage = pet.capturedAt ? 'Captured' : p === 0 ? 'Egg' : frac < 0.34 ? 'Hatchling' : frac < 0.67 ? 'Baby' : frac < 1 ? 'Juvenile' : 'Adult'
  return {
    pet,
    species,
    target,
    progress: p,
    stage,
    growth: pet.capturedAt ? 1 : p === 0 ? 0 : 0.35 + 0.65 * frac,
    todayFed: todayStatus.fed,
    today: todayStatus,
    trend: last,
    captureReady: !pet.capturedAt && p >= target,
  }
}

/** Weighted random rarity, then a species you haven't captured yet (if any left). */
export function rollSpecies(captured: string[], rand = Math.random): DinoSpecies {
  const rarities = Object.entries(rarityInfo) as [DinoRarity, (typeof rarityInfo)[DinoRarity]][]
  const fresh = (r: DinoRarity) => dinoSpecies.filter((s) => s.rarity === r && !captured.includes(s.id))
  const available = rarities.filter(([r]) => fresh(r).length)
  const pool = available.length ? available : rarities
  const total = pool.reduce((s, [, i]) => s + i.weight, 0)
  let roll = rand() * total
  let rarity = pool[0][0]
  for (const [r, info] of pool) {
    roll -= info.weight
    if (roll <= 0) {
      rarity = r
      break
    }
  }
  const options = fresh(rarity).length ? fresh(rarity) : dinoSpecies.filter((s) => s.rarity === rarity)
  return options[Math.floor(rand() * options.length)]
}

export async function ensurePet() {
  const active = await db.pets.where('status').equals('active').first()
  if (active) return active
  const captured = (await db.pets.where('status').equals('captured').toArray()).map((p) => p.species)
  const species = rollSpecies(captured)
  const pet: Pet = { id: uid(), species: species.id, status: 'active', hatchedAt: todayISO(), createdAt: new Date().toISOString() }
  await db.pets.add(pet)
  return pet
}

/** Capture the grown pet and start a new egg tomorrow. */
export async function capturePet(pet: Pet) {
  const captured = (await db.pets.where('status').equals('captured').toArray()).map((p) => p.species)
  const next = rollSpecies([...captured, pet.species])
  await db.transaction('rw', db.pets, async () => {
    await db.pets.update(pet.id, { status: 'captured', capturedAt: new Date().toISOString() })
    await db.pets.add({ id: uid(), species: next.id, status: 'active', hatchedAt: addDays(todayISO(), 1), createdAt: new Date().toISOString() })
  })
  return next
}

export function usePets() {
  return useLiveQuery(() => db.pets.toArray(), [], undefined)
}
