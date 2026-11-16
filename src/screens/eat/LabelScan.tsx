// "Scan grocery labels": pick several label photos at once; each is read, matched to
// the planner ingredient it replaces, and saved as this phone's exact numbers.
import { useEffect, useRef, useState } from 'react'
import { db, uid, type WeekPlan } from '../../lib/db'
import { settingsOf, updateSettings, type Profile, type ScannedLabel } from '../../lib/profile'
import { photoToBase64, readNutrition, type AINutrition } from '../../lib/aiNutrition'
import { groceryItems } from '../../data/groceryItems'
import { guessItem, mealIngredients, toCatalog } from '../../lib/labelScan'
import { haptic } from '../../lib/haptics'
import { applyLabels, myLabelsOn } from '../../data/myLabels'
import { mealChanges, mealSnapshot, type MealChange } from '../../lib/weekReview'
import { WeekReview } from './WeekReview'
import { Icon } from '../../components/Icon'

type Row = {
  key: string
  file: string
  status: 'reading' | 'done' | 'error'
  result?: AINutrition
  error?: string
  /** grocery item id, 'myfood' (save to My foods) or 'skip'. */
  match: string
  grams: string
}

export function LabelScan({ profile, plan, preset, onDone }: { profile: Profile; plan: WeekPlan | null; preset?: { file: File; itemId: string }[]; onDone: () => void }) {
  const settings = settingsOf(profile)
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [saved, setSaved] = useState<number | null>(null)
  const [changes, setChanges] = useState<MealChange[] | null>(null)
  const ingredients = mealIngredients()
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))

  async function readAll(files: File[], matches: (string | undefined)[] = []) {
    setSaved(null)
    const fresh: Row[] = files.map((f) => ({ key: uid(), file: f.name, status: 'reading', match: 'skip', grams: '' }))
    setRows((rs) => [...rs, ...fresh])
    // Two at a time: quick, without hammering the server.
    let next = 0
    const worker = async () => {
      while (next < files.length) {
        const i = next++
        const row = fresh[i]
        try {
          const res = await readNutrition({ image: await photoToBase64(files[i]) }, settings.aiPasscode ?? '')
          const guess = matches[i] ?? guessItem(res.name)
          patch(row.key, { status: 'done', result: res, match: guess ?? 'myfood', grams: res.servingGrams ? String(res.servingGrams) : '' })
        } catch (e) {
          patch(row.key, { status: 'error', error: (e as Error).message })
        }
      }
    }
    await Promise.all([worker(), worker()])
  }

  // Photos taken from the grocery list already know which item they are.
  const started = useRef(false)
  useEffect(() => {
    if (!preset?.length || started.current || !settings.aiPasscode) return
    started.current = true
    readAll(preset.map((p) => p.file), preset.map((p) => p.itemId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ready = rows.filter((r) => r.status === 'done' && r.match !== 'skip')
  const needsGrams = (r: Row) => r.match !== 'myfood' && r.match !== 'skip' && groceryItems[r.match]?.unit === 'g' && !(Number(r.grams) > 0)
  const reading = rows.some((r) => r.status === 'reading')

  async function save() {
    const scanned: Record<string, ScannedLabel> = { ...(settings.scannedLabels ?? {}) }
    let n = 0
    for (const r of ready) {
      const res = r.result!
      if (r.match === 'myfood') {
        await db.myFoods.put({ id: uid(), name: res.name, servingLabel: res.servingLabel, cal: res.calories, protein: res.protein, carbs: res.carbs, fat: res.fat, source: 'label-photo', uses: 0, lastUsed: new Date().toISOString() })
        n++
        continue
      }
      const item = groceryItems[r.match]
      const c = item && toCatalog(item, res, Number(r.grams) || undefined)
      if (c) {
        scanned[r.match] = c
        n++
      }
    }
    const before = plan ? mealSnapshot(plan.picks, plan.portion) : null
    // Apply right away so the review below shows the new numbers.
    applyLabels(myLabelsOn(profile.program, settings.myLabels), scanned)
    updateSettings(profile, { scannedLabels: scanned })
    if (plan && before) setChanges(mealChanges(before, mealSnapshot(plan.picks, plan.portion)))
    haptic.celebrate()
    setSaved(n)
    setRows([])
  }

  if (!settings.aiPasscode) {
    return (
      <div className="stack gap-3">
        <p className="sub">Label reading needs your passcode first. Add it in Progress → ⚙ → Photo &amp; link reader, then come back.</p>
      </div>
    )
  }

  return (
    <div className="stack gap-4">
      <p className="sub">Back from the store? Take a photo of each nutrition label, then pick them all here. The app reads each one and uses the exact numbers for your meals on this phone.</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) readAll(files)
        }}
      />
      {saved === null && (
      <button className="btn btn--primary btn--block" onClick={() => fileRef.current?.click()} disabled={reading}>
        <Icon name="camera" size={18} /> {rows.length ? 'Add more photos' : 'Choose label photos'}
      </button>
      )}

      {saved !== null && plan && changes && (
        <>
          <span className="title3">Saved {saved} label{saved === 1 ? '' : 's'} ✓</span>
          <WeekReview plan={plan} profile={profile} changes={changes} />
          <button className="btn btn--secondary btn--block" onClick={onDone}>
            Done
          </button>
        </>
      )}
      {saved !== null && !(plan && changes) && (
        <div className="card card-row" style={{ padding: 'var(--s-3) var(--s-4)' }}>
          <span style={{ fontWeight: 650 }}>
            Saved {saved} label{saved === 1 ? '' : 's'} ✓
          </span>
          <button className="btn btn--secondary btn--sm" onClick={onDone}>
            Done
          </button>
        </div>
      )}

      {rows.map((r) => (
        <section key={r.key} className="card stack gap-2" style={{ padding: 'var(--s-3) var(--s-4)' }} aria-busy={r.status === 'reading'}>
          {r.status === 'reading' && <span className="caption">Reading {r.file}…</span>}
          {r.status === 'error' && (
            <span className="caption" role="alert" style={{ color: 'var(--text)' }}>
              {r.file}: {r.error}
            </span>
          )}
          {r.status === 'done' && r.result && (
            <>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 650 }}>{r.result.name}</span>
                <span className="caption num">
                  {r.result.servingLabel} · {Math.round(r.result.calories)} cal · {Math.round(r.result.protein)} g protein · {Math.round(r.result.carbs)} g carbs · {Math.round(r.result.fat)} g fat
                </span>
                {r.result.note && <span className="caption">{r.result.note}</span>}
              </div>
              <label className="stack gap-1">
                <span className="caption" style={{ fontWeight: 600 }}>
                  Use it for
                </span>
                <select className="field" value={r.match} onChange={(e) => patch(r.key, { match: e.target.value })}>
                  <option value="myfood">Not in my meals: save to My foods</option>
                  <option value="skip">Skip this one</option>
                  <optgroup label="Replaces this meal ingredient">
                    {ingredients.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {r.match !== 'myfood' && r.match !== 'skip' && groceryItems[r.match]?.unit === 'g' && (
                <label className="stack gap-1">
                  <span className="caption" style={{ fontWeight: 600 }}>
                    Grams per serving {needsGrams(r) ? '(needed: check the label)' : ''}
                  </span>
                  <input className="field num" inputMode="decimal" value={r.grams} onChange={(e) => patch(r.key, { grams: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="e.g. 84" />
                </label>
              )}
            </>
          )}
        </section>
      ))}

      {rows.length > 0 && (
        <button className="btn btn--primary btn--block" disabled={reading || ready.length === 0 || ready.some(needsGrams)} onClick={save}>
          <Icon name="check" size={18} strokeWidth={2.6} /> {reading ? 'Reading labels…' : `Save ${ready.length} label${ready.length === 1 ? '' : 's'}`}
        </button>
      )}
      <p className="caption">Each photo costs about a cent on your Anthropic account. Saved labels stay on this phone only; manage them in Progress → ⚙ → My food labels.</p>
    </div>
  )
}
