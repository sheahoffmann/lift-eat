// "Check my week": what changed (after scanning labels), the day vs. your goals,
// your macro split, a plain verdict, and a one-tap fix if anything is off.
import type { WeekPlan } from '../../lib/db'
import { macroTargets, type Profile } from '../../lib/profile'
import { planDay, splitOf, verdict, type MealChange } from '../../lib/weekReview'
import { Icon } from '../../components/Icon'
import { RebalanceCard } from './Rebalance'

export function WeekReview({ plan, profile, changes }: { plan: WeekPlan; profile: Profile; changes?: MealChange[] }) {
  const goals = macroTargets(profile)
  const day = planDay(plan.picks, plan.portion)
  const split = splitOf(day)
  const goalSplit = splitOf({ cal: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat })
  const v = verdict(day, goals)
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)

  return (
    <div className="stack gap-4">
      {changes && (
        <section className="stack gap-2" aria-label="What changed">
          <span className="eyebrow">What changed in your meals</span>
          {changes.length === 0 ? (
            <p className="sub">None of this week's meals use those products, so your numbers didn't change.</p>
          ) : (
            <div className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
              {changes.map((c) => (
                <div key={c.id} className="g-row" style={{ minHeight: 52 }}>
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span className="caption num">
                      {c.before.protein} → <strong style={{ color: 'var(--text)' }}>{c.after.protein} g</strong> protein · {c.before.cal} → <strong style={{ color: 'var(--text)' }}>{c.after.cal}</strong> cal
                    </span>
                  </div>
                  <span className={`pill-sm ${c.after.protein >= c.before.protein ? 'pill-sm--accent' : ''}`}>{sign(c.after.protein - c.before.protein)} g</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="stack gap-2" aria-label="Your day vs. your goals">
        <span className="eyebrow">A day on this plan vs. your goals</span>
        <div className="card" style={{ padding: 'var(--s-2) var(--s-4)' }}>
          <div className="set-grid--head" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px', gap: 8, padding: '6px 0' }}>
            <span />
            <span className="caption" style={{ textAlign: 'right' }}>Plan</span>
            <span className="caption" style={{ textAlign: 'right' }}>Goal</span>
            <span className="caption" style={{ textAlign: 'right' }}>±</span>
          </div>
          {(
            [
              ['Calories', day.cal, goals.calories, ''],
              ['Protein', day.protein, goals.protein, ' g'],
              ['Carbs', day.carbs, goals.carbs, ' g'],
              ['Fat', day.fat, goals.fat, ' g'],
            ] as const
          ).map(([label, got, goal, unit]) => (
            <div key={label} className="num" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px', gap: 8, padding: '8px 0', borderTop: '1px solid var(--hairline)' }}>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ textAlign: 'right', fontWeight: 700 }}>
                {got.toLocaleString()}
                {unit}
              </span>
              <span className="caption" style={{ textAlign: 'right', alignSelf: 'center' }}>
                {goal.toLocaleString()}
                {unit}
              </span>
              <span className="caption" style={{ textAlign: 'right', alignSelf: 'center' }}>
                {sign(got - goal)}
              </span>
            </div>
          ))}
          <div className="caption num" style={{ padding: '8px 0', borderTop: '1px solid var(--hairline)' }}>
            Split: <strong style={{ color: 'var(--text)' }}>
              {split.protein} / {split.carbs} / {split.fat}
            </strong>{' '}
            (protein / carbs / fat) · goal {goalSplit.protein} / {goalSplit.carbs} / {goalSplit.fat}
          </div>
        </div>
      </section>

      <section className="stack gap-2" aria-label="Verdict">
        <span className="title3">{v.ok ? 'Your plan fits your goals ✓' : 'Your plan needs a tweak'}</span>
        <ul className="stack gap-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {v.lines.map((l, i) => (
            <li key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span style={{ flex: 'none', marginTop: 2, color: l.tone === 'good' ? 'var(--accent)' : 'var(--text-2)' }}>
                <Icon name={l.tone === 'good' ? 'check' : 'bolt'} size={15} strokeWidth={l.tone === 'good' ? 3 : 2} />
              </span>
              <span className="sub" style={{ color: 'var(--text)' }}>
                {l.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!v.ok && <RebalanceCard plan={plan} profile={profile} />}
      <p className="caption">Assumes you eat each meal as written. Anything extra you log with "Ate something else" counts on the day itself.</p>
    </div>
  )
}
