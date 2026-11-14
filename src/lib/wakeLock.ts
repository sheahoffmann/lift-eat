// Keep the screen on during a run (Screen Wake Lock API, iOS 18.4+ in home-screen apps).
// iPhone drops the lock whenever the app is hidden, so it's re-requested on return.
import { useSyncExternalStore } from 'react'

type State = 'off' | 'on' | 'unsupported' | 'error'
let state: State = 'off'
let wanted = false
let sentinel: { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void } | null = null
const listeners = new Set<() => void>()
let snapshot: { state: State; wanted: boolean } = { state, wanted }
const emit = () => {
  snapshot = { state, wanted }
  listeners.forEach((l) => l())
}
const set = (s: State) => {
  state = s
  emit()
}

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

async function acquire() {
  if (!wakeLockSupported()) return set('unsupported')
  try {
    sentinel = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<typeof sentinel> } }).wakeLock.request('screen')
    sentinel?.addEventListener('release', () => {
      sentinel = null
      if (wanted) set('off') // will re-acquire on return to foreground
    })
    set('on')
  } catch {
    set('error')
  }
}

export async function keepScreenOn() {
  wanted = true
  await acquire()
}

export async function allowScreenLock() {
  wanted = false
  try {
    await sentinel?.release()
  } catch {
    /* ignore */
  }
  sentinel = null
  set('off')
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted && !sentinel) acquire()
  })
}

export function useWakeLock() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
    () => snapshot,
  )
}
