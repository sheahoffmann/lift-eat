// Pick which day you're logging: ‹ Yesterday › arrows plus a month calendar.
// Days that already have something logged get a dot. Future days are off.
import { useState } from 'react'
import { todayISO } from '../lib/profile'
import { addDays } from '../lib/eatStore'
import { haptic } from '../lib/haptics'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Today", "Yesterday" or "Mon, Nov 16". */
export function dayLabel(iso: string, today = todayISO()) {
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return parse(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** The 6×7 grid of ISO days for the month containing `month` (Sunday first). */
export function monthGrid(month: string) {
  const first = parse(month.slice(0, 7) + '-01')
  const start = addDays(todayISO(first), -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function DayBar({ date, setDate, marks }: { date: string; setDate: (d: string) => void; marks?: Set<string> }) {
  const today = todayISO()
  const [open, setOpen] = useState(false)
  const isToday = date >= today
  const go = (d: string) => {
    haptic.light()
    setDate(d > today ? today : d)
  }
  return (
    <>
      <div className="card card-row" style={{ padding: 'var(--s-2)', gap: 'var(--s-2)', outline: isToday ? undefined : '2px solid var(--accent)', outlineOffset: -2 }}>
        <button className="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
          <Icon name="chevron" size={18} className="rot180" />
        </button>
        <button className="row" style={{ flex: 1, justifyContent: 'center', gap: 8, minHeight: 44 }} onClick={() => setOpen(true)} aria-label={`Logging ${dayLabel(date, today)}. Open calendar`}>
          <Icon name="calendar" size={18} className={isToday ? 'muted' : 'accent'} />
          <span style={{ fontWeight: 700 }}>{dayLabel(date, today)}</span>
          {date === addDays(today, -1) && <span className="caption">{parse(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
        </button>
        <button className="icon-btn" aria-label="Next day" disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }} onClick={() => go(addDays(date, 1))}>
          <Icon name="chevron" size={18} />
        </button>
      </div>
      {!isToday && (
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 'calc(var(--s-2) * -1)' }}>
          <span className="caption">You're editing a past day.</span>
          <button className="link-btn" style={{ minHeight: 32 }} onClick={() => go(today)}>
            Back to today
          </button>
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Pick a day">
        {open && (
          <Calendar
            date={date}
            marks={marks}
            onPick={(d) => {
              go(d)
              setOpen(false)
            }}
          />
        )}
      </Sheet>
    </>
  )
}

export function Calendar({ date, marks, onPick }: { date: string; marks?: Set<string>; onPick: (d: string) => void }) {
  const today = todayISO()
  const [month, setMonth] = useState(date.slice(0, 7))
  const days = monthGrid(month)
  const shift = (n: number) => {
    const d = parse(month + '-01')
    setMonth(todayISO(new Date(d.getFullYear(), d.getMonth() + n, 1)).slice(0, 7))
  }
  const canNext = month < today.slice(0, 7)
  return (
    <div className="stack gap-3">
      <div className="card-row">
        <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <Icon name="chevron" size={18} className="rot180" />
        </button>
        <span className="title3" aria-live="polite">
          {parse(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button className="icon-btn" aria-label="Next month" disabled={!canNext} style={{ opacity: canNext ? 1 : 0.3 }} onClick={() => shift(1)}>
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <div role="grid" aria-label="Calendar" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className="caption" style={{ textAlign: 'center', fontWeight: 600 }} aria-hidden>
            {d}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month
          const future = d > today
          const sel = d === date
          const isToday = d === today
          return (
            <button
              key={d}
              role="gridcell"
              aria-selected={sel}
              aria-label={`${parse(d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${marks?.has(d) ? ', has entries' : ''}`}
              disabled={future}
              onClick={() => onPick(d)}
              className="num"
              style={{
                position: 'relative',
                height: 44,
                borderRadius: 12,
                fontWeight: sel || isToday ? 700 : 500,
                opacity: future ? 0.25 : inMonth ? 1 : 0.4,
                background: sel ? 'var(--accent-fill)' : 'transparent',
                color: sel ? '#fff' : isToday ? 'var(--accent)' : undefined,
              }}
            >
              {Number(d.slice(8))}
              {marks?.has(d) && (
                <span
                  aria-hidden
                  style={{ position: 'absolute', bottom: 5, left: '50%', width: 5, height: 5, marginLeft: -2.5, borderRadius: 3, background: sel ? '#fff' : 'var(--accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>
      <p className="caption">Dots mark days you logged something. Tap any past day to add or change it.</p>
    </div>
  )
}
