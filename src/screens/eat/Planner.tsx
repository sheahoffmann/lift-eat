// Weekly planner: one pick per meal → live totals → fix-it → kitchen check → lock in.
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Profile } from '../../lib/profile'
import { todayISO } from '../../lib/profile'
import { mealsById, optionsFor, slotMeta, type MealOption, type Slot } from '../../data/meals'
import {
  calorieRange,
  checkDay,
  dayVariants,
  describeChange,
  describeGap,
  isComplete,
  mealMacros,
  portionFor,
  round,
  suggestFixes,
  type Macros,
  type Targets,
} from '../../lib/nutrition'
import { stapleCandidates } from '../../lib/grocery'
import { lockPlan } from '../../lib/eatStore'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { GroceryListView } from './GroceryList'
import { CustomMealForm } from './CustomMealForm'
import { Sheet } from '../../components/Sheet'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CustomMeal, type Picks, type WeekPlan } from '../../lib/db'
import { deleteCustomMeal, toMealOption } from '../../lib/customMeals'
import { setCustomMeals } from '../../data/meals'

type Step = Slot | 'review' | 'kitchen' | 'done'
const steps: Step[] = ['breakfast', 'lunch', 'snack', 'dinner', 'evening', 'review', 'kitchen', 'done']

const emptyPicks: Picks = { breakfast: '', lunch: '', snack: '', dinner: [], evening: null, extras: [] }

