// Monday weekly recap: workouts, PRs, rings, weight trend, ratings, XP.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import type { Profile } from '../../lib/profile'
import { todayISO } from '../../lib/profile'
import { addDaysISO, computeGame, useGameData, weekStart } from '../../lib/game'
import { calorieRange } from '../../lib/nutrition'
import { exercises } from '../../data/exercises'
import { CountUp, Story } from '../../components/Story'
import { prText } from '../train/WorkoutView'

export function lastWeekRange(today = todayISO()) {
  const start = addDaysISO(weekStart(today), -7)
  return { start, end: addDaysISO(start, 6) }
}

export function WeeklyRecap({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const data = useGameData()
  const snaps = useLiveQuery(() => db.attributes.orderBy('date').toArray(), [])
  if (!data || !snaps) return null
  const { start, end } = lastWeekRange()
  const inWeek = (d: string) => d >= start && d <= end
  const workouts = data.workouts.filter((w) => w.finishedAt && inWeek(w.date))
  const lifts = workouts.filter((w) => !w.cardio)
  const prs = workouts.flatMap((w) => w.prs ?? [])
  const [lo, hi] = calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })
  let fuelDays = 0
  let proteinDays = 0
  for (let i = 0; i < 7; i++) {
    const d = addDaysISO(start, i)
    const food = data.food.filter((f) => f.date === d)
    const p = food.reduce((s, f) => s + f.protein, 0)
    const c = food.reduce((s, f) => s + f.cal, 0)
    if (p >= profile.proteinTarget - 5) proteinDays++
    if (p >= profile.proteinTarget - 5 && c >= lo && c <= hi) fuelDays++
  }
  const weights = data.weighIns.filter((w) => w.lb > 0)
  const avgOf = (a: string, b: string) => {
    const xs = weights.filter((w) => w.date >= a && w.date <= b)
    return xs.length ? xs.reduce((s, w) => s + w.lb, 0) / xs.length : null
  }
  const thisAvg = avgOf(start, end)
  const prevAvg = avgOf(addDaysISO(start, -7), addDaysISO(start, -1))
  const change = thisAvg != null && prevAvg != null ? thisAvg - prevAvg : null

  const game = computeGame(data, profile)
  const xpWeek = game.events.filter((e) => inWeek(e.date)).reduce((s, e) => s + e.amount, 0)
  const snapStart = [...snaps].reverse().find((s) => s.date < start) ?? snaps[0]
  const snapEnd = [...snaps].reverse().find((s) => s.date <= end) ?? snaps.at(-1)
  const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  const slides = [
    <div key="w" className="stack gap-4">
      <span className="slide-kicker">
        Week of {label(start)} – {label(end)}
      </span>
      <h2 className="large-title">Your week in review</h2>
      <div className="stack gap-1">
        <CountUp value={workouts.length} className="hero-num" />
        <span className="sub">
          sessions · {lifts.length} lift{lifts.length === 1 ? '' : 's'}, {workouts.length - lifts.length} cardio
        </span>
      </div>
      {workouts.length === 0 && <p className="sub">Quiet week. Back at it: today's a fresh start.</p>}
    </div>,
    <div key="pr" className="stack gap-3">
      <span className="slide-kicker">PRs</span>
      <CountUp value={prs.length} className="hero-num" />
      {prs.slice(0, 5).map((pr, k) => (
        <div key={k} className="card card-row" style={{ padding: 'var(--s-3) var(--s-4)' }}>
          <span style={{ fontWeight: 600 }}>{exercises[pr.exerciseId]?.name}</span>
          <span className="accent num" style={{ fontWeight: 700 }}>
            {prText(pr).value}
          </span>
        </div>
      ))}
      {prs.length === 0 && <p className="sub">No PRs this week. Strength comes in waves.</p>}
    </div>,
    <div key="fuel" className="stack gap-4">
      <span className="slide-kicker">Fuel</span>
      <div className="stats card">
        <div className="stat">
          <CountUp value={fuelDays} className="stat__value" />
          <span className="stat__label">Fuel rings closed</span>
        </div>
        <div className="stat">
          <CountUp value={proteinDays} className="stat__value" />
          <span className="stat__label">protein days</span>
        </div>
      </div>
      <p className="sub">{fuelDays >= 5 ? 'Nutrition locked in. That is where the results come from.' : 'Aim for 5+ Fuel days. Protein first, then stay in range.'}</p>
    </div>,
    <div key="wt" className="stack gap-4">
      <span className="slide-kicker">Weight trend</span>
      {change != null ? (
        <>
          <CountUp value={Math.abs(change)} decimals={1} suffix=" lb" className="hero-num" />
          <span className="sub">
            {change < 0 ? 'down' : 'up'} vs. the week before (weekly averages: {prevAvg!.toFixed(1)} → {thisAvg!.toFixed(1)})
          </span>
        </>
      ) : (
        <p className="sub">Log a few morning weigh-ins each week to see your trend here.</p>
      )}
    </div>,
    <div key="rt" className="stack gap-4">
      <span className="slide-kicker">Ratings + XP</span>
      <div className="stack gap-1">
        <CountUp value={xpWeek} suffix=" XP" className="hero-num" />
        <span className="sub">
          Level {game.level.level} · {game.level.title}
        </span>
      </div>
      {snapStart && snapEnd && (
        <div className="player__attrs" style={{ marginTop: 0 }}>
          {(['strength', 'power', 'engine', 'discipline'] as const).map((k) => {
            const d = snapEnd[k] - snapStart[k]
            return (
              <div key={k} className="stack" style={{ gap: 2 }}>
                <span className="stat__value num" style={{ fontSize: 'var(--fs-title1)' }}>
                  {snapEnd[k]}
                </span>
                <span className="caption" style={{ fontWeight: 700 }}>
                  {k.slice(0, 3).toUpperCase()} {d !== 0 && <span className={d > 0 ? 'accent' : ''}>{d > 0 ? `+${d}` : d}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <span className="chip chip--accent" style={{ alignSelf: 'flex-start' }}>
        {game.streak.streak}-week streak
      </span>
    </div>,
  ]
  return <Story slides={slides} onClose={onClose} />
}
