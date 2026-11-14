// Weekly check-in: compare this week's average weight to last week's and
// suggest a calorie change. Guardrail: never push loss faster than ~2 lb/week.
import type { WeighIn } from './db'
import { addDaysISO, weekStart } from './game'
import { todayISO } from './profile'

export type CheckIn = {
  weekStart: string
  thisAvg: number
  prevAvg: number
  change: number // lb/week (negative = loss)
  delta: -150 | 0 | 150
  message: string
}

const avg = (xs: WeighIn[]) => xs.reduce((s, w) => s + w.lb, 0) / xs.length

/** Uses the last two complete Mon–Sun weeks; needs ≥ 2 weigh-ins in each. */
export function computeCheckIn(weighIns: WeighIn[], phase: 'cut' | 'build' | 'refresh' | 'preseason', today = todayISO()): CheckIn | null {
  const valid = weighIns.filter((w) => w.lb > 0)
  const thisStart = addDaysISO(weekStart(today), -7)
  const prevStart = addDaysISO(thisStart, -7)
  const inRange = (a: string, b: string) => valid.filter((w) => w.date >= a && w.date <= b)
  const cur = inRange(thisStart, addDaysISO(thisStart, 6))
  const prev = inRange(prevStart, addDaysISO(prevStart, 6))
  if (cur.length < 2 || prev.length < 2) return null
  const thisAvg = avg(cur)
  const prevAvg = avg(prev)
  const change = thisAvg - prevAvg
  let delta: CheckIn['delta'] = 0
  let message = 'On track. Keep everything the same.'
  if (phase === 'build') {
    if (change < 0) {
      delta = 150
      message = `Down ${Math.abs(change).toFixed(1)} lb while building. Add 150 calories.`
    } else if (change > 0.75) {
      delta = -150
      message = `Up ${change.toFixed(1)} lb, a bit fast for a lean build. Trim 150 calories.`
    } else message = `Up ${change.toFixed(1)} lb. Right in the lean-gain zone.`
  } else {
    const loss = -change
    if (loss < 0.5) {
      delta = -150
      message = loss <= 0 ? `Weight held steady. Trim 150 calories to restart the cut.` : `Down ${loss.toFixed(1)} lb, a little slow. Trim 150 calories.`
    } else if (loss > 2) {
      delta = 150
      message = `Down ${loss.toFixed(1)} lb, faster than 2 lb/week. Add 150 calories to protect muscle.`
    } else message = `Down ${loss.toFixed(1)} lb. Right on pace.`
  }
  return { weekStart: thisStart, thisAvg, prevAvg, change, delta, message }
}
