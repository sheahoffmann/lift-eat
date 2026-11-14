// Daily Eat page: today's planned meals in order, one tap to log each.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Profile } from '../lib/profile'
import { todayISO } from '../lib/profile'
import { mealsById, slotMeta, type Slot } from '../data/meals'
import {
  logPlanned,
  nextMeal,
  plannedMealsFor,
  removeEntry,
  totals,
  useDayLog,
  useLatestPlan,
  usePlanFor,
  type PlannedMeal,
} from '../lib/eatStore'
import { calorieRange } from '../lib/nutrition'
import { MacroGoals } from '../components/MacroGoals'
import { macroTargets } from '../lib/profile'
import { haptic } from '../lib/haptics'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { Planner } from './eat/Planner'
import { GroceryListView } from './eat/GroceryList'
import { AteSomethingElse } from './eat/AteSomethingElse'
import { MealBuild } from "../components/MealBuild"
import { SupplementsCard } from "./eat/Supplements"

export function Eat({ profile }: { profile: Profile }) {
  const date = todayISO()
  const plan = usePlanFor(date)
  const latest = useLatestPlan()
  const log = useDayLog(date)
  const [planning, setPlanning] = useState(false)
  const [groceries, setGroceries] = useState(false)
  const [other, setOther] = useState<null | { slot: Slot | 'extra' | 'other'; replacesMealId?: string; replacing?: string }>(null)

  const loading = plan === undefined || log === undefined
  const meals = plan && log ? plannedMealsFor(plan, date, log) : []
  const upNext = nextMeal(meals)
  const plannedEntryIds = new Set(meals.map((m) => m.entry?.id).filter(Boolean))
  const unplanned = (log ?? []).filter((e) => !plannedEntryIds.has(e.id))
  const t = totals(log ?? [])

  return (
    <main className="screen">
      <header className="card-row" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-1">
          <span className="eyebrow">{plan ? 'Just follow the plan' : 'Plan once, then just follow it'}</span>
          <h1 className="large-title">Eat</h1>
        </div>
        {plan && (
          <button className="btn btn--secondary btn--sm" onClick={() => setGroceries(true)}>
            <Icon name="cart" size={16} /> List
          </button>
        )}
      </header>

      <MacroGoals eaten={t} targets={macroTargets(profile)} calorieRange={calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })} />

      <SupplementsCard profile={profile} date={date} />

      {loading ? (
        <div className="card" style={{ height: 220, opacity: 0.5 }} aria-busy="true" aria-label="Loading" />
      ) : !plan ? (
        <section className="card card--hero card--glow">
          <div className="empty" style={{ padding: 'var(--s-6) var(--s-2)' }}>
            <span className="icon-btn" style={{ width: 64, height: 64, background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
              <Icon name="cart" size={30} />
            </span>
            <h2 className="title2">Plan your week</h2>
            <p className="sub" style={{ maxWidth: 300 }}>
              Pick one option per meal. The app checks your numbers, fixes any gaps and builds your grocery list.
            </p>
            <button className="btn btn--primary btn--block" onClick={() => setPlanning(true)}>
              Plan my week
            </button>
            <p className="caption">Takes about 2 minutes.</p>
          </div>
        </section>
      ) : (
        <>
          <ol className="stack gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {meals.map((m) => (
              <MealRow
                key={`${m.slot}-${m.mealId}`}
                meal={m}
                portion={plan.portion}
                isNext={upNext === m}
                onLog={async () => {
                  await logPlanned(date, m)
                  haptic.success()
                }}
                onUndo={() => m.entry && removeEntry(m.entry.id)}
                onOther={() =>
                  setOther({ slot: m.slot, replacesMealId: m.mealId, replacing: m.name })
                }
              />
            ))}
          </ol>

          {unplanned.length > 0 && (
            <section className="card" style={{ padding: 'var(--s-2) var(--s-4)' }} aria-label="Also logged">
              <h2 className="eyebrow" style={{ padding: 'var(--s-2) 0 0' }}>
                Also logged
              </h2>
              {unplanned.map((e) => (
                <div key={e.id} className="g-row">
                  <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{e.name}</span>
                    <span className="caption num">
                      {e.servings !== 1 && `${e.servings}× · `}
                      {e.protein} g protein · {e.cal} cal
                    </span>
                  </div>
                  <button className="link-btn" onClick={() => removeEntry(e.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </section>
          )}

          <button className="btn btn--secondary btn--block" onClick={() => setOther({ slot: 'other' })}>
            <Icon name="plus" size={18} /> Log other food
          </button>
          <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setPlanning(true)}>
            Replan this week
          </button>
        </>
      )}

      <Sheet open={planning} onClose={() => setPlanning(false)} title="Plan your week" full bare>
        <Planner profile={profile} previous={latest ?? null} onClose={() => setPlanning(false)} />
      </Sheet>

      <Sheet open={groceries} onClose={() => setGroceries(false)} title="Grocery list">
        {plan && <GroceryListView plan={plan} />}
      </Sheet>

      <Sheet open={!!other} onClose={() => setOther(null)} title="Ate something else">
        {other && <AteSomethingElse date={date} target={other} onDone={() => setOther(null)} />}
      </Sheet>
    </main>
  )
}

function MealRow({
  meal,
  isNext,
  onLog,
  onUndo,
  onOther,
  portion,
}: {
  meal: PlannedMeal
  portion: number
  isNext: boolean
  onLog: () => void
  onUndo: () => void
  onOther: () => void
}) {
  const e = meal.entry
  const replaced = e && !e.planned
  const label = meal.slot === 'extra' ? 'Extra' : slotMeta[meal.slot].label
  const [open, setOpen] = useState(false)

  return (
    <motion.li
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className={`card ${isNext ? 'card--hero card--glow' : ''}`}
      style={{
        padding: isNext ? 'var(--s-5)' : 'var(--s-4)',
        opacity: e ? 0.78 : 1,
        outline: isNext ? '2px solid var(--accent)' : undefined,
        outlineOffset: -2,
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <span className="caption" style={{ fontWeight: 600, color: isNext ? 'var(--accent)' : undefined }}>
            {isNext ? 'Up next · ' : ''}
            {label} · {meal.time}
          </span>
          <button
            className={isNext ? 'title2' : 'title3'}
            style={{ textAlign: 'left', textDecoration: replaced ? 'line-through' : undefined, color: replaced ? 'var(--text-3)' : undefined }}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {meal.name}
          </button>
          {replaced ? (
            <span className="sub">
              Had {e.name} · {e.protein} g · {e.cal} cal
            </span>
          ) : (
            <span className="caption num">
              {meal.macros.protein} g protein · {meal.macros.cal} cal
            </span>
          )}
        </div>
        {e ? (
          <button className="row" style={{ gap: 6 }} onClick={onUndo} aria-label={`Undo ${meal.name}`}>
            <span className="icon-btn" style={{ width: 36, height: 36, background: 'var(--accent-fill)', color: '#fff' }} aria-hidden>
              <Icon name="check" size={18} strokeWidth={3} />
            </span>
          </button>
        ) : !isNext ? (
          <button className="btn btn--secondary btn--sm" onClick={onLog}>
            Log it
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {open && mealsById[meal.mealId] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div className="card" style={{ marginTop: "var(--s-3)", padding: "var(--s-3) var(--s-4)", background: "var(--surface-strong)", boxShadow: "none" }}>
              <MealBuild meal={mealsById[meal.mealId]} portion={portion} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isNext && !e && (
        <button className="btn btn--primary btn--block" style={{ marginTop: 'var(--s-4)' }} onClick={onLog}>
          <Icon name="check" size={18} strokeWidth={2.6} /> Log it
        </button>
      )}
      <div className="row" style={{ gap: 'var(--s-4)', marginTop: isNext ? 'var(--s-1)' : 0 }}>
        <button className="link-btn" style={{ paddingLeft: 0 }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide recipe' : 'How to make it'}
        </button>
        {!e && (
          <button className="link-btn" style={{ paddingLeft: 0, color: 'var(--text-2)' }} onClick={onOther}>
            Ate something else
          </button>
        )}
      </div>
    </motion.li>
  )
}
