// Checkable grocery list, grouped by store section, with a mid-week top-up and share.
import type { WeekPlan } from '../../lib/db'
import { sectionOrder } from '../../data/groceryItems'
import { buildGroceryList, listAsText, needText, packText, type GroceryLine } from '../../lib/grocery'
import { addDays, markShopped, toggleChecked } from '../../lib/eatStore'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

const weekday = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' })

/** How much of this week's list is checked off. */
export function groceryProgress(plan: WeekPlan) {
  const list = buildGroceryList(plan.picks, plan.portion, plan.pantryHave)
  const all = [...Object.values(list.shop).flat(), ...list.topup]
  const done = all.filter((l) => plan.checked.includes(l.key)).length
  return { done, total: all.length, left: all.length - done }
}

/** Grocery card on Eat. Leave the list and come back any time; tap Complete when you've shopped to hide it. */
export function GroceryCard({ plan, onOpen }: { plan: WeekPlan; onOpen: () => void }) {
  const { done, total, left } = groceryProgress(plan)
  const all = left === 0
  return (
    <section className="card card-row" style={{ padding: 'var(--s-3) var(--s-4)', gap: 'var(--s-3)' }} aria-label="Grocery list">
      <button className="row" onClick={onOpen} style={{ flex: 1, minWidth: 0, gap: 'var(--s-3)', textAlign: 'left' }} aria-label={`Open grocery list: ${done} of ${total} checked`}>
        <span className="icon-btn" style={{ width: 40, height: 40, flex: 'none', background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
          <Icon name="cart" size={20} />
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <span style={{ fontWeight: 650 }}>Grocery list</span>
          <span className="caption num">{all ? 'Everything checked' : done === 0 ? `${total} items · tap to open` : `${left} left · ${done} of ${total} in the cart`}</span>
          {done > 0 && (
            <div className="bar" style={{ height: 4 }}>
              <div className="bar__fill" style={{ transform: `scaleX(${done / total})` }} />
            </div>
          )}
        </div>
      </button>
      <button
        className={`btn btn--sm ${all ? 'btn--primary' : 'btn--secondary'}`}
        style={{ minHeight: 36, padding: '0 14px', flex: 'none' }}
        onClick={() => {
          haptic.success()
          markShopped(plan, true)
        }}
      >
        Complete
      </button>
    </section>
  )
}

export function GroceryListView({ plan }: { plan: WeekPlan }) {
  const list = buildGroceryList(plan.picks, plan.portion, plan.pantryHave)
  const topupLabel = weekday(addDays(plan.startDate, list.topupDay))
  const all = [...Object.values(list.shop).flat(), ...list.topup]
  const done = all.filter((l) => plan.checked.includes(l.key)).length

  async function share() {
    haptic.light()
    const text = listAsText(list, 'GRIT grocery list', topupLabel)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Grocery list', text })
        return
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
    // No share sheet (e.g. not on HTTPS yet): open Messages with the list.
    window.location.href = `sms:&body=${encodeURIComponent(text)}`
  }

  const Row = ({ line }: { line: GroceryLine }) => {
    const checked = plan.checked.includes(line.key)
    const perishable = line.item.shelfDays < 7
    return (
      <button
        className={`g-row ${checked ? 'g-row--done' : ''}`}
        role="checkbox"
        aria-checked={checked}
        onClick={() => {
          haptic.light()
          toggleChecked(plan, line.key)
        }}
      >
        <span className="g-box" aria-hidden>
          {checked && <Icon name="check" size={14} strokeWidth={3} />}
        </span>
        <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <span className="g-row__name" style={{ fontWeight: 600 }}>
            {line.item.name}
          </span>
          <span className="caption">
            {packText(line)}
            {needText(line) && ` · ${needText(line)}`}
          </span>
        </div>
        {perishable && <Icon name="leaf" size={16} className="accent" label="Perishable" />}
        {line.item.frozen && <Icon name="snow" size={16} className="muted" label="Frozen" />}
      </button>
    )
  }

  return (
    <div className="stack gap-4">
      <div className="card-row">
        <span className="caption num">
          {done} of {all.length} in the cart
        </span>
        <button className="btn btn--secondary btn--sm" onClick={share}>
          <Icon name="share" size={16} /> Share list
        </button>
      </div>

      {sectionOrder.map((s) =>
        list.shop[s].length ? (
          <section key={s} className="card" style={{ padding: 'var(--s-3) var(--s-4)' }} aria-label={s}>
            <h3 className="eyebrow" style={{ marginBottom: 2 }}>
              {s}
            </h3>
            {list.shop[s].map((l) => (
              <Row key={l.key} line={l} />
            ))}
          </section>
        ) : null,
      )}

      {list.topup.length > 0 && (
        <section className="card card--glow" style={{ padding: 'var(--s-3) var(--s-4)' }} aria-label="Mid-week top-up">
          <div className="row" style={{ gap: 8 }}>
            <Icon name="leaf" size={16} className="accent" />
            <h3 className="eyebrow">Mid-week top-up · {topupLabel}</h3>
          </div>
          <p className="caption" style={{ margin: '4px 0 2px' }}>
            These won't last 7 days, so grab the rest fresh.
          </p>
          {list.topup.map((l) => (
            <Row key={l.key} line={l} />
          ))}
        </section>
      )}

      {(list.restaurantMeals.length > 0 || list.skipped.length > 0) && (
        <div className="stack gap-1">
          {list.restaurantMeals.length > 0 && (
            <p className="caption">
              <Icon name="store" size={13} /> Not on the list: {list.restaurantMeals.join(', ')} (order out).
            </p>
          )}
          {list.skipped.length > 0 && (
            <p className="caption">Already in your kitchen: {list.skipped.map((s) => s.name).join(', ')}.</p>
          )}
        </div>
      )}
    </div>
  )
}
