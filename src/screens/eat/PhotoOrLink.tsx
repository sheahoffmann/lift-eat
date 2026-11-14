// Snap a nutrition label or paste a link → Claude reads the macros → review → log.
import { useRef, useState } from 'react'
import type { Slot } from '../../data/meals'
import { photoToBase64, readNutrition, type AINutrition } from '../../lib/aiNutrition'
import { logOther } from '../../lib/eatStore'
import { settingsOf, useProfile } from '../../lib/profile'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

type Target = { slot: Slot | 'extra' | 'other'; replacesMealId?: string }

/** Reusable reader: returns parsed nutrition to the caller (used by logging and custom meals). */
export function NutritionReader({ onResult }: { onResult: (n: AINutrition) => void }) {
  const [profile] = useProfile()
  const passcode = settingsOf(profile).aiPasscode ?? ''
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'photo' | 'link' | null>(null)
  const [error, setError] = useState('')

  async function run(kind: 'photo' | 'link', input: Parameters<typeof readNutrition>[0]) {
    setBusy(kind)
    setError('')
    try {
      const n = await readNutrition(input, passcode)
      haptic.success()
      onResult(n)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (!passcode) {
    return (
      <p className="sub">
        Photo and link reading needs a one-time setup. Add your passcode in Progress → ⚙ Settings → Photo &amp; link reader.
      </p>
    )
  }

  return (
    <div className="stack gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            await run('photo', { image: await photoToBase64(f) })
          } catch {
            setError("Couldn't open that photo.")
            setBusy(null)
          }
        }}
      />
      <button className="btn btn--primary btn--block" disabled={!!busy} onClick={() => fileRef.current?.click()}>
        <Icon name="sparkle" size={18} /> {busy === 'photo' ? 'Reading the label…' : 'Photo of a nutrition label'}
      </button>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (url.trim()) run('link', { url: url.trim() })
        }}
      >
        <input className="field" inputMode="url" placeholder="Or paste a link to the nutrition info" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} aria-label="Nutrition link" />
        <button className="btn btn--secondary" type="submit" disabled={!!busy || !url.trim()}>
          {busy === 'link' ? 'Reading…' : 'Read'}
        </button>
      </form>
      {busy && <div className="card" style={{ height: 6, padding: 0, overflow: 'hidden' }} aria-busy="true"><div className="bar__fill" style={{ width: '40%', animation: 'pulse 1.2s ease-in-out infinite' }} /></div>}
      {error && (
        <p className="caption" role="alert" style={{ color: 'var(--text)' }}>
          {error}
        </p>
      )}
      <p className="caption">Takes a few seconds. You can fix any number before logging.</p>
    </div>
  )
}

export function PhotoOrLink({ date, target, onDone }: { date: string; target: Target; onDone: () => void }) {
  const [food, setFood] = useState<AINutrition | null>(null)
  const [servings, setServings] = useState(1)

  if (!food) return <NutritionReader onResult={setFood} />

  const set = (k: keyof AINutrition, v: string) => setFood({ ...food, [k]: k === 'name' || k === 'servingLabel' ? v : Number(v) || 0 })

  return (
    <div className="stack gap-3">
      <div className="card stack gap-2">
        <label className="stack gap-1">
          <span className="caption" style={{ fontWeight: 600 }}>Food</span>
          <input className="field" value={food.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <span className="caption">Per serving: {food.servingLabel}</span>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <label key={k} className="stack gap-1" style={{ flex: 1, minWidth: 0 }}>
              <span className="caption" style={{ fontWeight: 600 }}>
                {k === 'calories' ? 'Cal' : k[0].toUpperCase() + k.slice(1)}
              </span>
              <input className="field num" style={{ padding: '0 8px', textAlign: 'center' }} inputMode="decimal" value={String(food[k])} aria-label={k} onChange={(e) => set(k, e.target.value.replace(/[^0-9.]/g, ''))} />
            </label>
          ))}
        </div>
        {food.note && <span className="caption">{food.note}</span>}
      </div>
      <div className="card card-row">
        <span style={{ fontWeight: 600 }}>How many servings?</span>
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
        Logging {Math.round(food.protein * servings)} g protein · {Math.round(food.calories * servings)} cal · {Math.round(food.carbs * servings)} g carbs · {Math.round(food.fat * servings)} g fat
      </span>
      <button
        className="btn btn--primary btn--block"
        onClick={async () => {
          await logOther({
            date,
            slot: target.slot,
            replacesMealId: target.replacesMealId,
            food: { name: food.name, servingLabel: food.servingLabel, cal: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, source: 'label-photo' },
            servings,
          })
          haptic.success()
          onDone()
        }}
      >
        <Icon name="check" size={18} strokeWidth={2.6} /> Log it
      </button>
      <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setFood(null)}>
        Start over
      </button>
    </div>
  )
}
