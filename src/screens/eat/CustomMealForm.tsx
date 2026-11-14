// "Add your own" planner option: name, macros (typed or read from a label/link), and what to buy.
import { useState } from 'react'
import type { CustomMeal } from '../../lib/db'
import { slotMeta, type Slot } from '../../data/meals'
import { saveCustomMeal } from '../../lib/customMeals'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { NutritionReader } from './PhotoOrLink'

type Line = { name: string; amount: string; unit: string }

export function CustomMealForm({ slot, existing, onSaved }: { slot: Slot; existing?: CustomMeal; onSaved: (m: CustomMeal) => void }) {
  const [name, setName] = useState(existing?.name ?? '')
  const [desc, setDesc] = useState(existing?.desc ?? '')
  const [m, setM] = useState({
    cal: existing ? String(existing.cal) : '',
    protein: existing ? String(existing.protein) : '',
    carbs: existing ? String(existing.carbs) : '',
    fat: existing ? String(existing.fat) : '',
  })
  const [lines, setLines] = useState<Line[]>(
    existing?.groceries.map((g) => ({ name: g.name, amount: String(g.amount), unit: g.unit })) ?? [{ name: '', amount: '', unit: '' }],
  )
  const [showReader, setShowReader] = useState(false)
  const n = (s: string) => Number(s) || 0
  const valid = name.trim() !== '' && m.cal !== '' && m.protein !== ''

  async function save() {
    if (!valid) return
    const meal = await saveCustomMeal({
      id: existing?.id,
      slot,
      name: name.trim(),
      desc: desc.trim(),
      cal: Math.round(n(m.cal)),
      protein: Math.round(n(m.protein)),
      carbs: Math.round(n(m.carbs)),
      fat: Math.round(n(m.fat)),
      groceries: lines.filter((l) => l.name.trim() && n(l.amount) > 0).map((l) => ({ name: l.name.trim(), amount: n(l.amount), unit: l.unit.trim() || 'servings' })),
    })
    haptic.success()
    onSaved(meal)
  }

  return (
    <div className="stack gap-4">
      <p className="sub">Add your own {slotMeta[slot].label.toLowerCase()} option. It works like any other: it counts toward your totals and its items go on the grocery list.</p>

      <label className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>Name</span>
        <input className="field" placeholder="e.g. Protein shake with whole milk" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>Short description · optional</span>
        <input className="field" placeholder="e.g. 2 scoops whey + 16 oz whole milk" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>

      <section className="card stack gap-3">
        <div className="card-row">
          <span style={{ fontWeight: 600 }}>Macros per serving</span>
          <button className="link-btn" style={{ minHeight: 0, padding: 0 }} onClick={() => setShowReader((s) => !s)}>
            <Icon name="sparkle" size={13} /> {showReader ? 'Hide' : 'Fill from photo or link'}
          </button>
        </div>
        {showReader && (
          <NutritionReader
            onResult={(r) => {
              if (!name.trim()) setName(r.name)
              setM({ cal: String(Math.round(r.calories)), protein: String(Math.round(r.protein)), carbs: String(Math.round(r.carbs)), fat: String(Math.round(r.fat)) })
              setShowReader(false)
            }}
          />
        )}
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {(['cal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <label key={k} className="stack gap-1" style={{ flex: 1, minWidth: 0 }}>
              <span className="caption" style={{ fontWeight: 600 }}>
                {k === 'cal' ? 'Calories' : `${k[0].toUpperCase()}${k.slice(1)} g`}
              </span>
              <input className="field num" style={{ padding: '0 8px', textAlign: 'center' }} inputMode="decimal" value={m[k]} aria-label={k === "cal" ? "Calories" : k} onChange={(e) => setM({ ...m, [k]: e.target.value.replace(/[^0-9.]/g, '') })} />
            </label>
          ))}
        </div>
      </section>

      <section className="card stack gap-2">
        <span style={{ fontWeight: 600 }}>What to buy (per serving)</span>
        <span className="caption">The grocery list multiplies these by how many times you'll have it that week.</span>
        {lines.map((l, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input className="field" style={{ flex: 2, minWidth: 0 }} placeholder="Item, e.g. Whole milk" value={l.name} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Item" />
            <input className="field num" style={{ flex: 0.8, minWidth: 0, padding: '0 8px', textAlign: 'center' }} inputMode="decimal" placeholder="16" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, '') } : x)))} aria-label="Amount" />
            <input className="field" style={{ flex: 1, minWidth: 0, padding: '0 8px' }} placeholder="oz" value={l.unit} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} aria-label="Unit" />
          </div>
        ))}
        <button className="link-btn" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setLines([...lines, { name: '', amount: '', unit: '' }])}>
          <Icon name="plus" size={13} /> Add item
        </button>
      </section>

      <button className="btn btn--primary btn--block" disabled={!valid} onClick={save}>
        <Icon name="check" size={18} strokeWidth={2.6} /> {existing ? 'Save changes' : 'Add and pick it'}
      </button>
      {!valid && <p className="caption" style={{ textAlign: 'center' }}>Name, calories and protein are required.</p>}
    </div>
  )
}
