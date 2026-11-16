// Swap an exercise: pick why, then one of 3–5 ranked alternatives, or type your own; just today or in the program.
import { useMemo, useState } from 'react'
import { exercises } from '../../data/exercises'
import { muscleNames, type MuscleSlug } from '../../anatomy/muscles'
import type { CustomExercise, PlanItem } from '../../lib/db'
import { saveCustomExercise, useCustomExercises } from '../../lib/customExercises'
import type { CustomPrescription } from '../../lib/workoutStore'
import { swapCandidates, swapReasons, type SwapReason } from '../../lib/swaps'
import type { Equipment } from '../../data/exerciseTypes'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export function SwapSheet({
  exerciseId,
  available,
  exclude,
  current,
  onSwap,
}: {
  exerciseId: string
  available: Equipment[]
  exclude: string[]
  current: PlanItem
  onSwap: (newEx: string, scope: 'today' | 'program', custom?: CustomPrescription) => void
}) {
  const [reason, setReason] = useState<SwapReason | null>(null)
  const [scope, setScope] = useState<'today' | 'program'>('today')
  const [own, setOwn] = useState<CustomExercise | 'new' | null>(null)
  const mine = useCustomExercises().filter((c) => !exclude.includes(c.id))
  const alts = useMemo(() => swapCandidates(exerciseId, available, reason, 5, exclude), [exerciseId, available, reason, exclude])
  const src = exercises[exerciseId]

  return (
    <div className="stack gap-4">
      <p className="sub">
        Replacing <strong style={{ color: 'var(--text)' }}>{src?.name}</strong>. Why?
      </p>
      <div className="tool-row" role="radiogroup" aria-label="Reason">
        {swapReasons.map((r) => (
          <button
            key={r.key}
            role="radio"
            aria-checked={reason === r.key}
            className={`chip ${reason === r.key ? 'chip--accent' : ''}`}
            onClick={() => {
              haptic.light()
              setReason(reason === r.key ? null : r.key)
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="segmented" role="radiogroup" aria-label="Swap scope">
        {(
          [
            ['today', 'Just today'],
            ['program', 'Replace in my program'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={scope === k} onClick={() => setScope(k)}>
            {scope === k && <span className="segmented__pill" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {own ? (
        <OwnExerciseForm
          key={own === 'new' ? 'new' : own.id}
          preset={own === 'new' ? undefined : own}
          current={current}
          defaultMuscles={src?.primary ?? []}
          onCancel={() => setOwn(null)}
          onSave={async (ex, custom) => {
            const saved = await saveCustomExercise(ex)
            haptic.success()
            onSwap(saved.id, scope, custom)
          }}
        />
      ) : (
      <>
      <div className="stack gap-2">
        {alts.length === 0 && <p className="sub">No alternatives with the equipment in this profile.</p>}
        {alts.map((a, i) => (
          <button
            key={a.id}
            className="option"
            onClick={() => {
              haptic.success()
              onSwap(a.id, scope)
            }}
          >
            <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 650 }}>{a.name}</span>
                {i === 0 && <span className="pill-sm pill-sm--accent">Closest</span>}
              </div>
              <span className="caption">
                {a.primary.map((m) => muscleNames[m]).join(', ')} · {a.equipment.join(', ')}
              </span>
            </div>
            <Icon name="swap" size={18} className="muted" />
          </button>
        ))}
      </div>

      <div className="stack gap-2">
        <span className="eyebrow">Doing something else?</span>
        {mine.length > 0 && (
          <div className="tool-row">
            {mine.map((c) => (
              <button key={c.id} className="chip" onClick={() => setOwn(c)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        <button className="btn btn--secondary btn--block" onClick={() => setOwn('new')}>
          <Icon name="pencil" size={15} /> Type in your own exercise
        </button>
      </div>
      </>
      )}
      <p className="caption">History and PRs are tracked per exercise, so swapping never changes the original lift's numbers.</p>
    </div>
  )
}

const logTypes: { key: CustomExercise['logType']; label: string }[] = [
  { key: 'weighted', label: 'Weight × reps' },
  { key: 'bodyweight', label: 'Reps only' },
  { key: 'timed', label: 'Time' },
  { key: 'distance', label: 'Distance' },
]

function OwnExerciseForm({
  preset,
  current,
  defaultMuscles,
  onCancel,
  onSave,
}: {
  preset?: CustomExercise
  current: PlanItem
  defaultMuscles: MuscleSlug[]
  onCancel: () => void
  onSave: (ex: Omit<CustomExercise, 'id' | 'createdAt'>, custom: CustomPrescription) => void
}) {
  const [name, setName] = useState(preset?.name ?? '')
  const [logType, setLogType] = useState<CustomExercise['logType']>(preset?.logType ?? 'weighted')
  const [sets, setSets] = useState(current.sets)
  const [repsLo, setRepsLo] = useState(String(current.reps[0]))
  const [repsHi, setRepsHi] = useState(current.reps[1] !== current.reps[0] ? String(current.reps[1]) : '')
  const [seconds, setSeconds] = useState(String(current.seconds ?? 30))
  const [yards, setYards] = useState(String(current.yards ?? 40))
  const [weight, setWeight] = useState('')
  const [muscles, setMuscles] = useState<MuscleSlug[]>((preset?.primary as MuscleSlug[]) ?? defaultMuscles)
  const [busy, setBusy] = useState(false)

  const lo = Math.max(1, Number(repsLo) || 0)
  const hi = Math.max(lo, Number(repsHi) || lo)
  const needsReps = logType === 'weighted' || logType === 'bodyweight'
  const valid = name.trim().length > 0 && (!needsReps || Number(repsLo) > 0)
  const num = (v: string) => v.replace(/[^0-9.]/g, '')

  return (
    <form
      className="stack gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || busy) return
        setBusy(true)
        onSave(
          { name, logType, primary: muscles },
          {
            sets,
            reps: needsReps ? [lo, hi] : [1, 1],
            seconds: logType === 'timed' ? Number(seconds) || 30 : undefined,
            yards: logType === 'distance' ? Number(yards) || 40 : undefined,
            startWeight: weight ? Number(weight) : undefined,
          },
        )
      }}
    >
      <label className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Exercise name
        </span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hack squat" autoFocus={!preset} />
      </label>

      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          How you log it
        </span>
        <div className="tool-row" role="radiogroup" aria-label="How you log it">
          {logTypes.map((t) => (
            <button type="button" key={t.key} role="radio" aria-checked={logType === t.key} className={`chip ${logType === t.key ? 'chip--accent' : ''}`} onClick={() => setLogType(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-row" style={{ padding: 'var(--s-2) var(--s-4)' }}>
        <span style={{ fontWeight: 600 }}>Sets</span>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <button type="button" className="icon-btn" aria-label="Fewer sets" onClick={() => setSets((n) => Math.max(1, n - 1))}>
            −
          </button>
          <span className="num title2" style={{ minWidth: 40, textAlign: 'center' }} aria-live="polite">
            {sets}
          </span>
          <button type="button" className="icon-btn" aria-label="More sets" onClick={() => setSets((n) => Math.min(12, n + 1))}>
            +
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'flex-end' }}>
        {needsReps && (
          <>
            <label className="stack gap-1" style={{ flex: 1 }}>
              <span className="caption" style={{ fontWeight: 600 }}>
                Reps
              </span>
              <input className="field num" inputMode="numeric" value={repsLo} onChange={(e) => setRepsLo(num(e.target.value))} placeholder="8" />
            </label>
            <label className="stack gap-1" style={{ flex: 1 }}>
              <span className="caption" style={{ fontWeight: 600 }}>
                Up to · optional
              </span>
              <input className="field num" inputMode="numeric" value={repsHi} onChange={(e) => setRepsHi(num(e.target.value))} placeholder="12" />
            </label>
          </>
        )}
        {logType === 'timed' && (
          <label className="stack gap-1" style={{ flex: 1 }}>
            <span className="caption" style={{ fontWeight: 600 }}>
              Seconds per set
            </span>
            <input className="field num" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(num(e.target.value))} />
          </label>
        )}
        {logType === 'distance' && (
          <label className="stack gap-1" style={{ flex: 1 }}>
            <span className="caption" style={{ fontWeight: 600 }}>
              Yards per set
            </span>
            <input className="field num" inputMode="numeric" value={yards} onChange={(e) => setYards(num(e.target.value))} />
          </label>
        )}
        {logType !== 'timed' && (
          <label className="stack gap-1" style={{ flex: 1 }}>
            <span className="caption" style={{ fontWeight: 600 }}>
              {logType === 'bodyweight' ? 'Added lb · optional' : 'Weight (lb)'}
            </span>
            <input className="field num" inputMode="decimal" value={weight} onChange={(e) => setWeight(num(e.target.value))} placeholder={logType === 'bodyweight' ? '0' : 'e.g. 90'} />
          </label>
        )}
      </div>

      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Muscles it works
        </span>
        <div className="tool-row" role="group" aria-label="Muscles it works">
          {(Object.keys(muscleNames) as MuscleSlug[]).map((m) => {
            const on = muscles.includes(m)
            return (
              <button type="button" key={m} aria-pressed={on} className={`chip ${on ? 'chip--accent' : ''}`} onClick={() => setMuscles(on ? muscles.filter((x) => x !== m) : [...muscles, m])}>
                {muscleNames[m]}
              </button>
            )
          })}
        </div>
        <span className="caption">Lights up your muscle map and balance, like the built-in exercises.</span>
      </div>

      <button className="btn btn--primary btn--block" type="submit" disabled={!valid || busy}>
        <Icon name="check" size={18} strokeWidth={2.6} /> Use this exercise
      </button>
      <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={onCancel}>
        Back to suggestions
      </button>
    </form>
  )
}
