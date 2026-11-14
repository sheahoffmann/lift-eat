// Rest timer: stored as an end timestamp so it stays correct if the app is
// backgrounded. Ends with a haptic, a chime, and a notification if permitted.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { haptic } from './haptics'

type State = { endsAt: number; total: number; label: string } | null
let state: State = null
const listeners = new Set<() => void>()
let tick: ReturnType<typeof setTimeout> | null = null
let soundOn = true

function emit() {
  listeners.forEach((l) => l())
}

export function setRestSound(on: boolean) {
  soundOn = on
}

function schedule() {
  if (tick) clearTimeout(tick)
  if (!state) return
  const ms = state.endsAt - Date.now()
  tick = setTimeout(done, Math.max(0, ms))
}

function done() {
  if (!state) return
  const label = state.label
  state = null
  emit()
  haptic.celebrate()
  if (soundOn) chime()
  try {
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then((r) => r.showNotification('Rest is up', { body: `Next set: ${label}`, tag: 'rest', silent: false }))
    }
  } catch {
    /* best effort */
  }
}

export function startRest(seconds: number, label: string) {
  state = { endsAt: Date.now() + seconds * 1000, total: seconds, label }
  schedule()
  emit()
  primeAudio()
}

export function addRest(seconds: number) {
  if (!state) return
  state = { ...state, endsAt: state.endsAt + seconds * 1000, total: state.total + seconds }
  schedule()
  emit()
}

export function skipRest() {
  state = null
  if (tick) clearTimeout(tick)
  emit()
}

export function useRest() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => null,
  )
  const [, force] = useState(0)
  useEffect(() => {
    if (!s) return
    const id = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [s])
  if (!s) return null
  const left = Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000))
  return { left, total: s.total, label: s.label }
}

// When the app comes back to the foreground, fire if the rest ended while away.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state && Date.now() >= state.endsAt) done()
  })
}

// ---------- Sound ----------

let ctx: AudioContext | null = null
function primeAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!ctx && AC) ctx = new AC()
    if (ctx?.state === 'suspended') ctx.resume()
  } catch {
    /* ignore */
  }
}

function chime() {
  if (!ctx) return
  const now = ctx.currentTime
  ;[880, 1320].forEach((f, i) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, now + i * 0.16)
    g.gain.exponentialRampToValueAtTime(0.3, now + i * 0.16 + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.35)
    o.connect(g).connect(ctx!.destination)
    o.start(now + i * 0.16)
    o.stop(now + i * 0.16 + 0.4)
  })
}

export async function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  } catch {
    /* ignore */
  }
}
