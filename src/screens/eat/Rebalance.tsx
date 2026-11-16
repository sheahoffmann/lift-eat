// Eat tab: if this week's plan misses your targets (with your real label numbers),
// propose the fewest swaps that fix it, using food you already have. One tap applies.
import { useMemo, useState } from 'react'
import { db, type WeekPlan } from '../../lib/db'
import { settingsOf, type Profile } from '../../lib/profile'
import { describeGap } from '../../lib/nutrition'
import { rebalancePlan } from '../../lib/rebalance'
import { myLabels, myLabelsOn } from '../../data/myLabels'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { FixCard } from './Planner'

export function RebalanceCard({ plan, profile }: { plan: WeekPlan; profile: Profile }) {
  const labelsOn = myLabelsOn(profile.program, settingsOf(profile).myLabels)
  const [more, setMore] = useState(false)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const key = JSON.stringify([plan.picks, plan.portion, profile.calorieTarget, profile.proteinTarget, labelsOn])
  const result = useMemo(
    () => rebalancePlan(plan, { calories: profile.calorieTarget, protein: profile.proteinTarget }, labelsOn ? Object.keys(myLabels) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
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
            {labelsOn ? 'With your real label numbers, this week runs ' : 'This week runs '}
            {describeGap(check)}.
          </span>
        </div>
      </div>

      {fixes.length === 0 ? (
        <p className="caption">No simple swap fixes it. Try Replan this week, or add a protein extra.</p>
      ) : (
        <>
          <p className="caption">{onHand ? 'Using only food you already have this week:' : "Nothing you already have fixes it. This needs something new from the store:"}</p>
          {(more ? fixes : fixes.slice(0, 1)).map((f, i) => (
            <FixCard
              key={i}
              fix={f}
              onApply={async () => {
                await db.plans.update(plan.id, { picks: f.picks, calorieTarget: profile.calorieTarget, proteinTarget: profile.proteinTarget })
                haptic.celebrate()
              }}
            />
          ))}
          <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-4)' }}>
            {fixes.length > 1 && (
              <button className="link-btn" onClick={() => setMore(!more)}>
                {more ? 'Show fewer' : `${fixes.length - 1} other option${fixes.length > 2 ? 's' : ''}`}
              </button>
            )}
            <button className="link-btn" style={{ color: 'var(--text-2)' }} onClick={() => setDismissedFor(key)}>
              Not now
            </button>
          </div>
        </>
      )}
    </section>
  )
}
