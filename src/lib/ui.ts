// App-wide UI state: which full-screen experience is open.
import { useSyncExternalStore } from 'react'
import type { Workout } from './db'

type UI = { workoutOpen: boolean; recap: Workout | null; weekly: boolean; runOpen: boolean; runType: string }
let ui: UI = { workoutOpen: false, recap: null, weekly: false, runOpen: false, runType: 'Easy run' }
const listeners = new Set<() => void>()
const set = (patch: Partial<UI>) => {
  ui = { ...ui, ...patch }
  listeners.forEach((l) => l())
}

export const openWorkout = () => set({ workoutOpen: true })
export const closeWorkout = () => set({ workoutOpen: false })
export const showRecap = (w: Workout | null) => set({ recap: w, workoutOpen: false })
export const showWeekly = (on: boolean) => set({ weekly: on })
export const openRun = (type = 'Easy run') => set({ runOpen: true, runType: type })
export const closeRun = () => set({ runOpen: false })

export function useUI() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => ui,
    () => ui,
  )
}
