// "How to make it": exact ingredients (kitchen units, scaled to the person) + steps.
import type { MealOption } from '../data/meals'
import { buildLines } from '../lib/kitchen'

export function MealBuild({ meal, portion }: { meal: MealOption; portion: number }) {
  const lines = buildLines(meal, portion)
  const tips = [...new Set(lines.map((l) => l.tip).filter(Boolean))] as string[]
  return (
    <div className="stack gap-3">
      <div className="stack gap-2">
        <span className="eyebrow">{meal.restaurant ? 'What to order' : 'What you need'}</span>
        <ul className="stack" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 6 }}>
          {lines.map((l, i) => (
            <li key={i} className="row" style={{ gap: 10, alignItems: 'baseline' }}>
              <span className="num" style={{ fontWeight: 700, minWidth: 64, color: 'var(--accent)' }}>
                {l.amount}
              </span>
              <span style={{ flex: 1 }}>
                {l.item}
                {l.detail && <span className="caption"> · {l.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {!meal.restaurant && meal.steps.length > 0 && !meal.custom && (
        <div className="stack gap-2">
          <span className="eyebrow">How to make it{meal.minutes ? ` · ${meal.minutes} min` : ''}</span>
          <ol className="stack sub" style={{ margin: 0, paddingLeft: '1.2em', gap: 4, color: 'var(--text)' }}>
            {meal.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}
      {tips.length > 0 && (
        <p className="caption" style={{ margin: 0 }}>
          Tip: {tips.join(' ')}
        </p>
      )}
    </div>
  )
}
