// Log food that wasn't on the plan: pick from My Foods or quick-add numbers.
// Everything entered is saved to My Foods so repeats are one tap.
import { useState } from 'react'
import type { Slot } from '../../data/meals'
import type { MyFood } from '../../lib/db'
import { logOther, useMyFoods } from '../../lib/eatStore'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { BarcodeScan } from './BarcodeScan'

type Target = { slot: Slot | 'extra' | 'other'; replacesMealId?: string; replacing?: string }

export function AteSomethingElse({ date, target, onDone }: { date: string; target: Target; onDone: () => void }) {
  const foods = useMyFoods()
  const [tab, setTab] = useState<'mine' | 'quick' | 'scan'>(foods && foods.length === 0 ? 'quick' : 'mine')
  const [chosen, setChosen] = useState<MyFood | null>(null)
  const [servings, setServings] = useState(1)
  const [form, setForm] = useState({ name: '', cal: '', protein: '', carbs: '', fat: '' })

  const effectiveTab = foods && foods.length === 0 && tab === 'mine' ? 'quick' : tab

  async function logMine() {
    if (!chosen) return
    await logOther({
      date,
      slot: target.slot,
      replacesMealId: target.replacesMealId,
      food: chosen,
      servings,
      myFoodId: chosen.id,
    })
    haptic.success()
    onDone()
  }

  const n = (s: string) => (s === '' ? 0 : Number(s))
  const quickValid = form.name.trim() !== '' && form.cal !== '' && n(form.cal) >= 0 && n(form.cal) < 5000

  async function logQuick() {
    if (!quickValid) return
    await logOther({
      date,
      slot: target.slot,
      replacesMealId: target.replacesMealId,
      food: {
        name: form.name,
        servingLabel: '1 serving',
        cal: n(form.cal),
        protein: n(form.protein),
        carbs: n(form.carbs),
        fat: n(form.fat),
      },
      servings: 1,
    })
    haptic.success()
    onDone()
  }

  return (
    <div className="stack gap-4">
      {target.replacing && (
        <p className="sub">
          Instead of <strong style={{ color: 'var(--text)' }}>{target.replacing}</strong>. No problem, your plan stays the same for tomorrow.
        </p>
      )}

      <div className="segmented" role="tablist">
        {(
          [
            ['mine', 'My foods'],
            ['quick', 'Quick add'],
            ['scan', 'Scan'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-checked={effectiveTab === k} aria-selected={effectiveTab === k} onClick={() => setTab(k)}>
            {effectiveTab === k && <span className="segmented__pill" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {effectiveTab === 'mine' && (
        <div className="stack gap-2">
          {foods?.map((f) => {
            const sel = chosen?.id === f.id
            return (
              <button
                key={f.id}
                className="option"
                aria-pressed={sel}
                onClick={() => {
                  haptic.light()
                  setChosen(sel ? null : f)
                  setServings(1)
                }}
                style={{ padding: 'var(--s-3) var(--s-4)' }}
              >
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className="caption num">
                    {f.servingLabel} · {f.protein} g protein · {f.cal} cal
                  </span>
                </div>
                <span className={`check-dot ${sel ? 'check-dot--on' : ''}`} aria-hidden>
                  {sel && <Icon name="check" size={15} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
          {chosen && (
            <div className="card stack gap-3" style={{ padding: 'var(--s-4)' }}>
              <div className="card-row">
                <span style={{ fontWeight: 600 }}>How much did you eat?</span>
                <div className="row" style={{ gap: 'var(--s-2)' }}>
                  <button className="icon-btn" aria-label="Less" onClick={() => setServings((s) => Math.max(0.5, s - 0.5))}>
                    −
                  </button>
                  <span className="num" style={{ minWidth: 44, textAlign: 'center', fontWeight: 700 }} aria-live="polite">
                    {servings}×
                  </span>
                  <button className="icon-btn" aria-label="More" onClick={() => setServings((s) => Math.min(10, s + 0.5))}>
                    +
                  </button>
                </div>
              </div>
              <span className="caption num">
                {Math.round(chosen.protein * servings)} g protein · {Math.round(chosen.cal * servings)} cal
              </span>
              <button className="btn btn--primary btn--block" onClick={logMine}>
                Log it
              </button>
            </div>
          )}
        </div>
      )}

      {effectiveTab === 'quick' && (
        <form
          className="stack gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            logQuick()
          }}
        >
          <Field label="What was it?" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Turkey sandwich" />
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <Field label="Calories" numeric value={form.cal} onChange={(v) => setForm({ ...form, cal: v })} />
            <Field label="Protein (g)" numeric value={form.protein} onChange={(v) => setForm({ ...form, protein: v })} />
          </div>
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <Field label="Carbs (g)" numeric optional value={form.carbs} onChange={(v) => setForm({ ...form, carbs: v })} />
            <Field label="Fat (g)" numeric optional value={form.fat} onChange={(v) => setForm({ ...form, fat: v })} />
          </div>
          <button className="btn btn--primary btn--block" disabled={!quickValid} type="submit">
            Log it
          </button>
          <p className="caption" style={{ textAlign: 'center' }}>
            Saved to My foods, so next time it's one tap.
          </p>
        </form>
      )}

      {effectiveTab === 'scan' && <BarcodeScan date={date} target={target} onDone={onDone} />}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  optional,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  numeric?: boolean
  optional?: boolean
}) {
  return (
    <label className="stack gap-1" style={{ flex: 1, minWidth: 0 }}>
      <span className="caption" style={{ fontWeight: 600 }}>
        {label}
        {optional && <span style={{ fontWeight: 400 }}> · optional</span>}
      </span>
      <input
        className="field num"
        value={value}
        placeholder={placeholder}
        inputMode={numeric ? 'decimal' : undefined}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)}
      />
    </label>
  )
}
