// Profile = who uses this phone. Data stays on the device.
// M0 keeps it in localStorage; Milestone 1 moves everything into IndexedDB (Dexie).
import { useCallback, useSyncExternalStore } from 'react'
import type { ProgramId } from '../data/programs'
import type { Equipment } from '../data/exerciseTypes'

export type Profile = {
  name: string
  program: ProgramId
  body: 'male' | 'female'
  calorieTarget: number
  proteinTarget: number
  startDate: string // ISO date, Preseason starts here
  createdAt: string
  /** Optional countdown target, e.g. a trip. Stored only on this phone. */
  goal?: { label: string; date: string }
  settings?: Partial<Settings>
}

export type EquipmentProfileKey = 'gym' | 'travel' | 'home'

export type Settings = {
  equipmentProfile: EquipmentProfileKey
  equipment: Record<EquipmentProfileKey, Equipment[]>
  dumbbellStep: number // lb between dumbbells
  dumbbellMax: number
  barbellStep: number // smallest total jump (2 × smallest plate)
  stackStep: number // machine/cable pin steps
  rest: { power: number; heavy: number; secondary: number; accessory: number }
  celebration: 'full' | 'subtle' | 'off'
  shoppingDay: number // 0 = Sunday
  /** Season 2: Build switch (manual). */
  buildStartedAt?: string
  units: 'lb'
  sound: boolean
  /** Mondays of weeks marked as deload (half sets; never break a streak). */
  deloadWeeks?: string[]
}

const allEquipment: Equipment[] = [
  'barbell', 'trap-bar', 'dumbbells', 'kettlebell', 'cable', 'machine', 'smith', 'pull-up-bar', 'bench', 'box', 'med-ball', 'landmine', 'bands', 'bodyweight',
]

export const defaultSettings: Settings = {
  equipmentProfile: 'gym',
  equipment: {
    gym: allEquipment,
    travel: ['dumbbells', 'bands', 'bench', 'bodyweight'],
    home: ['bodyweight'],
  },
  dumbbellStep: 5,
  dumbbellMax: 120,
  barbellStep: 5,
  stackStep: 10,
  rest: { power: 120, heavy: 180, secondary: 150, accessory: 75 },
  celebration: 'full',
  shoppingDay: 0,
  units: 'lb',
  sound: true,
}

export function settingsOf(p: Profile | null): Settings {
  const s = p?.settings ?? {}
  return {
    ...defaultSettings,
    ...s,
    equipment: { ...defaultSettings.equipment, ...(s.equipment ?? {}) },
    rest: { ...defaultSettings.rest, ...(s.rest ?? {}) },
  }
}

export function updateSettings(p: Profile, patch: Partial<Settings>) {
  saveProfile({ ...p, settings: { ...settingsOf(p), ...patch } })
}

const KEY = 'lift-eat:profile:v1'
const listeners = new Set<() => void>()
let cache: Profile | null | undefined

function read(): Profile | null {
  if (cache !== undefined) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    cache = null
  }
  return cache
}

export function saveProfile(p: Profile | null) {
  cache = p
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l())
}

export function useProfile() {
  const profile = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => null,
  )
  const set = useCallback((p: Profile | null) => saveProfile(p), [])
  return [profile, set] as const
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
