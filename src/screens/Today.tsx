import { useState } from 'react'
import { motion } from 'motion/react'
import type { Profile } from '../lib/profile'
import { saveProfile, todayISO } from '../lib/profile'
import { programs, plannedSets, sessionFor } from '../data/programs'
import { currentSeason, daysUntil, greeting } from '../lib/season'
import { AnatomyFigure } from '../anatomy/AnatomyFigure'
import { bestSide } from '../anatomy/muscles'
import { PlayerCard, type PlayerStats } from '../components/PlayerCard'
import { RingLegend, Rings, type RingValues } from '../components/Rings'
import { Icon } from '../components/Icon'
import { haptic } from '../lib/haptics'
import { logWeighIn, useWeighIns } from '../lib/weighins'
import type { TabKey } from '../components/TabBar'
import { Sheet } from '../components/Sheet'
import { Planner } from './eat/Planner'
import { addDays, logPlanned, nextMeal, plannedMealsFor, totals, useDayLog, useLatestPlan, usePlanFor } from '../lib/eatStore'
import { calorieRange } from '../lib/nutrition'
import { mealsById, slotMeta } from '../data/meals'
import { macroTargets, settingsOf } from '../lib/profile'
import { MacroGoals } from '../components/MacroGoals'
import { SoundtrackLibrary, SoundtrackPick } from "./Soundtrack"
import { PetCard } from "./Pet"
import { MealBuild } from "../components/MealBuild"
import { Collapsible } from "../components/Collapsible"
import { useGame } from '../lib/game'
import { phaseOf, startWorkout, useActiveWorkout, useWorkoutsOn } from '../lib/workoutStore'
import { openRun, openWorkout, showRecap, showWeekly } from '../lib/ui'
import { daysBetween } from '../lib/season'
import { celebrate } from '../lib/celebrate'
import { useEffect, useRef } from 'react'

const enter = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 140, damping: 20, delay: 0.04 * i },
})