export function Planner({ profile, previous, onClose }: { profile: Profile; previous?: WeekPlan | null; onClose: () => void }) {
  const portion = portionFor(profile.calorieTarget)
  const targets: Targets = { calories: profile.calorieTarget, protein: profile.proteinTarget }
  const [picks, setPicks] = useState<Picks>(previous?.picks ?? emptyPicks)
  const [step, setStep] = useState<Step>('breakfast')
  const [dir, setDir] = useState(1)
  const [pantry, setPantry] = useState<string[]>([])
  const [locked, setLocked] = useState<WeekPlan | null>(null)

  const i = steps.indexOf(step)
  const go = (s: Step) => {
    setDir(steps.indexOf(s) >= i ? 1 : -1)
    setStep(s)
    document.querySelector('.sheet--full .sheet__body')?.scrollTo({ top: 0 })
  }
  const next = () => go(steps[Math.min(steps.length - 1, i + 1)])
  const back = () => (i === 0 ? onClose() : go(steps[i - 1]))

  const pick = (slot: 'breakfast' | 'lunch' | 'snack', id: string) => {
    haptic.light()
    setPicks((p) => ({ ...p, [slot]: id }))
    setTimeout(next, 220)
  }

  async function lockIn() {
    const plan = await lockPlan({
      picks,
      portion,
      calorieTarget: profile.calorieTarget,
      proteinTarget: profile.proteinTarget,
      pantryHave: pantry,
      startDate: todayISO(),
    })
    haptic.celebrate()
    setLocked(plan)
    go('done')
  }

  return (
    <div className="stack" style={{ minHeight: '100%' }}>
      {step !== 'done' && <TotalsBar picks={picks} portion={portion} targets={targets} step={i} onBack={back} onClose={onClose} />}

      <div style={{ padding: `var(--s-2) var(--gutter) calc(env(safe-area-inset-bottom) + var(--s-10))`, overflowX: 'hidden' }}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 * dir, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="stack gap-4"
          >
            {(step === 'breakfast' || step === 'lunch' || step === 'snack') && (
              <SlotStep slot={step} portion={portion} selected={[picks[step]]} onPick={(id) => pick(step, id)} />
            )}

            {step === 'dinner' && (
              <>
                <SlotStep
                  slot="dinner"
                  portion={portion}
                  selected={picks.dinner}
                  multi
                  onPick={(id) => {
                    haptic.light()
                    setPicks((p) => {
                      if (p.dinner.includes(id)) return { ...p, dinner: p.dinner.filter((d) => d !== id) }
                      if (p.dinner.length >= 2) return { ...p, dinner: [p.dinner[1], id] }
                      return { ...p, dinner: [...p.dinner, id] }
                    })
                  }}
                />
                <p className="caption" style={{ textAlign: 'center' }}>
                  {picks.dinner.length === 2
                    ? `Alternating ${mealsById[picks.dinner[0]].name} and ${mealsById[picks.dinner[1]].name}.`
                    : 'Pick one, or two to alternate day by day.'}
                </p>
                <button className="btn btn--primary btn--block" disabled={!picks.dinner.length} onClick={next}>
                  Next
                </button>
              </>
            )}

            {step === 'evening' && (
              <>
                <SlotStep
                  slot="evening"
                  portion={portion}
                  selected={[picks.evening ?? '']}
                  onPick={(id) => {
                    haptic.light()
                    setPicks((p) => ({ ...p, evening: id }))
                    setTimeout(next, 220)
                  }}
                />
                <button
                  className="option"
                  aria-pressed={picks.evening === null}
                  onClick={() => {
                    haptic.light()
                    setPicks((p) => ({ ...p, evening: null }))
                    setTimeout(next, 220)
                  }}
                >
                  <div className="stack" style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>No evening snack</span>
                    <span className="caption">You can add one later if the numbers need it.</span>
                  </div>
                  <span className={`check-dot ${picks.evening === null ? 'check-dot--on' : ''}`} aria-hidden>
                    {picks.evening === null && <Icon name="check" size={15} strokeWidth={3} />}
                  </span>
                </button>
              </>
            )}

            {step === 'review' && (
              <Review picks={picks} setPicks={setPicks} portion={portion} targets={targets} go={go} onNext={next} />
            )}

            {step === 'kitchen' && (
              <Kitchen picks={picks} portion={portion} pantry={pantry} setPantry={setPantry} onLock={lockIn} />
            )}

            {step === 'done' && locked && (
              <div className="stack gap-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + var(--s-4))' }}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="stack"
                  style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-2)' }}
                >
                  <span className="icon-btn" style={{ width: 64, height: 64, background: 'var(--accent-fill)', color: '#fff' }} aria-hidden>
                    <Icon name="check" size={32} strokeWidth={3} />
                  </span>
                  <h2 className="title1">Week locked in</h2>
                  <p className="sub">Here's your grocery list. Every meal this week is one tap to log.</p>
                  <p className="caption">Not at the store yet? Tap Done. The list stays on the Eat tab (and on Today until you've shopped), with your checkmarks saved.</p>
                </motion.div>
                <GroceryListView plan={locked} />
                <button className="btn btn--invert btn--block" onClick={onClose}>
                  Done
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ---------- Totals bar ----------

function TotalsBar({
  picks,
  portion,
  targets,
  step,
  onBack,
  onClose,
}: {
  picks: Picks
  portion: number
  targets: Targets
  step: number
  onBack: () => void
  onClose: () => void
}) {
  const variants = dayVariants(picks, portion).map(round)
  const complete = isComplete(picks)
  const [lo, hi] = calorieRange(targets)

  return (
    <div className="totals-bar">
      <div className="card-row" style={{ marginBottom: 'var(--s-3)' }}>
        <button className="icon-btn" onClick={onBack} aria-label={step === 0 ? 'Close planner' : 'Back'}>
          <Icon name={step === 0 ? 'close' : 'back'} size={18} />
        </button>
        <div className="row" style={{ gap: 5 }} aria-label={`Step ${step + 1} of 7`}>
          {steps.slice(0, 7).map((s, j) => (
            <span
              key={s}
              style={{
                width: j === step ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: j <= step ? 'var(--accent)' : 'var(--ring-track)',
                transition: 'all var(--dur-med) var(--ease-out)',
              }}
            />
          ))}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close planner" style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {variants.map((v, d) => {
        const c = checkDay(v, targets)
        return (
          <div key={d} className="stack gap-2" style={{ marginTop: d ? 'var(--s-2)' : 0 }}>
            <div className="row" style={{ alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span className="caption" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {variants.length > 1 ? `Day ${d === 0 ? 'A' : 'B'}` : 'Daily total'}
              </span>
              {complete && (
                <span className={`caption ${c.ok ? 'accent' : ''}`} style={{ fontWeight: 600, marginLeft: 'auto', textAlign: 'right' }}>
                  {c.ok ? 'On target' : describeGap(c)}
                </span>
              )}
            </div>
            <div className="row" style={{ gap: 'var(--s-4)' }}>
              <Meter label="Protein" value={v.protein} unit="g" target={targets.protein} max={targets.protein * 1.4} band={[targets.protein - 5, targets.protein * 1.4]} />
              <Meter label="Calories" value={v.cal} target={targets.calories} max={hi * 1.15} band={[lo, hi]} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Meter({
  label,
  value,
  unit,
  target,
  max,
  band,
}: {
  label: string
  value: number
  unit?: string
  target: number
  max: number
  band: [number, number]
}) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / max) * 100))}%`
  return (
    <div className="stack" style={{ flex: 1, gap: 6 }}>
      <div className="row" style={{ gap: 4, alignItems: 'baseline' }}>
        <span className="num" style={{ fontWeight: 700, fontSize: 'var(--fs-title3)' }}>
          {value.toLocaleString()}
        </span>
        <span className="caption num">
          / {target.toLocaleString()}
          {unit} {label.toLowerCase()}
        </span>
      </div>
      <div className="meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="meter__band" style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }} />
        <div className="meter__fill" style={{ width: pct(value) }} />
      </div>
    </div>
  )
}

// ---------- Slot step ----------

function SlotStep({
  slot,
  portion,
  selected,
  onPick,
  multi,
}: {
  slot: Slot
  portion: number
  selected: string[]
  onPick: (id: string) => void
  multi?: boolean
}) {
  const meta = slotMeta[slot]
  const mine = useLiveQuery(() => db.customMeals.where('slot').equals(slot).toArray(), [slot], [] as CustomMeal[])
  const [form, setForm] = useState<{ existing?: CustomMeal } | null>(null)
  return (
    <>
      <header className="stack gap-1" style={{ marginTop: 'var(--s-2)' }}>
        <span className="eyebrow">
          {meta.label} · {meta.time}
        </span>
        <h2 className="title1">{slot === 'evening' ? 'Evening snack?' : `Pick your ${meta.label.toLowerCase()}`}</h2>
      </header>
      <div className="stack gap-3" role={multi ? 'group' : 'radiogroup'} aria-label={meta.label}>
        {optionsFor(slot).map((o) => (
          <OptionCard
            key={o.id}
            meal={o}
            portion={portion}
            selected={selected.includes(o.id)}
            badge={multi && selected.length === 2 && selected.includes(o.id) ? (selected[0] === o.id ? 'A' : 'B') : undefined}
            multi={multi}
            onClick={() => onPick(o.id)}
          />
        ))}
        <button className="option" onClick={() => setForm({})} style={{ borderStyle: 'dashed', justifyContent: 'center' }}>
          <Icon name="plus" size={18} className="accent" />
          <span style={{ fontWeight: 650 }}>Add your own {meta.label.toLowerCase()}</span>
        </button>
      </div>
      {mine.length > 0 && (
        <div className="stack" style={{ gap: 2 }}>
          <span className="caption">Your options</span>
          {mine.map((c) => (
            <div key={c.id} className="card-row" style={{ minHeight: 36 }}>
              <span className="sub" style={{ color: 'var(--text)' }}>{c.name}</span>
              <span className="row" style={{ gap: 4 }}>
                <button className="link-btn" style={{ minHeight: 36 }} onClick={() => setForm({ existing: c })}>
                  Edit
                </button>
                <button
                  className="link-btn"
                  style={{ minHeight: 36, color: 'var(--text-3)' }}
                  onClick={async () => {
                    if (confirm(`Delete "${c.name}"? Plans already locked keep their numbers.`)) await deleteCustomMeal(c.id)
                  }}
                >
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.existing ? 'Edit option' : 'Add your own'}>
        {form && (
          <CustomMealForm
            slot={slot}
            existing={form.existing}
            onSaved={(m) => {
              setForm(null)
              setCustomMeals([...optionsFor('breakfast'), ...optionsFor('lunch'), ...optionsFor('snack'), ...optionsFor('dinner'), ...optionsFor('evening')].filter((o) => o.custom && o.id !== m.id).concat(toMealOption(m)))
              if (!form.existing && !selected.includes(m.id)) onPick(m.id)
            }}
          />
        )}
      </Sheet>
    </>
  )
}

function OptionCard({
  meal,
  portion,
  selected,
  onClick,
  multi,
  badge,
}: {
  meal: MealOption
  portion: number
  selected: boolean
  onClick: () => void
  multi?: boolean
  badge?: string
}) {
  const m = round(mealMacros(meal, portion))
  return (
    <button className="option" role={multi ? undefined : 'radio'} aria-checked={multi ? undefined : selected} aria-pressed={multi ? selected : undefined} onClick={onClick}>
      <div className="stack gap-2" style={{ flex: 1, minWidth: 0 }}>
        <div className="stack" style={{ gap: 2 }}>
          <span className="title3">{meal.name}</span>
          <span className="sub">{meal.desc}</span>
        </div>
        <div className="macro-pills">
          <span className="pill-sm pill-sm--accent">{m.protein} g protein</span>
          <span className="pill-sm">{m.cal} cal</span>
          <span className="pill-sm">{meal.prep === 'Restaurant' ? 'Order out' : meal.minutes ? `${meal.prep} · ${meal.minutes} min` : meal.prep}</span>
        </div>
      </div>
      <span className={`check-dot ${selected ? 'check-dot--on' : ''}`} aria-hidden>
        {selected && (badge ? <span style={{ fontSize: 12, fontWeight: 800 }}>{badge}</span> : <Icon name="check" size={15} strokeWidth={3} />)}
      </span>
    </button>
  )
}

// ---------- Review + fix it ----------

function Review({
  picks,
  setPicks,
  portion,
  targets,
  go,
  onNext,
}: {
  picks: Picks
  setPicks: (p: Picks) => void
  portion: number
  targets: Targets
  go: (s: Step) => void
  onNext: () => void
}) {
  const variants = dayVariants(picks, portion)
  const ok = isComplete(picks) && variants.every((v) => checkDay(v, targets).ok)
  const fixes = useMemo(() => (ok ? [] : suggestFixes(picks, portion, targets)), [ok, picks, portion, targets])
  const [confirmAnyway, setConfirmAnyway] = useState(false)

  const rows: { slot: Step; label: string; ids: string[] }[] = [
    { slot: 'breakfast', label: 'Breakfast', ids: [picks.breakfast] },
    { slot: 'lunch', label: 'Lunch', ids: [picks.lunch] },
    { slot: 'snack', label: 'Snack', ids: [picks.snack] },
    { slot: 'dinner', label: picks.dinner.length > 1 ? 'Dinners (alternate)' : 'Dinner', ids: picks.dinner },
    { slot: 'evening', label: 'Evening', ids: picks.evening ? [picks.evening] : [] },
  ]

  return (
    <>
      <header className="stack gap-1" style={{ marginTop: 'var(--s-2)' }}>
        <span className="eyebrow">Review</span>
        <h2 className="title1">{ok ? 'Your week works' : 'Almost there'}</h2>
        <p className="sub">
          {ok
            ? 'Protein covered and calories in range every day.'
            : 'These picks miss your targets. Tap a fix below and the totals update.'}
        </p>
      </header>

      {!ok && fixes.length > 0 && (
        <section className="stack gap-3" aria-label="Suggested fixes">
          {fixes.map((f, k) => (
            <FixCard key={k} fix={f} onApply={() => {
              haptic.success()
              setPicks(f.picks)
            }} />
          ))}
        </section>
      )}

      <section className="card stack" style={{ padding: 'var(--s-2) var(--s-4)' }} aria-label="Your picks">
        {rows.map((r) => (
          <button key={r.label} className="g-row" onClick={() => go(r.slot)} aria-label={`Change ${r.label}`}>
            <div className="stack" style={{ flex: 1, minWidth: 0 }}>
              <span className="caption">{r.label}</span>
              <span style={{ fontWeight: 600 }}>{r.ids.length ? r.ids.map((id) => mealsById[id]?.name).join(' / ') : 'None'}</span>
            </div>
            <Icon name="pencil" size={16} className="muted" />
          </button>
        ))}
        {picks.extras.map((e) => (
          <div key={e} className="g-row">
            <div className="stack" style={{ flex: 1 }}>
              <span className="caption">Extra, daily</span>
              <span style={{ fontWeight: 600 }}>{mealsById[e].name}</span>
            </div>
            <button className="link-btn" onClick={() => setPicks({ ...picks, extras: picks.extras.filter((x) => x !== e) })}>
              Remove
            </button>
          </div>
        ))}
      </section>

      {ok ? (
        <button className="btn btn--primary btn--block" onClick={onNext}>
          Next: check your kitchen
        </button>
      ) : confirmAnyway ? (
        <div className="stack gap-2">
          <p className="caption" style={{ textAlign: 'center' }}>
            You can lock it in as is. Fuel rings close only on days you hit protein and stay in range.
          </p>
          <button className="btn btn--secondary btn--block" onClick={onNext}>
            Continue anyway
          </button>
        </div>
      ) : (
        <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setConfirmAnyway(true)}>
          Keep my picks as they are
        </button>
      )}
    </>
  )
}

function FixCard({ fix, onApply }: { fix: ReturnType<typeof suggestFixes>[number]; onApply: () => void }) {
  const d = fix.delta
  const v = fix.variants.map(round)
  const sign = (n: number) => (n >= 0 ? `+${Math.round(n)}` : `${Math.round(n)}`)
  return (
    <div className="card" style={{ padding: 'var(--s-4)' }}>
      <div className="row" style={{ gap: 8, marginBottom: 'var(--s-2)' }}>
        <Icon name="wand" size={18} className="accent" />
        <span style={{ fontWeight: 700 }}>
          {fix.changes.length === 1 ? 'One change' : `${fix.changes.length} changes`}
        </span>
        <span className="spacer" />
        <span className="pill-sm pill-sm--accent">{sign(d.protein)} g protein</span>
        <span className="pill-sm">{sign(d.cal)} cal</span>
      </div>
      <ul className="stack gap-1" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
        {fix.changes.map((c, k) => (
          <li key={k} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <Icon name="swap" size={16} className="muted" />
            <span className="sub" style={{ color: 'var(--text)' }}>
              {describeChange(c)}
            </span>
          </li>
        ))}
      </ul>
      <div className="card-row" style={{ marginTop: 'var(--s-3)' }}>
        <span className="caption num">
          After: {v.map((x: Macros) => `${x.protein} g · ${x.cal.toLocaleString()} cal`).join('  /  ')}
        </span>
        <button className="btn btn--primary btn--sm" onClick={onApply}>
          Apply
        </button>
      </div>
    </div>
  )
}

// ---------- Kitchen check ----------

function Kitchen({
  picks,
  portion,
  pantry,
  setPantry,
  onLock,
}: {
  picks: Picks
  portion: number
  pantry: string[]
  setPantry: (p: string[]) => void
  onLock: () => void
}) {
  const items = stapleCandidates(picks, portion)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <header className="stack gap-1" style={{ marginTop: 'var(--s-2)' }}>
        <span className="eyebrow">Before you shop</span>
        <h2 className="title1">What's still in your kitchen?</h2>
        <p className="sub">Turn on anything you have enough of for the week. It stays off the list.</p>
      </header>
      <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
        {items.map((it) => {
          const on = pantry.includes(it.id)
          return (
            <button
              key={it.id}
              className="g-row"
              role="switch"
              aria-checked={on}
              onClick={() => {
                haptic.light()
                setPantry(on ? pantry.filter((p) => p !== it.id) : [...pantry, it.id])
              }}
            >
              <span style={{ flex: 1, fontWeight: 500 }}>{it.name}</span>
              <span className="toggle" aria-checked={on} aria-hidden />
            </button>
          )
        })}
      </section>
      <button
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onLock()
          } finally {
            setBusy(false)
          }
        }}
      >
        <Icon name="check" size={18} strokeWidth={2.6} /> Lock in my week
      </button>
    </>
  )
}
