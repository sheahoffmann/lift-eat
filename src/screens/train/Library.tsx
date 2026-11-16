// Workout library: every workout you've done is saved here automatically (with your swaps
// and your own exercises), plus every session from the programs. Tap one to do it again.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanItem, type SetLog, type SharedWorkout, type Workout } from '../../lib/db'
import type { Profile } from '../../lib/profile'
import { todayISO } from '../../lib/profile'
import { exercises } from '../../data/exercises'
import { allSessions, programs, sessionFor } from '../../data/programs'
import { phaseOf, planFromSession, startWorkoutFrom, useActiveWorkout } from '../../lib/workoutStore'
import { weekStart } from '../../lib/game'
import { openWorkout } from '../../lib/ui'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export type LibraryEntry = {
  id: string
  name: string
  sessionKey: string
  plan: PlanItem[]
  timesDone: number
  lastDate: string
  firstDate: string
  lastWorkoutId: string
}

/** Group finished lifting workouts by their exercise lineup: same lineup = same library entry. */
export function buildLibrary(workouts: Workout[]): LibraryEntry[] {
  const map = new Map<string, LibraryEntry>()
  const sorted = workouts.filter((w) => w.finishedAt && !w.cardio && w.plan.length > 0).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt))
  for (const w of sorted) {
    const sig = w.plan.map((p) => p.ex).join('|')
    const e = map.get(sig)
    if (e) {
      e.timesDone++
      e.lastDate = w.date
      e.name = w.name
      e.plan = w.plan
      e.lastWorkoutId = w.id
      e.sessionKey = w.sessionKey
    } else {
      map.set(sig, { id: sig, name: w.name, sessionKey: w.sessionKey, plan: w.plan, timesDone: 1, lastDate: w.date, firstDate: w.date, lastWorkoutId: w.id })
    }
  }
  return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate))
}

const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const target = (p: PlanItem) =>
  `${p.sets} × ${p.seconds ? `${p.seconds}s` : p.yards ? `${p.yards} yd` : p.reps[0] === p.reps[1] ? p.reps[0] : `${p.reps[0]}–${p.reps[1]}`}${p.perSide ? '/side' : ''}`

type Selected = { kind: 'mine'; entry: LibraryEntry } | { kind: 'shared'; entry: LibraryEntry; addedBy: string } | { kind: 'program'; programId: string; day: number }

export function useLibrary() {
  const workouts = useLiveQuery(() => db.workouts.filter((w) => !!w.finishedAt && !w.cardio).toArray(), [], undefined)
  return useMemo(() => (workouts ? buildLibrary(workouts) : undefined), [workouts])
}

