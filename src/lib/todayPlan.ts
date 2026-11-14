// Today's checklist in time order, and which item is "Up next" right now.
import type { PlannedMeal } from './eatStore'
import type { SessionSummary } from '../data/programs'
import type { Supplement } from './profile'

export type TodayItem =
  | { id: string; kind: 'plan'; time: number; title: string; sub: string; done: boolean; optional?: false }
  | { id: string; kind: 'weigh'; time: number; title: string; sub: string; done: boolean; optional?: false; lb?: number }
  | { id: string; kind: 'meal'; time: number; title: string; sub: string; done: boolean; optional?: false; meal: PlannedMeal }
  | { id: string; kind: 'session'; time: number; title: string; sub: string; done: boolean; optional: boolean; rest: boolean }
  | { id: string; kind: 'supp'; time: null; title: string; sub: string; done: boolean; optional?: false; supp: Supplement }

export const SESSION_HOUR = 17.5 // default training time: 5:30 pm

export function buildTodayItems(input: {
  hasPlan: boolean
  weighedLb?: number
  meals: PlannedMeal[]
  session: SessionSummary
  sessionDone: boolean
  supplements: Supplement[]
  suppsTaken: Set<string>
}): TodayItem[] {
  const items: TodayItem[] = []
  if (!input.hasPlan) items.push({ id: 'plan', kind: 'plan', time: -1, title: 'Plan your week', sub: 'Pick meals once, get your grocery list', done: false })
  items.push({
    id: 'weigh',
    kind: 'weigh',
    time: 7,
    title: 'Morning weigh-in',
    sub: input.weighedLb ? `${input.weighedLb.toFixed(1)} lb` : 'Before breakfast',
    done: !!input.weighedLb,
    lb: input.weighedLb,
  })
  for (const m of input.meals) {
    const replaced = m.entry && !m.entry.planned
    items.push({
      id: `meal:${m.slot}:${m.mealId}`,
      kind: 'meal',
      time: m.startHour,
      title: replaced ? m.entry!.name : m.name,
      sub: replaced ? `${m.entry!.protein} g protein · ${m.entry!.cal} cal` : `${m.macros.protein} g protein · ${m.macros.cal} cal`,
      done: !!m.entry,
      meal: m,
    })
  }
  const s = input.session
  const rest = s.kind === 'rest'
  items.push({
    id: 'session',
    kind: 'session',
    time: SESSION_HOUR,
    title: rest ? 'Rest day' : s.name,
    sub: rest ? 'Recovery counts toward your rings' : `${s.minutes[0]}–${s.minutes[1]} min${s.kind === 'optional' ? ' · optional' : ''}`,
    done: rest || input.sessionDone,
    optional: s.kind === 'optional',
    rest,
  })
  for (const supp of input.supplements) {
    items.push({ id: `supp:${supp.id}`, kind: 'supp', time: null, title: supp.name, sub: supp.dose, done: input.suppsTaken.has(supp.id), supp })
  }
  return items.sort((a, b) => (a.time ?? 99) - (b.time ?? 99))
}

/**
 * Up next: the first unfinished item whose window hasn't passed (start + 2 h);
 * otherwise the earliest unfinished timed item; optional sessions and anytime
 * items (supplements) only when nothing else is left.
 */
export function pickUpNext(items: TodayItem[], nowHour: number): TodayItem | null {
  const open = items.filter((i) => !i.done)
  const plan = open.find((i) => i.kind === 'plan')
  if (plan) return plan
  const required = open.filter((i) => i.time != null && !(i.kind === 'session' && i.optional))
  return (
    required.find((i) => (i.time as number) + 2 > nowHour) ??
    required[0] ??
    open.find((i) => i.kind === 'session') ??
    open[0] ??
    null
  )
}

export function timeLabel(hour: number | null) {
  if (hour == null || hour < 0) return ''
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')}`
}
