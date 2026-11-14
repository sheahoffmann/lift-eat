import { useState } from 'react'
import { motion } from 'motion/react'
import type { Profile } from '../lib/profile'
import { settingsOf, todayISO, updateSettings, type EquipmentProfileKey } from '../lib/profile'
import { allSessions, dayNames, effortCue, plannedSets, programs, sessionFor, type SessionSummary } from '../data/programs'
import { AnatomyFigure } from '../anatomy/AnatomyFigure'
import { bestSide } from '../anatomy/muscles'
import { exercises } from '../data/exercises'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { haptic } from '../lib/haptics'
import { logCardio, phaseOf, startWorkout, useActiveWorkout, useWorkoutHistory, useWorkoutsOn } from '../lib/workoutStore'
import { openRun, openWorkout, showRecap } from "../lib/ui"
import { RunCard } from "./train/RunCard"
import { daysBetween } from '../lib/season'
import { weekStart } from '../lib/game'
import { ExerciseDetail } from './train/ExerciseDetail'
import { formatSeconds } from '../lib/training'

export function Train({ profile }: { profile: Profile }) {
  const program = programs[profile.program]
  const today = new Date().getDay()
  const phase = phaseOf(profile)
  const settings = settingsOf(profile)
  const [day, setDay] = useState(today)
  const session = sessionFor(program, day, phase)
  const active = useActiveWorkout()
  const doneToday = useWorkoutsOn(todayISO())
  const history = useWorkoutHistory(30)
  const [cardioOpen, setCardioOpen] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [pickOpen, setPickOpen] = useState(false)

  // Deload reminder every 7 weeks of training after Preseason.
  const weeksIn = Math.floor(daysBetween(profile.startDate) / 7)
  const thisWeek = weekStart(todayISO())
  const isDeload = (settings.deloadWeeks ?? []).includes(thisWeek)
  const lastDeload = (settings.deloadWeeks ?? []).at(-1)
  const weeksSinceDeload = lastDeload ? Math.floor(daysBetween(lastDeload) / 7) : weeksIn - 3
  const suggestDeload = phase !== 'refresh' && phase !== 'preseason' && weeksSinceDeload >= 6 && !isDeload

  const doneThis = doneToday.find((w) => w.sessionKey === session.key)

  async function start() {
    haptic.success()
    if (active) return openWorkout()
    if (session.kind !== 'lift') return setCardioOpen(true)
    await startWorkout(profile, day)
    openWorkout()
  }

  return (
    <main className="screen">
      <header className="card-row" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-1">
          <span className="eyebrow">{program.name}</span>
          <h1 className="large-title">Train</h1>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={() => setPickOpen(true)}>
          <Icon name="swap" size={15} /> Pick session
        </button>
      </header>

      {active && (
        <button className="card card--glow" onClick={openWorkout} style={{ textAlign: 'left', outline: '2px solid var(--accent)', outlineOffset: -2 }}>
          <div className="card-row">
            <div className="stack">
              <span className="caption accent" style={{ fontWeight: 700 }}>
                In progress
              </span>
              <span className="title3">{active.name}</span>
            </div>
            <span className="btn btn--primary btn--sm">Continue</span>
          </div>
        </button>
      )}

      {suggestDeload && (
        <section className="card stack gap-2">
          <span className="title3">Deload week?</span>
          <p className="sub">It's been about {weeksSinceDeload} weeks of hard training. A lighter week (half the sets) helps you come back stronger. It never breaks your streak.</p>
          <button
            className="btn btn--secondary btn--sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => updateSettings(profile, { deloadWeeks: [...(settings.deloadWeeks ?? []), thisWeek] })}
          >
            Make this a deload week
          </button>
        </section>
      )}

      <section className="card card--hero card--glow" aria-label="Session">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="stack gap-2" style={{ flex: 1, minWidth: 0 }}>
            <span className="chip chip--accent" style={{ alignSelf: 'flex-start' }}>
              {dayNames[day]}
              {day === today ? ' · Today' : ''}
              {isDeload ? ' · Deload' : ''}
            </span>
            <h2 className="title1">{session.name}</h2>
            <p className="sub">{session.focus}</p>
          </div>
          {session.kind !== 'rest' && <AnatomyFigure body={profile.body} side={bestSide(session.muscles)} muscles={session.muscles} height={150} />}
        </div>

        {session.kind === 'lift' && (
          <>
            <div className="stats" style={{ marginTop: 'var(--s-4)' }}>
              <div className="stat">
                <span className="stat__value num">{session.exercises.length}</span>
                <span className="stat__label">exercises</span>
              </div>
              <div className="stat">
                <span className="stat__value num">{plannedSets(session)}</span>
                <span className="stat__label">sets</span>
              </div>
              <div className="stat">
                <span className="stat__value num">
                  {session.minutes[0]}–{session.minutes[1]}
                  <span className="stat__unit">min</span>
                </span>
                <span className="stat__label">time</span>
              </div>
            </div>
            <p className="caption" style={{ marginTop: 'var(--s-3)' }}>
              {effortCue(phase)}
            </p>
            <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 'var(--s-3) 0 0' }}>
              {session.exercises.map((e, k) => (
                <li key={e.ex}>
                  <button className="g-row" onClick={() => setDetail(e.ex)} style={{ minHeight: 48 }}>
                    <span className="num caption" style={{ width: 18 }}>
                      {k + 1}
                    </span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{exercises[e.ex]?.name ?? e.ex}</span>
                    <span className="caption num">
                      {e.sets} × {e.seconds ? `${e.seconds}s` : e.yards ? `${e.yards}yd` : e.reps[0] === e.reps[1] ? e.reps[0] : `${e.reps[0]}–${e.reps[1]}`}
                      {e.perSide ? '/side' : ''}
                    </span>
                    <Icon name="chevron" size={14} className="muted" />
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}

        {session.kind !== 'rest' ? (
          doneThis && !active ? (
            <div className="stack" style={{ marginTop: 'var(--s-4)', gap: 4 }}>
              <button className="btn btn--secondary btn--block" onClick={() => showRecap(doneThis)}>
                <Icon name="check" size={18} strokeWidth={2.6} /> Done · watch recap
              </button>
              <button className="link-btn" style={{ alignSelf: 'center' }} onClick={start}>
                Start again
              </button>
            </div>
          ) : (
            <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-4)' }} onClick={start}>
              <Icon name="play" size={18} /> {active ? 'Continue workout' : session.kind === 'lift' ? 'Start workout' : 'Log it'}
            </button>
          )
        ) : (
          <p className="sub" style={{ marginTop: 'var(--s-3)' }}>
            Recovery day. Pick another session above if you want to train anyway.
          </p>
        )}
      </section>

      <RunCard profile={profile} suggestedType={session.kind === "sprint" ? "Sprints + agility" : session.kind === "lift" ? "Easy run" : "Partner run"} />

      <section className="card stack gap-2" aria-label="Equipment profile">
        <span className="eyebrow" id="eq">
          Where are you training?
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="eq">
          {(
            [
              ['gym', 'Full gym'],
              ['travel', 'Hotel'],
              ['home', 'Home'],
            ] as [EquipmentProfileKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={settings.equipmentProfile === k}
              onClick={() => {
                haptic.light()
                updateSettings(profile, { equipmentProfile: k })
              }}
            >
              {settings.equipmentProfile === k && <span className="segmented__pill" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className="caption">Exercises that need missing equipment are swapped automatically when you start.</span>
      </section>

      <h2 className="section-title title3">This week</h2>
      <ol className="stack gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((d, i) => {
          const s = sessionFor(program, d, phase)
          const isSel = d === day
          return (
            <motion.li key={d} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i }}>
              <button
                className="card"
                onClick={() => {
                  haptic.light()
                  setDay(d)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                style={{ width: '100%', textAlign: 'left', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-md)', outline: isSel ? '2px solid var(--accent)' : undefined, outlineOffset: -2 }}
                aria-current={d === today ? 'date' : undefined}
              >
                <div className="row">
                  <span className="num" style={{ width: 40, fontWeight: 700, fontSize: 'var(--fs-sub)', color: d === today ? 'var(--accent)' : 'var(--text-2)' }}>
                    {dayNames[d]}
                  </span>
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span className="caption">{s.kind === 'rest' ? 'Recover' : s.sets.length ? `${plannedSets(s)} sets · ${s.minutes[0]}–${s.minutes[1]} min` : `${s.minutes[0]}–${s.minutes[1]} min`}</span>
                  </div>
                  <Icon name={s.kind === 'rest' ? 'moon' : s.kind === 'lift' ? 'train' : s.kind === 'sprint' ? 'bolt' : 'run'} size={20} className={d === today ? 'accent' : 'muted'} />
                </div>
              </button>
            </motion.li>
          )
        })}
      </ol>

      <h2 className="section-title title3">History</h2>
      {history === undefined ? null : history.length === 0 ? (
        <p className="sub">Finished workouts show up here, each with a recap you can rewatch.</p>
      ) : (
        <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
          {history.map((w) => (
            <button key={w.id} className="g-row" onClick={() => showRecap(w)}>
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{w.name}</span>
                <span className="caption num">
                  {new Date(w.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                  {w.cardio ? `${w.cardio.minutes} min ${w.cardio.type.toLowerCase()}` : `${(w.volume ?? 0).toLocaleString()} lb · ${formatSeconds(w.durationSec ?? 0)}`}
                  {w.prs?.length ? ` · ${w.prs.length} PR` : ''}
                </span>
              </div>
              <Icon name="play" size={14} className="muted" />
            </button>
          ))}
        </section>
      )}

      <Sheet open={cardioOpen} onClose={() => setCardioOpen(false)} title={session.name}>
        <CardioLogger
          session={session}
          onTrack={() => {
            setCardioOpen(false)
            openRun(session.kind === "sprint" ? "Sprints + agility" : "Partner run")
          }}
          onLog={async (c) => {
            const w = await logCardio(profile, day, c)
            setCardioOpen(false)
            showRecap(w)
          }}
        />
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title="Exercise">
        {detail && <ExerciseDetail exerciseId={detail} body={profile.body} target={session.exercises.find((e) => e.ex === detail)} />}
      </Sheet>

      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Pick any session">
        <div className="stack gap-2">
          {allSessions(program).map(({ day: d }) => {
            const s = sessionFor(program, d, phase)
            return (
              <button
                key={d}
                className="option"
                aria-pressed={d === day}
                onClick={() => {
                  haptic.light()
                  setDay(d)
                  setPickOpen(false)
                }}
              >
                <div className="stack" style={{ flex: 1 }}>
                  <span style={{ fontWeight: 650 }}>{s.name}</span>
                  <span className="caption">
                    Usually {dayNames[d]} · {s.focus}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </Sheet>
    </main>
  )
}

function CardioLogger({ session, onLog, onTrack }: { session: SessionSummary; onTrack: () => void; onLog: (c: { type: string; minutes: number; distanceMi?: number; mobility?: boolean }) => void }) {
  const types = session.cardio?.types ?? ['Easy run', 'Walk', 'Bike']
  const [type, setType] = useState(types[0])
  const [minutes, setMinutes] = useState(Math.round((session.minutes[0] + session.minutes[1]) / 2))
  const [distance, setDistance] = useState('')
  const [mobility, setMobility] = useState(session.focus.toLowerCase().includes('mobility'))
  const [busy, setBusy] = useState(false)
  return (
    <div className="stack gap-4">
      <button className="btn btn--primary btn--block" onClick={onTrack}>
        <Icon name="run" size={18} /> Track it with GPS
      </button>
      <p className="caption" style={{ textAlign: "center" }}>Or log it by hand below (treadmill, bike, or a run you tracked elsewhere).</p>
      <p className="sub">{session.cardio?.note ?? session.focus}</p>
      <div className="tool-row" role="radiogroup" aria-label="Type">
        {types.map((t) => (
          <button key={t} role="radio" aria-checked={type === t} className={`chip ${type === t ? 'chip--accent' : ''}`} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="card card-row">
        <span style={{ fontWeight: 600 }}>Minutes</span>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <button className="icon-btn" aria-label="Less" onClick={() => setMinutes((m) => Math.max(5, m - 5))}>
            −
          </button>
          <span className="num title2" style={{ minWidth: 56, textAlign: 'center' }} aria-live="polite">
            {minutes}
          </span>
          <button className="icon-btn" aria-label="More" onClick={() => setMinutes((m) => Math.min(240, m + 5))}>
            +
          </button>
        </div>
      </div>
      <label className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Distance (miles) · optional
        </span>
        <input className="field num" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 2.5" />
      </label>
      <button className="g-row" role="switch" aria-checked={mobility} onClick={() => setMobility(!mobility)}>
        <span style={{ flex: 1, fontWeight: 500 }}>Did 10 min of mobility</span>
        <span className="toggle" aria-checked={mobility} aria-hidden />
      </button>
      <button
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onLog({ type, minutes, distanceMi: distance ? Number(distance) : undefined, mobility })
        }}
      >
        <Icon name="check" size={18} strokeWidth={2.6} /> Log {minutes} min
      </button>
    </div>
  )
}