export function Today({ profile, go }: { profile: Profile; go: (t: TabKey) => void }) {
  const program = programs[profile.program]
  const now = new Date()
  const season = currentSeason(profile.startDate, now)
  const phase = phaseOf(profile)
  const session = sessionFor(program, now.getDay(), phase)
  const weighIns = useWeighIns()
  const todayWeigh = weighIns.find((w) => w.date === todayISO() && w.lb > 0)
  const game = useGame(profile)
  const active = useActiveWorkout()
  const doneToday = useWorkoutsOn(todayISO())
  const trained = doneToday.length > 0
  const doneSession = doneToday.find((w) => w.sessionKey === session.key)
  const settings = settingsOf(profile)
  const seasonName = settings.buildStartedAt ? 'Season 2: Build' : season.name

  const stats: PlayerStats = {
    name: profile.name,
    ovr: game?.attributes.ovr ?? 40,
    tier: game?.tier ?? 'bronze',
    level: game?.level.level ?? 1,
    levelTitle: game?.level.title ?? 'Walk-on',
    xp: game?.level.into ?? 0,
    xpToNext: game?.level.need ?? 500,
    attributes: game?.attributes ?? { strength: 40, power: 40, engine: 40, discipline: 40 },
  }

  // "Back at it": no workout in the last 4 days (not counting planned rest).
  const lastWorkout = game?.data.workouts.filter((w) => w.finishedAt).sort((a, b) => b.date.localeCompare(a.date))[0]
  const backAtIt = !!lastWorkout && daysBetween(lastWorkout.date) >= 4 && !trained
  const isMonday = now.getDay() === 1

  async function startToday() {
    haptic.success()
    if (active) return openWorkout()
    if (session.kind === 'lift') {
      await startWorkout(profile, now.getDay())
      openWorkout()
    } else openRun(session.kind === 'sprint' ? 'Sprints + agility' : 'Partner run')
  }

  // Eat data
  const date = todayISO()
  const plan = usePlanFor(date)
  const latestPlan = useLatestPlan()
  const log = useDayLog(date) ?? []
  const meals = plan ? plannedMealsFor(plan, date, log) : []
  const upNext = nextMeal(meals)
  const eaten = totals(log)
  const [lo, hi] = calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })
  const fuelClosed = eaten.protein >= profile.proteinTarget - 5 && eaten.cal >= lo && eaten.cal <= hi
  const mealsLogged = meals.filter((m) => m.entry).length
  const [planning, setPlanning] = useState(false)
  const [listenOpen, setListenOpen] = useState(false)
  const [showRecipe, setShowRecipe] = useState(false)

  const rings: RingValues = {
    train: trained || session.kind === 'rest' || session.kind === 'optional' ? 1 : active ? 0.5 : 0,
    // Fuel closes only when protein is hit AND calories are in range (never rewards undereating).
    fuel: fuelClosed ? 1 : Math.min(0.97, eaten.protein / profile.proteinTarget),
    log: (mealsLogged + (todayWeigh ? 1 : 0)) / ((plan ? meals.length : 4) + 1),
  }

  async function logUpNext() {
    if (!upNext) return
    await logPlanned(date, upNext)
    const p = eaten.protein + upNext.macros.protein
    const c = eaten.cal + upNext.macros.cal
    if (!fuelClosed && p >= profile.proteinTarget - 5 && c >= lo && c <= hi) haptic.celebrate()
    else haptic.success()
  }

  // Celebrate the moment all three rings close (once per day).
  const allClosed = rings.train >= 1 && rings.fuel >= 1 && rings.log >= 1
  const wasClosed = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasClosed.current === false && allClosed) {
      const key = `lift-eat:rings:${date}`
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          celebrate({ kind: 'rings', title: 'Train. Fuel. Log. Done.' })
        }
      } catch {
        celebrate({ kind: 'rings', title: 'Train. Fuel. Log. Done.' })
      }
    }
    wasClosed.current = allClosed
  }, [allClosed, date])

  return (
    <main className="screen">
      <motion.header {...enter(0)} className="card-row" style={{ alignItems: 'flex-start' }}>
        <div className="stack gap-1">
          <span className="eyebrow">
            {greeting(now)}, {profile.name}
          </span>
          <h1 className="large-title">Today</h1>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6, marginTop: 6 }}>
          <span className="chip chip--accent">
            {seasonName} · Wk {season.week}
          </span>
          {game && game.streak.streak > 0 && (
            <span className="chip">
              <Icon name="flame" size={13} className="accent" /> {game.streak.streak}-wk streak
            </span>
          )}
        </div>
      </motion.header>

      {backAtIt && (
        <motion.section {...enter(1)} className="card card-row" style={{ padding: 'var(--s-4)' }}>
          <div className="stack">
            <span className="title3">Back at it</span>
            <span className="caption">One session today restarts the momentum.</span>
          </div>
          <Icon name="bolt" size={22} className="accent" />
        </motion.section>
      )}

      {isMonday && (
        <motion.button {...enter(1)} className="card card--glow card-row" onClick={() => showWeekly(true)} style={{ textAlign: 'left', padding: 'var(--s-4)' }}>
          <div className="stack">
            <span className="caption accent" style={{ fontWeight: 700 }}>
              New
            </span>
            <span className="title3">Your week in review</span>
          </div>
          <Icon name="play" size={18} className="accent" />
        </motion.button>
      )}

      <motion.div {...enter(1)}>
        <PlayerCard stats={stats} />
      </motion.div>

      <motion.div {...enter(1)}>
        <PetCard profile={profile} />
      </motion.div>

      <motion.section {...enter(2)} className="card" aria-label="Daily rings">
        <div className="row" style={{ gap: 'var(--s-5)' }}>
          <Rings values={rings} />
          <RingLegend
            values={rings}
            detail={{
              train: trained
                ? `${doneToday[0].name.replace(': Refresh', '')} done`
                : session.kind === 'rest'
                  ? 'Rest day counts'
                  : session.kind === 'optional'
                    ? 'Optional day, already counts'
                    : active
                      ? 'In progress'
                      : `${session.short} not done yet`,
              fuel: fuelClosed
                ? `${Math.round(eaten.protein)} g protein, in range`
                : `${Math.round(eaten.protein)} / ${profile.proteinTarget} g protein`,
              log: plan
                ? `${mealsLogged}/${meals.length} meals${todayWeigh ? ' + weigh-in' : ', weigh-in'}`
                : todayWeigh
                  ? 'Weigh-in logged'
                  : 'Meals + weigh-in',
            }}
          />
        </div>
      </motion.section>

      <motion.div {...enter(2)}>
        <Collapsible
          id="goals"
          label="Today's goals"
          title="Today's goals"
          summary={`${Math.round(eaten.cal).toLocaleString()} / ${profile.calorieTarget.toLocaleString()} cal · ${Math.round(eaten.protein)} / ${profile.proteinTarget} g protein`}
        >
          <MacroGoals eaten={eaten} targets={macroTargets(profile)} calorieRange={[lo, hi]} bare />
        </Collapsible>
      </motion.div>

      {plan === undefined ? null : plan && upNext ? (
        <motion.div {...enter(3)}>
        <Collapsible
          id="upnext"
          label="Up next meal"
          hero
          glow
          title={
            <span className="accent">
              Up next · {upNext.slot === 'extra' ? 'Extra' : slotMeta[upNext.slot].label} · {upNext.time}
            </span>
          }
          summary={`${upNext.name} · ${upNext.macros.protein} g protein`}
          action={
            <button className="btn btn--primary btn--sm" onClick={logUpNext}>
              Log it
            </button>
          }
        >
          <div className="stack gap-3">
            <h2 id="next-meal" className="title1">
              {upNext.name}
            </h2>
            <p className="sub">{mealsById[upNext.mealId]?.desc}</p>
            <div className="stats" style={{ marginTop: 'var(--s-1)' }}>
              <Stat label="Protein" value={String(upNext.macros.protein)} unit="g" />
              <Stat label="Calories" value={String(upNext.macros.cal)} />
              <Stat label="Protein left"value={String(Math.max(0, Math.round(profile.proteinTarget - eaten.protein)))} unit="g" />
            </div>
            <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-2)' }} onClick={logUpNext}>
              <Icon name="check" size={18} strokeWidth={2.6} /> Log it
            </button>
            <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-4)' }}>
              <button className="link-btn" onClick={() => setShowRecipe((s) => !s)} aria-expanded={showRecipe}>
                {showRecipe ? 'Hide recipe' : 'How to make it'}
              </button>
              <button className="link-btn" style={{ color: 'var(--text-2)' }} onClick={() => go('eat')}>
                Ate something else
              </button>
            </div>
            {showRecipe && mealsById[upNext.mealId] && plan && (
              <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', background: 'var(--surface-strong)', boxShadow: 'none' }}>
                <MealBuild meal={mealsById[upNext.mealId]} portion={plan.portion} />
              </div>
            )}
          </div>
        </Collapsible>
        </motion.div>
      ) : plan ? (
        <motion.div {...enter(3)}>
          <Collapsible id="upnext" label="Meals" title="Meals" done summary={`✓ All meals logged · ${Math.round(eaten.protein)} g protein`}>
            <div className="row">
              <span className="icon-btn" style={{ background: 'var(--accent-fill)', color: '#fff' }} aria-hidden>
                <Icon name="check" size={20} strokeWidth={3} />
              </span>
              <div className="stack">
                <span className="title3">All meals logged</span>
                <span className="caption num">
                  {Math.round(eaten.protein)} g protein · {Math.round(eaten.cal).toLocaleString()} cal today
                </span>
              </div>
            </div>
          </Collapsible>
        </motion.div>
      ) : (
      <motion.section {...enter(3)} className="card card--hero card--glow" aria-labelledby="plan-title">
        <div className="stack gap-3">
          <span className="chip" style={{ alignSelf: 'flex-start' }}>
            <Icon name="cart" size={14} /> Eat
          </span>
          <h2 id="plan-title" className="title1">
            Plan your week
          </h2>
          <p className="sub">
            Pick your meals once, get a grocery list, and every meal after that is one tap to log.
          </p>
          <div className="stats" style={{ marginTop: 'var(--s-2)' }}>
            <Stat label="Calories" value={profile.calorieTarget.toLocaleString()} />
            <Stat label="Protein" value={String(profile.proteinTarget)} unit="g" />
            <Stat label="Takes" value="3" unit="min" />
          </div>
          <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-2)' }} onClick={() => setPlanning(true)}>
            Plan my week
          </button>
        </div>
      </motion.section>
      )}

      {plan && now.getDay() === settings.shoppingDay && plan.endDate <= addDays(date, 1) && (
        <motion.button {...enter(3)} className="card card-row" onClick={() => setPlanning(true)} style={{ textAlign: 'left', padding: 'var(--s-4)' }}>
          <div className="stack">
            <span className="caption accent" style={{ fontWeight: 700 }}>
              Shopping day
            </span>
            <span className="title3">Plan next week</span>
          </div>
          <Icon name="cart" size={20} className="accent" />
        </motion.button>
      )}

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Plan your week" full bare>
        <Planner profile={profile} previous={latestPlan ?? null} onClose={() => setPlanning(false)} />
      </Sheet>

      <motion.div {...enter(4)}>
      <Collapsible
        id="session"
        label="Today's session"
        hero
        done={!!doneSession || session.kind === 'rest'}
        title={`Today's ${session.kind === 'lift' ? 'workout' : 'session'}`}
        summary={
          doneSession
            ? `✓ ${session.name.replace(': Refresh', '')} done`
            : session.kind === 'rest'
              ? 'Rest day · recovery counts'
              : `${session.name} · ${session.minutes[0]}–${session.minutes[1]} min`
        }
        action={
          doneSession ? (
            <button className="btn btn--secondary btn--sm" onClick={() => showRecap(doneSession)}>
              Recap
            </button>
          ) : session.kind !== 'rest' ? (
            <button className="btn btn--primary btn--sm" onClick={startToday}>
              {active ? 'Continue' : 'Start'}
            </button>
          ) : undefined
        }
      >
        <div className="row" style={{ alignItems: 'stretch', gap: 'var(--s-3)' }}>
          <div className="stack gap-2" style={{ flex: 1, minWidth: 0 }}>
            <h2 id="workout-title" className="title1">
              {session.name}
            </h2>
            <p className="sub">{session.focus}</p>
          </div>
          {session.kind !== 'rest' && (
            <div style={{ flex: 'none', marginRight: -8 }}>
              <AnatomyFigure body={profile.body} side={bestSide(session.muscles)} muscles={session.muscles} height={150} />
            </div>
          )}
        </div>
        {session.kind !== 'rest' ? (
          <>
            <div className="stats" style={{ marginTop: 'var(--s-4)' }}>
              {session.sets.length > 0 ? (
                <>
                  <Stat icon="layers" label="Sets" value={String(plannedSets(session, phase))} />
                  <Stat icon="train" label="Exercises" value={String(session.sets.length)} />
                </>
              ) : (
                <Stat icon="run" label="Type" value={session.kind === 'sprint' ? 'Speed' : 'Easy'} />
              )}
              <Stat icon="clock" label="Time" value={`${session.minutes[0]}–${session.minutes[1]}`} unit="min" />
            </div>
            {phase === 'refresh' && session.sets.length > 0 && (
              <p className="caption" style={{ marginTop: 'var(--s-3)' }}>
                Refresh week: easy weights, finish feeling like you could do a lot more. Showing up is the win.
              </p>
            )}
            {phase === 'preseason' && session.sets.length > 0 && (
              <p className="caption" style={{ marginTop: 'var(--s-3)' }}>
                Preseason: about half the sets, stop 3–4 reps short of failure.
              </p>
            )}
            {doneSession ? (
              <button className="btn btn--secondary btn--block" style={{ marginTop: 'var(--s-4)' }} onClick={() => showRecap(doneSession!)}>
                <Icon name="check" size={18} strokeWidth={2.6} /> Done · watch recap
              </button>
            ) : (
              <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-4)' }} onClick={startToday}>
                <Icon name="play" size={18} /> {active ? 'Continue workout' : session.kind === 'lift' ? 'Start workout' : 'Start run'}
              </button>
            )}
          </>
        ) : (
          <p className="sub" style={{ marginTop: 'var(--s-3)' }}>
            Your Train ring is already closed. Recovery is part of the season.
          </p>
        )}
      </Collapsible>
      </motion.div>

      <motion.div {...enter(5)}>
        <SoundtrackPick kind={session.kind} onMore={() => setListenOpen(true)} />
      </motion.div>
      <Sheet open={listenOpen} onClose={() => setListenOpen(false)} title="Soundtrack">
        <SoundtrackLibrary kind={session.kind} />
      </Sheet>

      <motion.div {...enter(5)}>
        <WeighInCard logged={todayWeigh?.lb} last={weighIns.at(-1)?.lb} />
      </motion.div>

      <motion.div {...enter(6)}>
        <GoalCard profile={profile} />
      </motion.div>

      {season.progress !== null && (
        <motion.section {...enter(7)} className="card" aria-label="Preseason progress">
          <div className="card-row">
            <span className="title3">{season.name}</span>
            <span className="caption num">
              Day {season.dayOfSeason} of {season.lengthDays}
            </span>
          </div>
          <div className="bar" style={{ marginTop: 'var(--s-3)' }}>
            <motion.div
              className="bar__fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: season.progress }}
              transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.3 }}
            />
          </div>
          <p className="caption" style={{ marginTop: 'var(--s-2)' }}>
            {season.key === 'refresh'
              ? 'Week 1 is a refresh. Weeks 2–3 ramp up, then Season 1: Cut.'
              : 'Ramping up. Season 1: Cut starts after week 3.'}
          </p>
        </motion.section>
      )}
    </main>
  )
}