export function LibrarySheet({ profile, onStarted }: { profile: Profile; onStarted: () => void }) {
  const mine = useLibrary()
  const [tab, setTab] = useState<'mine' | 'shared' | 'programs'>('mine')
  const shared = useLiveQuery(() => db.sharedWorkouts.orderBy('addedBy').toArray(), [], [] as SharedWorkout[])
  const [selected, setSelected] = useState<Selected | null>(null)
  const phase = phaseOf(profile)
  const thisWeek = weekStart(todayISO())

  if (selected) return <LibraryDetail profile={profile} selected={selected} onBack={() => setSelected(null)} onStarted={onStarted} />

  return (
    <div className="stack gap-4">
      <div className="segmented" role="tablist" aria-label="Library">
        {(
          [
            ['mine', 'Yours'],
            ['shared', `Shared${shared.length ? ` · ${shared.length}` : ''}`],
            ['programs', 'Programs'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-checked={tab === k} onClick={() => setTab(k)}>
            {tab === k && <span className="segmented__pill" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'shared' ? (
        shared.length === 0 ? (
          <p className="sub">Workouts other people using the app finish show up here automatically. Yours are shared with them too. Sharing uses the passcode in Progress → ⚙ → Photo &amp; link reader.</p>
        ) : (
          <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
            {shared.map((w) => (
              <button
                key={w.id}
                className="g-row"
                onClick={() =>
                  setSelected({ kind: 'shared', addedBy: w.addedBy, entry: { id: w.id, name: w.name, sessionKey: w.sessionKey, plan: w.plan, timesDone: w.timesDone, lastDate: w.updatedAt, firstDate: w.updatedAt, lastWorkoutId: '' } })
                }
              >
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <span style={{ fontWeight: 650 }}>{w.name}</span>
                  <span className="caption num">
                    {w.plan.length} exercises · added by {w.addedBy} · done {w.timesDone}×
                  </span>
                </div>
                <Icon name="chevron" size={14} className="muted" />
              </button>
            ))}
          </section>
        )
      ) : tab === 'mine' ? (
        mine === undefined ? null : mine.length === 0 ? (
          <p className="sub">Every workout you finish is saved here automatically, including your swaps and your own exercises. Do one and it shows up.</p>
        ) : (
          <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
            {mine.map((e) => (
              <button key={e.id} className="g-row" onClick={() => setSelected({ kind: 'mine', entry: e })}>
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <span className="row" style={{ gap: 6, fontWeight: 650 }}>
                    {e.name}
                    {e.firstDate >= thisWeek && <span className="pill-sm pill-sm--accent">New</span>}
                  </span>
                  <span className="caption num">
                    {e.plan.length} exercises · done {e.timesDone}× · last {shortDate(e.lastDate)}
                  </span>
                </div>
                <Icon name="chevron" size={14} className="muted" />
              </button>
            ))}
          </section>
        )
      ) : (
        Object.values(programs).map((pr) => (
          <section key={pr.id} className="stack gap-2">
            <span className="eyebrow">
              {pr.name}
              {pr.id === profile.program ? ' · your program' : ''}
            </span>
            <div className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
              {allSessions(pr)
                .filter(({ session }) => session.kind === 'lift')
                .map(({ day }) => {
                  const s = sessionFor(pr, day, phase)
                  return (
                    <button key={s.key} className="g-row" onClick={() => setSelected({ kind: 'program', programId: pr.id, day })}>
                      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <span style={{ fontWeight: 650 }}>{s.name}</span>
                        <span className="caption">
                          {s.exercises.length} exercises · {s.focus}
                        </span>
                      </div>
                      <Icon name="chevron" size={14} className="muted" />
                    </button>
                  )
                })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function LibraryDetail({ profile, selected, onBack, onStarted }: { profile: Profile; selected: Selected; onBack: () => void; onStarted: () => void }) {
  const active = useActiveWorkout()
  const overrides = useLiveQuery(() => db.overrides.toArray(), [], undefined)
  const lastSets = useLiveQuery(
    () => (selected.kind === 'mine' ? db.sets.where('workoutId').equals(selected.entry.lastWorkoutId).toArray() : Promise.resolve([] as SetLog[])),
    [selected],
    [] as SetLog[],
  )
  const [busy, setBusy] = useState(false)

  let name: string
  let sessionKey: string
  let plan: PlanItem[] | null
  let sub: string
  if (selected.kind === 'mine' || selected.kind === 'shared') {
    name = selected.entry.name
    sessionKey = selected.entry.sessionKey
    plan = selected.entry.plan.filter((p) => !!exercises[p.ex])
    sub = selected.kind === 'shared' ? `Added by ${selected.addedBy} · done ${selected.entry.timesDone}×` : `Done ${selected.entry.timesDone}× · last ${shortDate(selected.entry.lastDate)}`
  } else {
    const pr = programs[selected.programId as keyof typeof programs]
    const s = sessionFor(pr, selected.day, phaseOf(profile))
    name = s.name
    sessionKey = s.key
    plan = overrides ? planFromSession(s, profile, overrides) : null
    sub = `${pr.name} · ${s.focus}`
  }

  const best = (exId: string) => {
    const sets = lastSets.filter((x) => x.exerciseId === exId)
    if (!sets.length) return null
    const top = sets.reduce((a, b) => (b.weight * 100 + b.reps > a.weight * 100 + a.reps ? b : a))
    return top.seconds ? `${top.seconds}s` : top.yards ? `${top.weight} × ${top.yards} yd` : top.weight ? `${top.weight} × ${top.reps}` : `${top.reps} reps`
  }

  return (
    <div className="stack gap-4">
      <button className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={onBack}>
        ‹ Library
      </button>
      <div className="stack gap-1">
        <h2 className="title2">{name}</h2>
        <span className="caption">{sub}</span>
      </div>
      {plan && (
        <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
          {plan.map((p, i) => {
            const b = best(p.ex)
            return (
              <div key={`${p.ex}-${i}`} className="g-row" style={{ minHeight: 48 }}>
                <span className="num caption" style={{ width: 18 }}>
                  {i + 1}
                </span>
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{exercises[p.ex]?.name ?? p.ex}</span>
                  {b && <span className="caption num">Last time: {b}</span>}
                </div>
                <span className="caption num">{target(p)}</span>
              </div>
            )
          })}
        </section>
      )}
      {active ? (
        <button className="btn btn--secondary btn--block" onClick={() => { onStarted(); openWorkout() }}>
          Finish your current workout first
        </button>
      ) : (
        <button
          className="btn btn--primary btn--block"
          disabled={!plan || busy}
          onClick={async () => {
            if (!plan) return
            setBusy(true)
            haptic.success()
            await startWorkoutFrom(profile, { sessionKey, name: name.replace(/: Refresh$/, ''), plan })
            onStarted()
            openWorkout()
          }}
        >
          <Icon name="play" size={18} /> Do this workout
        </button>
      )}
    </div>
  )
}
