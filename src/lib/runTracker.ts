// Live GPS run tracking. State lives at module level (survives sheets closing) and is
// saved to IndexedDB every few seconds so a reload never loses the run.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { db, uid, type RunRecord, type Workout } from './db'
import { acceptFix, currentPace, elevationGain, METERS_PER_MILE, mileSplits, totalDistance, formatPace, type RunPoint } from './runMath'
import { allowScreenLock } from './wakeLock'
import { haptic } from './haptics'
import { programs } from '../data/programs'
import { todayISO, type Profile } from './profile'
import { phaseOf } from './workoutStore'

type Status = 'idle' | 'running' | 'paused'

type Live = {
  status: Status
  run: RunRecord | null
  accuracy: number | null
  gpsError: string | null
  lastFixAt: number | null
}

let live: Live = { status: 'idle', run: null, accuracy: null, gpsError: null, lastFixAt: null }
let watchId: number | null = null
let saveTimer: ReturnType<typeof setInterval> | null = null
let announcedMiles = 0
let voiceOn = true
const listeners = new Set<() => void>()

function set(patch: Partial<Live>) {
  live = { ...live, ...patch }
  listeners.forEach((l) => l())
}

export function setRunVoice(on: boolean) {
  voiceOn = on
}

function speak(text: string) {
  if (!voiceOn || typeof speechSynthesis === 'undefined') return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.02
    speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

function paceWords(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m} minute${m === 1 ? '' : 's'}${s ? ` ${s} seconds` : ''}`
}

function persist() {
  if (live.run) db.runs.put(live.run).catch(() => {})
}

function onFix(pos: GeolocationPosition) {
  const run = live.run
  if (!run || live.status !== 'running') {
    set({ accuracy: pos.coords.accuracy, gpsError: null })
    return
  }
  const seg = run.pauses.length
  const p: RunPoint = [pos.coords.latitude, pos.coords.longitude, pos.timestamp || Date.now(), pos.coords.altitude ?? null, seg]
  const prev = run.points.at(-1) as RunPoint | undefined
  set({ accuracy: pos.coords.accuracy, gpsError: null, lastFixAt: Date.now() })
  if (!acceptFix(prev, p, pos.coords.accuracy)) return
  const points = [...run.points, p]
  set({ run: { ...run, points } })
  // Mile callouts.
  const miles = Math.floor(totalDistance(points as RunPoint[]) / METERS_PER_MILE)
  if (miles > announcedMiles) {
    announcedMiles = miles
    const splits = mileSplits(points as RunPoint[])
    const last = splits.at(-1)
    haptic.celebrate()
    if (last) speak(`Mile ${miles}. ${paceWords(last)}.`)
  }
}

function onError(err: GeolocationPositionError) {
  set({
    gpsError:
      err.code === err.PERMISSION_DENIED
        ? 'Location is off for this app. Turn it on in iPhone Settings → Privacy → Location Services → Safari Websites.'
        : 'Looking for GPS… head outside for a clear view of the sky.',
  })
}

function startWatch() {
  if (watchId != null || !('geolocation' in navigator)) return
  watchId = navigator.geolocation.watchPosition(onFix, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
}

function stopWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
  watchId = null
}

/** Start GPS early so it can warm up before the run starts. */
export function warmUpGps() {
  if (!('geolocation' in navigator)) {
    set({ gpsError: "This device doesn't support GPS in the browser." })
    return
  }
  startWatch()
}

export function startRun(type: string) {
  const run: RunRecord = { id: uid(), status: 'active', source: 'gps', type, startedAt: new Date().toISOString(), points: [], pauses: [] }
  announcedMiles = 0
  set({ status: 'running', run })
  startWatch()
  persist()
  if (saveTimer) clearInterval(saveTimer)
  saveTimer = setInterval(persist, 5000)
  haptic.success()
  speak('Run started.')
}

export function pauseRun() {
  if (!live.run || live.status !== 'running') return
  set({ status: 'paused', run: { ...live.run, pauses: [...live.run.pauses, { start: Date.now() }] } })
  persist()
  haptic.light()
  speak('Paused.')
}

export function resumeRun() {
  if (!live.run || live.status !== 'paused') return
  const pauses = live.run.pauses.map((p, i, a) => (i === a.length - 1 && !p.end ? { ...p, end: Date.now() } : p))
  set({ status: 'running', run: { ...live.run, pauses } })
  persist()
  haptic.light()
  speak('Resumed.')
}

export function movingSeconds(run: RunRecord, now = Date.now()) {
  const start = Date.parse(run.startedAt)
  const end = run.endedAt ? Date.parse(run.endedAt) : now
  const paused = run.pauses.reduce((s, p) => s + ((p.end ?? end) - p.start), 0)
  return Math.max(0, Math.round((end - start - paused) / 1000))
}

/** Finish: compute stats, save the run + a cardio workout. Returns the workout (for the recap). */
export async function finishRun(profile: Profile): Promise<Workout | null> {
  const run = live.run
  if (!run) return null
  const endedAt = new Date().toISOString()
  const pauses = run.pauses.map((p) => (p.end ? p : { ...p, end: Date.parse(endedAt) }))
  const done: RunRecord = { ...run, endedAt, pauses, status: 'done' }
  const pts = done.points as RunPoint[]
  done.distanceM = totalDistance(pts)
  done.movingSec = movingSeconds(done)
  done.splits = mileSplits(pts)
  done.elevGainM = elevationGain(pts)
  stopWatch()
  if (saveTimer) clearInterval(saveTimer)
  saveTimer = null
  await allowScreenLock()
  const w = await saveRunAsWorkout(done, profile)
  set({ status: 'idle', run: null, accuracy: null, lastFixAt: null })
  speak(`Run complete. ${(done.distanceM / METERS_PER_MILE).toFixed(2)} miles.`)
  haptic.celebrate()
  return w
}

export async function discardRun() {
  const run = live.run
  stopWatch()
  if (saveTimer) clearInterval(saveTimer)
  saveTimer = null
  await allowScreenLock()
  if (run) await db.runs.delete(run.id)
  set({ status: 'idle', run: null, accuracy: null, lastFixAt: null })
}

/** Today's matching cardio session key, so a run counts for the planned session if there is one. */
function sessionKeyFor(profile: Profile) {
  const program = programs[profile.program]
  const today = program.week[new Date().getDay()]
  if (today.kind === 'run' || today.kind === 'sprint' || today.kind === 'optional') return today.key
  const anyRun = program.week.find((d) => d.kind === 'run' || d.kind === 'optional')
  return anyRun?.key ?? 'run'
}

export async function saveRunAsWorkout(run: RunRecord, profile: Profile): Promise<Workout> {
  const miles = (run.distanceM ?? 0) / METERS_PER_MILE
  const minutes = Math.max(1, Math.round((run.movingSec ?? 0) / 60))
  const date = run.startedAt.slice(0, 10) === todayISO() ? todayISO() : todayISO(new Date(run.startedAt))
  const w: Workout = {
    id: uid(),
    date,
    sessionKey: sessionKeyFor(profile),
    name: run.name || (miles >= 0.1 ? `${miles.toFixed(2)} mi ${run.type.toLowerCase()}` : run.type),
    kind: 'run',
    phase: phaseOf(profile),
    equipmentProfile: 'gps',
    startedAt: run.startedAt,
    finishedAt: run.endedAt ?? new Date().toISOString(),
    durationSec: run.movingSec,
    plan: [],
    cardio: { type: run.type, minutes, distanceMi: Math.round(miles * 100) / 100 },
  }
  await db.transaction('rw', db.workouts, db.runs, async () => {
    await db.workouts.add(w)
    await db.runs.put({ ...run, status: 'done', workoutId: w.id })
  })
  return w
}

/** Resume a run left active (e.g. the app reloaded mid-run): it comes back paused. */
export async function restoreActiveRun() {
  if (live.run) return
  const active = await db.runs.where('status').equals('active').first()
  if (!active) return
  const last = active.pauses.at(-1)
  const run = last && !last.end ? active : { ...active, pauses: [...active.pauses, { start: active.points.at(-1)?.[2] ?? Date.now() }] }
  announcedMiles = Math.floor(totalDistance(run.points as RunPoint[]) / METERS_PER_MILE)
  set({ status: 'paused', run })
  if (saveTimer) clearInterval(saveTimer)
  saveTimer = setInterval(persist, 5000)
}

export function useRunLive() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => live,
    () => live,
  )
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (s.status === 'idle') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [s.status])
  const pts = (s.run?.points ?? []) as RunPoint[]
  const distanceM = totalDistance(pts)
  const moving = s.run ? movingSeconds(s.run, now) : 0
  return {
    ...s,
    now,
    distanceM,
    miles: distanceM / METERS_PER_MILE,
    movingSec: moving,
    avgPace: distanceM > 30 ? (moving / distanceM) * METERS_PER_MILE : null,
    pace: s.status === 'running' ? currentPace(pts, now) : null,
    splits: mileSplits(pts),
    formatPace,
  }
}