function Stat({ label, value, unit, icon }: { label: string; value: string; unit?: string; icon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <div className="stat">
      <span className="stat__value num">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      <span className="stat__label">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </span>
    </div>
  )
}

function GoalCard({ profile }: { profile: Profile }) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const goal = profile.goal

  if (goal) {
    const left = daysUntil(goal.date)
    const total = Math.max(1, daysUntil(goal.date, new Date(profile.startDate + 'T12:00:00')))
    const pct = Math.min(1, Math.max(0, 1 - left / total))
    const weeks = Math.floor(left / 7)
    return (
      <section className="card card--glow" aria-label={`${left} days until ${goal.label}`}>
        <div className="card-row" style={{ alignItems: 'flex-end' }}>
          <div className="stack gap-1">
            <span className="eyebrow">Countdown</span>
            <span className="title2">{goal.label}</span>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="stat__value num" style={{ fontSize: 'var(--fs-hero-stat)' }}>
              {Math.max(0, left)}
            </span>
            <span className="caption">days to go</span>
          </div>
        </div>
        <div className="bar" style={{ marginTop: 'var(--s-4)' }}>
          <motion.div
            className="bar__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0.02, pct) }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.3 }}
          />
        </div>
        <p className="caption" style={{ marginTop: 'var(--s-2)' }}>
          {left > 0 ? `${weeks} week${weeks === 1 ? '' : 's'} of work left. Stack the days.` : 'Game day. Enjoy it.'}
        </p>
      </section>
    )
  }

  const valid = label.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && daysUntil(date) > 0
  return (
    <section className="card" aria-labelledby="goal-title">
      <h2 id="goal-title" className="title3">
        Training for something?
      </h2>
      <p className="sub" style={{ marginTop: 4 }}>
        Add a trip or event and Today counts down to it.
      </p>
      <form
        className="stack gap-2"
        style={{ marginTop: 'var(--s-3)' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          haptic.success()
          saveProfile({ ...profile, goal: { label: label.trim(), date } })
        }}
      >
        <label className="sr-only" htmlFor="goal-label">
          Goal name
        </label>
        <input
          id="goal-label"
          className="field"
          placeholder="e.g. Beach trip"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="row">
          <label className="sr-only" htmlFor="goal-date">
            Goal date
          </label>
          <input
            id="goal-date"
            className="field"
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary" disabled={!valid} type="submit">
            Save
          </button>
        </div>
      </form>
    </section>
  )
}

