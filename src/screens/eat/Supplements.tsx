// Daily supplements checklist on the Eat tab. Tap to check off; edit the list any time.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../../lib/db'
import { settingsOf, updateSettings, type Profile, type Supplement } from '../../lib/profile'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'

async function toggle(date: string, s: Supplement, on: boolean) {
  const id = `${date}:${s.id}`
  const foodId = `supp:${id}`
  if (on) {
    await db.supplementLog.delete(id)
    await db.foodLog.delete(foodId)
  } else {
    await db.supplementLog.put({ id, date, suppId: s.id, at: new Date().toISOString() })
    if (s.cal > 0 || s.protein > 0) {
      await db.foodLog.put({ id: foodId, date, slot: 'other', planned: false, name: `${s.name} (${s.dose})`, servings: 1, cal: s.cal, protein: s.protein, carbs: 0, fat: 0, createdAt: new Date().toISOString() })
    }
  }
}

export function SupplementsCard({ profile, date }: { profile: Profile; date: string }) {
  const list = settingsOf(profile).supplements
  const taken = useLiveQuery(() => db.supplementLog.where('date').equals(date).toArray(), [date], [])
  const [editing, setEditing] = useState(false)
  const done = new Set(taken.map((t) => t.suppId))

  return (
    <section className="card stack gap-2" aria-label="Supplements">
      <div className="card-row">
        <span className="title3">Supplements</span>
        <button className="link-btn" style={{ minHeight: 32, padding: 0 }} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      {list.length === 0 ? (
        <p className="sub">No supplements yet. Tap Edit to add creatine, vitamins, fish oil, etc.</p>
      ) : (
        list.map((s) => {
          const on = done.has(s.id)
          return (
            <button
              key={s.id}
              className="g-row"
              role="checkbox"
              aria-checked={on}
              onClick={async () => {
                haptic.success()
                await toggle(date, s, on)
              }}
            >
              <span className={`check-dot ${on ? 'check-dot--on' : ''}`} aria-hidden>
                {on && <Icon name="check" size={15} strokeWidth={3} />}
              </span>
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <span style={{ fontWeight: 600, textDecoration: on ? 'line-through' : undefined, color: on ? 'var(--text-3)' : undefined }}>
                  {s.name}
                </span>
                <span className="caption">
                  {s.dose}
                  {s.timing && ` · ${s.timing}`}
                  {(s.cal > 0 || s.protein > 0) && ` · ${s.protein} g protein, ${s.cal} cal`}
                </span>
              </div>
            </button>
          )
        })
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Your supplements">
        <SupplementEditor profile={profile} />
      </Sheet>
    </section>
  )
}

function SupplementEditor({ profile }: { profile: Profile }) {
  const list = settingsOf(profile).supplements
  const [form, setForm] = useState({ name: '', dose: '', timing: '', cal: '', protein: '' })
  const save = (next: Supplement[]) => updateSettings(profile, { supplements: next })
  const valid = form.name.trim() !== ''

  return (
    <div className="stack gap-4">
      {list.length > 0 && (
        <section className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
          {list.map((s) => (
            <div key={s.id} className="g-row">
              <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span className="caption">
                  {s.dose}
                  {s.timing && ` · ${s.timing}`}
                </span>
              </div>
              <button className="link-btn" style={{ color: 'var(--text-3)' }} onClick={() => save(list.filter((x) => x.id !== s.id))}>
                Remove
              </button>
            </div>
          ))}
        </section>
      )}
      <form
        className="stack gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          save([...list, { id: uid(), name: form.name.trim(), dose: form.dose.trim() || '1 serving', timing: form.timing.trim(), cal: Number(form.cal) || 0, protein: Number(form.protein) || 0 }])
          setForm({ name: '', dose: '', timing: '', cal: '', protein: '' })
          haptic.success()
        }}
      >
        <span className="eyebrow">Add a supplement</span>
        <input className="field" placeholder="Name, e.g. Fish oil" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Supplement name" />
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <input className="field" style={{ flex: 1 }} placeholder="Dose, e.g. 2 capsules" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} aria-label="Dose" />
          <input className="field" style={{ flex: 1 }} placeholder="When, e.g. with dinner" value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} aria-label="Timing" />
        </div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <input className="field num" style={{ flex: 1 }} inputMode="decimal" placeholder="Calories (optional)" value={form.cal} onChange={(e) => setForm({ ...form, cal: e.target.value.replace(/[^0-9.]/g, '') })} aria-label="Calories" />
          <input className="field num" style={{ flex: 1 }} inputMode="decimal" placeholder="Protein g (optional)" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value.replace(/[^0-9.]/g, '') })} aria-label="Protein grams" />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={!valid}>
          <Icon name="plus" size={16} /> Add
        </button>
        <p className="caption">Anything with calories or protein (like a protein shake) counts toward your daily goals when you check it off.</p>
      </form>
    </div>
  )
}
