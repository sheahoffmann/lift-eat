// Daily macro goals: everything logged today counts toward each one.
import { motion } from 'motion/react'
import type { MacroTargets } from '../lib/profile'
import type { Macros } from '../lib/nutrition'
import { Icon } from './Icon'

const rows = [
  { key: 'calories', label: 'Calories', unit: '', color: 'var(--ring-fuel)' },
  { key: 'protein', label: 'Protein', unit: 'g', color: 'var(--accent)' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: 'var(--ring-log)' },
  { key: 'fat', label: 'Fat', unit: 'g', color: 'var(--text-2)' },
] as const

export function MacroGoals({ eaten, targets, calorieRange, bare = false }: { eaten: Macros; targets: MacroTargets; calorieRange?: [number, number]; bare?: boolean }) {
  const Wrap = bare ? "div" : "section"
  return (
    <Wrap className={bare ? "stack gap-3" : "card stack gap-3"} aria-label="Today's macros">
      <div className="card-row">
        {!bare && <span className="title3">Today's goals</span>}
        {calorieRange && (
          <span className="caption num">
            Range {calorieRange[0].toLocaleString()}–{calorieRange[1].toLocaleString()} cal
          </span>
        )}
      </div>
      {rows.map((r) => {
        const v = Math.round(r.key === 'calories' ? eaten.cal : eaten[r.key])
        const t = targets[r.key]
        const left = t - v
        const pct = t > 0 ? Math.min(1, v / t) : 0
        const hit = r.key === 'protein' ? v >= t - 5 : r.key === 'calories' && calorieRange ? v >= calorieRange[0] && v <= calorieRange[1] : false
        return (
          <div key={r.key} className="stack" style={{ gap: 5 }}>
            <div className="card-row" style={{ alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--fs-sub)' }}>
                {r.label} {hit && <Icon name="check" size={12} strokeWidth={3} className="accent" />}
              </span>
              <span className="num" style={{ fontSize: 'var(--fs-sub)' }}>
                <strong>{v.toLocaleString()}</strong>
                <span className="muted">
                  {' '}
                  / {t.toLocaleString()}
                  {r.unit}
                </span>
                <span className="caption" style={{ marginLeft: 8 }}>
                  {left >= 0 ? `${left.toLocaleString()}${r.unit} left` : `${(-left).toLocaleString()}${r.unit} over`}
                </span>
              </span>
            </div>
            <div className="bar" role="meter" aria-label={r.label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={t}>
              <motion.div
                className="bar__fill"
                style={{ background: r.color, boxShadow: r.key === 'protein' ? undefined : 'none' }}
                animate={{ scaleX: Math.max(0.01, pct) }}
                transition={{ type: 'spring', stiffness: 90, damping: 18 }}
              />
            </div>
          </div>
        )
      })}
    </Wrap>
  )
}