function WeighInCard({ logged, last }: { logged?: number; last?: number }) {
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)

  if (logged && !editing) {
    return (
      <section className="card" aria-label="Morning weigh-in">
        <div className="card-row">
          <div className="row">
            <span className="icon-btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
              <Icon name="check" size={20} strokeWidth={2.6} />
            </span>
            <div className="stack">
              <span className="title3 num">{logged.toFixed(1)} lb</span>
              <span className="caption">Weigh-in logged · +15 XP</span>
            </div>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </section>
    )
  }

  const n = Number(value)
  const valid = value !== '' && n > 60 && n < 500

  return (
    <section className="card" aria-labelledby="weigh-title">
      <div className="row" style={{ marginBottom: 'var(--s-3)' }}>
        <Icon name="scale" size={20} className="accent" />
        <h2 id="weigh-title" className="title3">
          Morning weigh-in
        </h2>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          logWeighIn(Math.round(n * 10) / 10)
          haptic.success()
          setEditing(false)
          setValue('')
        }}
      >
        <label className="sr-only" htmlFor="weigh">
          Body weight in pounds
        </label>
        <input
          id="weigh"
          className="field num"
          inputMode="decimal"
          placeholder={last ? `${last.toFixed(1)} lb last time` : 'Weight in lb'}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{ flex: 1 }}
        />
        <button className="btn btn--primary" disabled={!valid} type="submit">
          Log
        </button>
      </form>
    </section>
  )
}
