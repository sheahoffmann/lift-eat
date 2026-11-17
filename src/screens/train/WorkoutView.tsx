// Live workout logging (Hevy-style).
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { PR, SetLog, Workout } from '../../lib/db'
import { exercises } from '../../data/exercises'
import { effortCue, type Phase } from '../../data/programs'
import { settingsOf, todayISO, updateSettings, type EquipmentProfileKey, type Profile } from '../../lib/profile'
import { dayLabel } from '../../components/DayPicker'
import {
  applyEquipment,
  completeSet,
  discardWorkout,
  finishWorkout,
  saveNote,
  setCount,
  swapInWorkout,
  uncompleteSet,
  useLastSession,
  useWorkoutSets,
} from '../../lib/workoutStore'
import { beatLastTime, formatSeconds, weightAdvice } from '../../lib/training'
import { askNotificationPermission, skipRest, startRest } from '../../lib/restTimer'
import { celebrate } from '../../lib/celebrate'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { ExerciseDetail } from './ExerciseDetail'
import { SwapSheet } from './SwapSheet'
import { requestSync } from '../../lib/shared'
import { SoundtrackLibrary } from '../Soundtrack'

type Item = Workout['plan'][number]

export function prText(pr: PR) {
  const ex = exercises[pr.exerciseId]
  switch (pr.kind) {
    case 'weight':
      return { value: `${pr.value} lb${pr.reps ? ` × ${pr.reps}` : ''}`, previous: pr.previous != null ? `${pr.previous} lb` : undefined }
    case 'e1rm':
      return { value: `${pr.value} lb`, previous: pr.previous != null ? `${pr.previous} lb est. 1RM` : undefined, label: 'est. 1RM' }
    case 'reps':
      return { value: `${pr.reps} reps${pr.weight ? ` @ ${pr.weight}` : ''}`, previous: pr.previous != null ? `${pr.previous} reps` : undefined }
    case 'duration':
      return { value: `${pr.value}s`, previous: pr.previous != null ? `${pr.previous}s` : undefined }
    default:
      return { value: `${pr.value}`, previous: undefined, name: ex?.name }
  }
}

