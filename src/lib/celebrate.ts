// Full-screen celebration queue (PR moments, rings closed, achievements, tier ups).
// Fast and skippable; respects the celebration setting (full / subtle / off).
import { useSyncExternalStore } from 'react'
import { haptic } from './haptics'

export type Celebration =
  | { kind: 'pr'; title: string; value: string; previous?: string; attribute?: string }
  | { kind: 'rings'; title: string }
  | { kind: 'achievement'; title: string; desc: string; rarity: string }
  | { kind: 'toast'; title: string }

let queue: Celebration[] = []
let mode: 'full' | 'subtle' | 'off' = 'full'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function setCelebrationMode(m: typeof mode) {
  mode = m
}

export function celebrate(c: Celebration) {
  if (mode === 'off') {
    haptic.success()
    return
  }
  haptic.celebrate()
  // Subtle mode turns everything into a quick toast.
  const item: Celebration = mode === 'subtle' && c.kind !== 'toast' ? { kind: 'toast', title: c.kind === 'pr' ? `PR: ${c.title} ${c.value}` : c.title } : c
  queue = [...queue, item]
  emit()
}

export function dismissCelebration() {
  queue = queue.slice(1)
  emit()
}

export function useCelebration() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => queue[0] ?? null,
    () => null,
  )
}
