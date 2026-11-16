// Eat tab: if this week's plan misses your goals (with your real label numbers),
// the app adjusts portions in your meals to fix it (one tap). Swapping meals is the fallback.
import { useMemo, useState } from 'react'
import { db, type WeekPlan } from '../../lib/db'
import { macroTargets, settingsOf, type Profile } from '../../lib/profile'
import { describeGap } from '../../lib/nutrition'
import { rebalancePlan } from '../../lib/rebalance'
import { amountText, applyTuning, tunePlan, type TuneResult } from '../../lib/tune'
import { myLabels, myLabelsOn } from '../../data/myLabels'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { FixCard } from './Planner'

/** Proposed portion changes, grouped by meal, with the before → after day and an Apply button. */
export function TuneCard({ plan, result, onApplied }: { plan: WeekPlan; result: TuneResult; onApplied?: () => void }) {
  const [busy, setBusy] = useState(false)
  const byMeal = new Map<string, typeof result.changes>()
  for (const c of result.changes) byMeal.set(c.mealName, [...(byMeal.get(c.mealName) ?? []), c])
  const b = result.before
  const a = result.after
  return (
    <div className="card stack gap-3" style={{ padding: 'var(--s-4)' }}>
      <div className="row" style={{ gap: 8 }}>
        <Icon name="wand" size={18} className="accent" />
        <span style={{ fontWeight: 700 }}>Adjust portions</span>
        <span className="spacer" />
        <span className="pill-sm pill-sm--accent">Same meals</span>
      </div>
      {[...byMeal.entries()].map(([meal, cs]) => (
        <div key={meal} className="stack" style={{ gap: 2 }}>
          <span style={{ fontWeight: 600 }}>{meal}</span>
          {cs.map((c) => (
            <span key={c.item} className="caption num">
              {c.itemName}: <strong style={{ color: 'var(--text)' }}>{amountText(c)}</strong>
            </span>
          ))}
        </div>
      ))}
      <div className="caption num" style={{ borderTop: '1px solid var(--hairline)', paddingTop: 'var(--s-2)' }}>
        Day: {b.cal.toLocaleString()} → <strong style={{ color: 'var(--text)' }}>{a.cal.toLocaleString()} cal</strong> · {b.protein} → <strong style={{ color: 'var(--text)' }}>{a.protein} g</strong> protein · {b.carbs} → {a.carbs} g carbs · {b.fat} → {a.fat} g fat
      </div>
      <button
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await applyTuning(plan, result)
          haptic.celebrate()
          onApplied?.()
        }}
      >
        <Icon name="check" size={18} strokeWidth={2.6} /> Apply portions
      </button>
      <p className="caption">Recipes, macros and the grocery list update for this week only. Reset any time in Check my week.</p>
    </div>
  )
}

export function RebalanceCard({ plan, profile }: { plan: WeekPlan; profile: Profile }) {
  const labelsOn = myLabelsOn(profile.program, settingsOf(profile).myLabels)
  const [swaps, setSwaps] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const goals = macroTargets(profile)
  const key = JSON.stringify([plan.picks, plan.tuned, plan.portion, goals, labelsOn, settingsOf(profile).scannedLabels])
  const { result, tune } = useMemo(() => {
    const result = rebalancePlan(plan, { calories: goals.calories, protein: goals.protein }, labelsOn ? Object.keys(myLabels) : [])
    return { result, tune: result ? tunePlan(plan, goals) : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!result || dismissedFor === key) return null
  const { check, fixes, onHand } = result

  return (
    <section className="card card--glow stack gap-3" aria-label="Balance your macros">
      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
        <span className="icon-btn" style={{ width: 40, height: 40, flex: 'none', background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
          <Icon name="wand" size={20} />
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <span className="title3">Balance your macros</span>
          <span className="sub">
            {labelsOn || Object.keys(settingsOf(profile).scannedLabels ?? {}).length ? 'With your real label numbers, this week runs ' : 'This week runs '}
            {describeGap(check)}.
          </span>
        </div>
      </div>

      {tune && !swaps && <TuneCard plan={plan} result={tune} />}

      {(swaps || !tune) &&
        (fixes.length === 0 ? (
          <p className="caption">No simple swap fixes it. Try Replan this week.</p>
        ) : (
          <>
            <p className="caption">{onHand ? 'Or swap meals, using only food you already have:' : 'Or swap meals (needs something new from the store):'}</p>
            {fixes.slice(0, 2).map((f, i) => (
              <FixCard
                key={i}
                fix={f}
                onApply={async () => {
                  await db.plans.update(plan.id, { picks: f.picks, calorieTarget: profile.calorieTarget, proteinTarget: profile.proteinTarget })
                  haptic.celebrate()
                }}
              />
            ))}
          </>
        ))}

      <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-4)' }}>
        {tune && fixes.length > 0 && (
          <button className="link-btn" onClick={() => setSwaps(!swaps)}>
            {swaps ? 'Adjust portions instead' : 'Prefer swapping meals?'}
          </button>
        )}
        <button className="link-btn" style={{ color: 'var(--text-2)' }} onClick={() => setDismissedFor(key)}>
          Not now
        </button>
      </div>
    </section>
  )
}