export function WorkoutView({
  workout,
  profile,
  onMinimize,
  onFinished,
}: {
  workout: Workout
  profile: Profile
  onMinimize: () => void
  onFinished: (w: Workout) => void
}) {
  const sets = useWorkoutSets(workout.id)
  const settings = settingsOf(profile)
  const [elapsed, setElapsed] = useState(0)
  const [detail, setDetail] = useState<number | null>(null)
  const [swap, setSwap] = useState<number | null>(null)
  const [note, setNote] = useState<number | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [listen, setListen] = useState(false)

  useEffect(() => {
    askNotificationPermission()
    const t = () => setElapsed(Math.round((Date.now() - Date.parse(workout.startedAt)) / 1000))
    t()
    const id = setInterval(t, 1000)
    return () => clearInterval(id)
  }, [workout.startedAt])

  const doneByIndex = useMemo(() => {
    const m = new Map<number, SetLog[]>()
    workout.plan.forEach((p, i) => m.set(i, sets.filter((s) => s.exerciseId === p.ex && s.slotEx === p.slotEx)))
    return m
  }, [sets, workout.plan])

  // Reopened from history, or logged on a past day: no live timer.
  const editing = workout.durationSec != null || workout.date !== todayISO()
  const totalSets = workout.plan.reduce((n, p) => n + p.sets, 0)
  const doneSets = sets.length

  async function finish() {
    setFinishing(true)
    skipRest()
    const w = await finishWorkout(workout)
    requestSync() // share the lineup with everyone using the app
    haptic.celebrate()
    onFinished(w)
  }

  async function switchProfile(key: EquipmentProfileKey) {
    haptic.light()
    updateSettings(profile, { equipmentProfile: key })
    const p2 = { ...profile, settings: { ...settingsOf(profile), equipmentProfile: key } }
    const done = new Set([...doneByIndex.entries()].filter(([, s]) => s.length).map(([i]) => i))
    await applyEquipment(workout, p2, done)
  }

  return (
    <div className="stack" style={{ minHeight: '100%' }}>
      <div className="totals-bar">
        <div className="card-row">
          <button className="icon-btn" onClick={onMinimize} aria-label="Minimize workout">
            <Icon name="chevron" size={18} className="rot90" />
          </button>
          <button className="icon-btn" onClick={() => setListen(true)} aria-label="Soundtrack">
            <Icon name="headphones" size={18} />
          </button>
          <div className="stack" style={{ alignItems: 'center', flex: 1 }}>
            <span style={{ fontWeight: 700 }}>{workout.name}</span>
            <span className="caption num">
              {editing ? `Editing ${dayLabel(workout.date)}` : formatSeconds(elapsed)} · {doneSets}/{totalSets} sets
            </span>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setConfirmEnd(true)} disabled={finishing}>
            Finish
          </button>
        </div>
        <div className="bar" style={{ marginTop: 'var(--s-3)' }}>
          <motion.div className="bar__fill" animate={{ scaleX: Math.max(0.01, doneSets / Math.max(1, totalSets)) }} />
        </div>
      </div>

      <div className="stack gap-4" style={{ padding: `var(--s-2) var(--gutter) calc(env(safe-area-inset-bottom) + 120px)` }}>
        <div className="card stack gap-3" style={{ padding: 'var(--s-4)' }}>
          <p className="sub" style={{ color: 'var(--text)' }}>
            <Icon name="sparkle" size={14} className="accent" /> {effortCue(workout.phase as Phase)}
          </p>
          <div className="segmented" role="radiogroup" aria-label="Equipment">
            {(
              [
                ['gym', 'Full gym'],
                ['travel', 'Hotel'],
                ['home', 'Home'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} role="radio" aria-checked={settings.equipmentProfile === k} onClick={() => switchProfile(k)}>
                {settings.equipmentProfile === k && <span className="segmented__pill" />}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {workout.plan.map((item, i) => (
          <ExerciseCard
            key={`${i}-${item.ex}`}
            workout={workout}
            item={item}
            index={i}
            done={doneByIndex.get(i) ?? []}
            profile={profile}
            nextLabel={(s) => {
              const isLastSet = s + 1 >= item.sets
              const next = isLastSet ? workout.plan[i + 1] : item
              return next ? `${exercises[next.ex]?.name ?? next.ex}${isLastSet ? '' : ` · set ${s + 2}`}` : null
            }}
            onDetail={() => setDetail(i)}
            onSwap={() => setSwap(i)}
            onNote={() => setNote(i)}
          />
        ))}

        <button className="btn btn--primary btn--block" onClick={() => setConfirmEnd(true)} disabled={finishing}>
          <Icon name="check" size={18} strokeWidth={2.6} /> Finish workout
        </button>
        <button
          className="link-btn"
          style={{ alignSelf: 'center', color: 'var(--text-3)' }}
          onClick={async () => {
            if (confirm('Discard this workout? Logged sets will be deleted.')) {
              skipRest()
              await discardWorkout(workout)
              onMinimize()
            }
          }}
        >
          Discard workout
        </button>
      </div>

      <Sheet open={detail !== null} onClose={() => setDetail(null)} title="Exercise">
        {detail !== null && <ExerciseDetail exerciseId={workout.plan[detail].ex} body={profile.body} target={workout.plan[detail]} />}
      </Sheet>

      <Sheet open={swap !== null} onClose={() => setSwap(null)} title="Swap exercise">
        {swap !== null && (
          <SwapSheet
            exerciseId={workout.plan[swap].ex}
            available={settings.equipment[settings.equipmentProfile]}
            exclude={workout.plan.map((p) => p.ex)}
            current={workout.plan[swap]}
            body={profile.body}
            passcode={settings.aiPasscode}
            onSwap={async (ex, scope, custom) => {
              await swapInWorkout(workout, swap, ex, scope, custom)
              setSwap(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={note !== null} onClose={() => setNote(null)} title="Note">
        {note !== null && (
          <NoteEditor
            initial={workout.notes?.[workout.plan[note].ex] ?? ''}
            onSave={async (text) => {
              await saveNote(workout, workout.plan[note].ex, text)
              setNote(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={listen} onClose={() => setListen(false)} title="Soundtrack">
        <SoundtrackLibrary kind={workout.kind === 'sprint' ? 'sprint' : workout.kind === 'lift' ? 'lift' : 'run'} />
      </Sheet>

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Finish workout?">
        <div className="stack gap-3">
          <p className="sub">
            {doneSets} of {totalSets} sets logged{editing ? ` for ${dayLabel(workout.date)}` : ` in ${formatSeconds(elapsed)}`}.
            {doneSets < totalSets && ' Unfinished sets are fine. Showing up counts.'}
          </p>
          <button className="btn btn--primary btn--block" onClick={finish} disabled={finishing || doneSets === 0}>
            {editing ? 'Save and see recap' : 'Finish and see recap'}
          </button>
          {doneSets === 0 && <p className="caption">Log at least one set first, or discard the workout.</p>}
          <button className="btn btn--secondary btn--block" onClick={() => setConfirmEnd(false)}>
            Keep going
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial)
  return (
    <div className="stack gap-3">
      <textarea className="field" style={{ minHeight: 120, padding: 'var(--s-3) var(--s-4)', resize: 'vertical' }} value={t} onChange={(e) => setT(e.target.value)} placeholder="Seat height, grip, how it felt…" />
      <button className="btn btn--primary btn--block" onClick={() => onSave(t)}>
        Save note
      </button>
    </div>
  )
}

function ExerciseCard({
  workout,
  item,
  index,
  done,
  profile,
  nextLabel,
  onDetail,
  onSwap,
  onNote,
}: {
  workout: Workout
  item: Item
  index: number
  done: SetLog[]
  profile: Profile
  nextLabel: (setIndex: number) => string | null
  onDetail: () => void
  onSwap: () => void
  onNote: () => void
}) {
  const ex = exercises[item.ex]
  const last = useLastSession(item.ex, workout.id)
  const settings = settingsOf(profile)
  const [inputs, setInputs] = useState<Record<number, { w: string; r: string }>>({})
  if (!ex) return null

  const timed = ex.logType === 'timed'
  const distance = ex.logType === 'distance'
  const bw = ex.logType === 'bodyweight'
  const lastBest = last.length ? last.reduce((a, b) => (b.weight * 100 + b.reps > a.weight * 100 + a.reps ? b : a)) : undefined
  const cue = beatLastTime(ex, lastBest ? { weight: lastBest.weight, reps: lastBest.reps } : undefined, item.reps, settings)
  const advice = cue && cue.weight > 0 ? weightAdvice(ex.loadType, cue.weight, cue.reps, settings) : null
  const allDone = done.length >= item.sets
  const target = timed ? `${item.seconds ?? 30}s hold` : distance ? `${item.yards ?? 40} yd` : item.reps[0] === item.reps[1] ? `${item.reps[0]}` : `${item.reps[0]}–${item.reps[1]}`
  const swapped = item.ex !== item.slotEx

  async function check(s: number) {
    const existing = done.find((d) => d.setIndex === s)
    if (existing) {
      haptic.light()
      await uncompleteSet(existing.id)
      return
    }
    const prev = last.find((l) => l.setIndex === s) ?? last.at(-1)
    const typed = inputs[s] ?? { w: '', r: '' }
    const sugg = s === 0 && cue ? cue : undefined
    const weight = typed.w !== '' ? Number(typed.w) : (sugg?.weight ?? prev?.weight ?? done.at(-1)?.weight ?? item.startWeight ?? 0)
    const repsOrTime = typed.r !== '' ? Number(typed.r) : timed ? (prev?.seconds ?? item.seconds ?? 30) : distance ? (prev?.yards ?? item.yards ?? 40) : (sugg?.reps ?? prev?.reps ?? done.at(-1)?.reps ?? item.reps[1])
    if (!timed && !distance && repsOrTime <= 0) return
    if ((ex.logType === 'weighted' || distance) && weight <= 0 && !ex.id.startsWith('assisted')) {
      // Need a weight for loaded lifts on the very first time.
      if (!prev && typed.w === '' && !done.length && !item.startWeight) {
        document.getElementById(`w-${index}-${s}`)?.focus()
        return
      }
    }
    const pr = await completeSet(workout, index, s, {
      weight,
      reps: timed || distance ? 1 : repsOrTime,
      seconds: timed ? repsOrTime : undefined,
      yards: distance ? repsOrTime : undefined,
    })
    haptic.success()
    if (pr) {
      const t = prText(pr)
      celebrate({ kind: 'pr', title: ex.name, value: t.value, previous: t.previous, attribute: ex.pattern === 'power' ? 'Power ↑' : 'Strength ↑' })
    }
    const label = nextLabel(s)
    const isFinal = index === workout.plan.length - 1 && s + 1 >= item.sets
    if (label && !isFinal) startRest(item.rest, label)
  }

  const placeholderW = (s: number) => {
    const prev = last.find((l) => l.setIndex === s) ?? last.at(-1)
    if (s === 0 && cue && cue.weight > 0) return String(cue.weight)
    return prev ? String(prev.weight) : done.at(-1) ? String(done.at(-1)!.weight) : item.startWeight ? String(item.startWeight) : bw ? '0' : '–'
  }
  const placeholderR = (s: number) => {
    const prev = last.find((l) => l.setIndex === s) ?? last.at(-1)
    if (timed) return String(prev?.seconds ?? item.seconds ?? 30)
    if (distance) return String(prev?.yards ?? item.yards ?? 40)
    if (s === 0 && cue) return String(cue.reps)
    return String(prev?.reps ?? item.reps[1])
  }

  return (
    <motion.section layout className="card" style={{ padding: 'var(--s-4)', outline: allDone ? '2px solid var(--accent-soft)' : undefined, outlineOffset: -2 }} aria-label={ex.name}>
      <div className="card-row" style={{ alignItems: 'flex-start' }}>
        <button className="stack" style={{ textAlign: 'left', gap: 2, minWidth: 0, flex: 1 }} onClick={onDetail}>
          <span className="ex-card__title">
            {ex.name} {allDone && <Icon name="check" size={16} strokeWidth={3} className="accent" />}
          </span>
          <span className="caption num">
            {item.sets} × {target}
            {item.perSide ? ' / side' : ''} · rest {formatSeconds(item.rest)}
            {swapped && ` · swapped from ${exercises[item.slotEx]?.name ?? item.slotEx}`}
          </span>
        </button>
        {item.role === 'power' && <span className="pill-sm pill-sm--accent">Power</span>}
      </div>

      {(lastBest || cue) && (
        <div className="row" style={{ gap: 6, marginTop: 'var(--s-2)', flexWrap: 'wrap' }}>
          {lastBest && (
            <span className="pill-sm">
              Last: {timed ? `${lastBest.seconds}s` : distance ? `${lastBest.weight} × ${lastBest.yards} yd` : lastBest.weight ? `${lastBest.weight} × ${lastBest.reps}` : `${lastBest.reps} reps`}
            </span>
          )}
          {cue && (
            <span className="pill-sm pill-sm--accent">
              <Icon name="bolt" size={11} /> Beat it: {cue.text}
            </span>
          )}
        </div>
      )}
      {advice && <p className="caption" style={{ marginTop: 6 }}>Don't have {cue!.weight}? {advice.map((a) => a.text).join('. ')}.</p>}

      <div className="stack" style={{ marginTop: 'var(--s-3)', gap: 6 }}>
        <div className="set-grid set-grid--head">
          <span>Set</span>
          <span>Previous</span>
          <span style={{ textAlign: 'center' }}>{timed ? '' : distance ? 'lb' : bw ? '+lb' : 'lb'}</span>
          <span style={{ textAlign: 'center' }}>{timed ? 'sec' : distance ? 'yd' : 'reps'}</span>
          <span />
        </div>
        {Array.from({ length: item.sets }, (_, s) => {
          const d = done.find((x) => x.setIndex === s)
          const prev = last.find((l) => l.setIndex === s)
          const typed = inputs[s] ?? { w: '', r: '' }
          return (
            <div key={s} className={`set-grid set-row ${d ? 'set-row--done' : ''}`}>
              <span className="num" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-2)' }}>
                {s + 1}
              </span>
              <span className="caption num" style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {prev ? (timed ? `${prev.seconds}s` : distance ? `${prev.weight}×${prev.yards}` : prev.weight ? `${prev.weight}×${prev.reps}` : `${prev.reps}`) : '—'}
              </span>
              {timed ? (
                <span />
              ) : (
                <input
                  id={`w-${index}-${s}`}
                  className="set-input"
                  inputMode="decimal"
                  aria-label={`Set ${s + 1} weight`}
                  placeholder={placeholderW(s)}
                  value={d ? String(d.weight) : typed.w}
                  disabled={!!d}
                  onChange={(e) => setInputs({ ...inputs, [s]: { ...typed, w: e.target.value.replace(/[^0-9.]/g, '') } })}
                />
              )}
              <input
                className="set-input"
                inputMode="numeric"
                aria-label={`Set ${s + 1} ${timed ? 'seconds' : distance ? 'yards' : 'reps'}`}
                placeholder={placeholderR(s)}
                value={d ? String(timed ? d.seconds : distance ? d.yards : d.reps) : typed.r}
                disabled={!!d}
                onChange={(e) => setInputs({ ...inputs, [s]: { ...typed, r: e.target.value.replace(/[^0-9]/g, '') } })}
              />
              <button className="set-check" onClick={() => check(s)} aria-label={d ? `Undo set ${s + 1}` : `Complete set ${s + 1}`} aria-pressed={!!d}>
                <Icon name="check" size={20} strokeWidth={3} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="tool-row" style={{ marginTop: 'var(--s-3)' }}>
        <button className="chip" onClick={() => setCount(workout, index, 1)}>
          <Icon name="plus" size={14} /> Set
        </button>
        {item.sets > done.length && item.sets > 1 && (
          <button className="chip" onClick={() => setCount(workout, index, -1)}>
            − Set
          </button>
        )}
        <button className="chip" onClick={onSwap}>
          <Icon name="swap" size={14} /> Swap
        </button>
        <button className="chip" onClick={onDetail}>
          <Icon name="play" size={12} /> Form + video
        </button>
        <button className="chip" onClick={onNote}>
          <Icon name="pencil" size={13} /> {workout.notes?.[item.ex] ? 'Note ✓' : 'Note'}
        </button>
      </div>
    </motion.section>
  )
}
