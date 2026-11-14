// Camera barcode scanner → lookup → "How much did you eat?" → log + save to My foods.
// Note: iPhone only allows camera access on https pages (works once hosted).
import { useEffect, useRef, useState } from 'react'
import type { Slot } from '../../data/meals'
import { lookupBarcode, scale, type ScannedFood } from '../../lib/foodLookup'
import { logOther } from '../../lib/eatStore'
import { db } from '../../lib/db'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

type Target = { slot: Slot | 'extra' | 'other'; replacesMealId?: string }

export function BarcodeScan({ date, target, onDone }: { date: string; target: Target; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'looking' | 'found' | 'notfound' | 'nocamera'>('starting')
  const [code, setCode] = useState('')
  const [food, setFood] = useState<ScannedFood | null>(null)
  const [mode, setMode] = useState<'servings' | 'grams'>('servings')
  const [amount, setAmount] = useState('1')

  async function lookup(c: string) {
    setCode(c)
    setStatus('looking')
    haptic.success()
    // Already saved? Use it straight away.
    const saved = await db.myFoods.where('barcode').equals(c).first()
    if (saved) {
      setFood({
        barcode: c,
        name: saved.name,
        servingLabel: saved.servingLabel,
        servingGrams: null,
        per100: null,
        perServing: { cal: saved.cal, protein: saved.protein, carbs: saved.carbs, fat: saved.fat },
        source: 'Open Food Facts',
      })
      setStatus('found')
      return
    }
    const f = await lookupBarcode(c)
    setFood(f)
    setStatus(f ? 'found' : 'notfound')
    if (f && !f.perServing) setMode('grams')
  }

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        setStatus('nocamera')
        return
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        if (cancelled || !video.current) return
        setStatus('scanning')
        const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, (result) => {
          if (result && !cancelled) {
            cancelled = true
            controls.stop()
            lookup(result.getText())
          }
        })
        stop = () => controls.stop()
      } catch {
        setStatus('nocamera')
      }
    })()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [])

  const n = Number(amount) || 0
  const macros = food
    ? mode === 'servings' && food.perServing
      ? scale(food.perServing, n)
      : food.per100
        ? scale(food.per100, n / 100)
        : null
    : null

  async function log() {
    if (!food || !macros) return
    const perServing = food.perServing ?? (food.per100 && food.servingGrams ? scale(food.per100, food.servingGrams / 100) : macros)
    await logOther({
      date,
      slot: target.slot,
      replacesMealId: target.replacesMealId,
      food: {
        name: food.name,
        servingLabel: food.servingLabel,
        ...roundM(perServing),
        source: 'barcode',
        barcode: food.barcode,
      },
      servings: mode === 'servings' ? n : perServing.cal ? macros.cal / perServing.cal : 1,
    })
    haptic.success()
    onDone()
  }

  return (
    <div className="stack gap-3">
      {(status === 'starting' || status === 'scanning') && (
        <div className="card" style={{ padding: 0, aspectRatio: '4 / 3', position: 'relative' }}>
          <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div aria-hidden style={{ position: 'absolute', inset: '30% 12%', border: '2px solid var(--accent)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
          <span className="caption" style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', color: '#fff' }}>
            Point at the barcode
          </span>
        </div>
      )}

      {status === 'nocamera' && (
        <p className="sub">The camera isn't available here (iPhone only allows it on https sites). Type the barcode number instead.</p>
      )}

      {(status === 'nocamera' || status === 'notfound' || status === 'scanning') && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length >= 6) lookup(code)
          }}
        >
          <input className="field num" inputMode="numeric" placeholder="Barcode number" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }} aria-label="Barcode number" />
          <button className="btn btn--secondary" type="submit" disabled={code.length < 6}>
            Look up
          </button>
        </form>
      )}

      {status === 'looking' && <div className="card" style={{ height: 120, opacity: 0.6 }} aria-busy="true" aria-label="Looking up barcode" />}

      {status === 'notfound' && <p className="sub">No match for {code}. Use Quick add instead; it'll be saved to My foods for next time.</p>}

      {status === 'found' && food && (
        <div className="stack gap-3">
          <div className="card stack gap-1">
            <span className="title3">{food.name}</span>
            <span className="caption">
              {food.perServing ? `Per serving (${food.servingLabel}): ${Math.round(food.perServing.protein)} g protein · ${Math.round(food.perServing.cal)} cal` : `Per 100 g: ${Math.round(food.per100!.protein)} g protein · ${Math.round(food.per100!.cal)} cal`}
            </span>
            <span className="caption">Source: {food.source}</span>
          </div>
          <span style={{ fontWeight: 600 }}>How much did you eat?</span>
          <div className="segmented" role="radiogroup" aria-label="Amount type">
            {(
              [
                ['servings', 'Servings'],
                ['grams', 'Grams'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="radio"
                aria-checked={mode === k}
                disabled={(k === 'servings' && !food.perServing) || (k === 'grams' && !food.per100)}
                onClick={() => {
                  setMode(k)
                  setAmount(k === 'servings' ? '1' : String(food.servingGrams ?? 100))
                }}
              >
                {mode === k && <span className="segmented__pill" />}
                <span>{l}</span>
              </button>
            ))}
          </div>
          <input className="field num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} aria-label={mode === 'servings' ? 'Servings' : 'Grams'} />
          {macros && (
            <span className="caption num">
              {Math.round(macros.protein)} g protein · {Math.round(macros.cal)} cal · {Math.round(macros.carbs)} g carbs · {Math.round(macros.fat)} g fat
            </span>
          )}
          <button className="btn btn--primary btn--block" onClick={log} disabled={!macros || n <= 0}>
            <Icon name="check" size={18} strokeWidth={2.6} /> Log it
          </button>
        </div>
      )}
    </div>
  )
}

const roundM = (m: { cal: number; protein: number; carbs: number; fat: number }) => ({
  cal: Math.round(m.cal),
  protein: Math.round(m.protein),
  carbs: Math.round(m.carbs),
  fat: Math.round(m.fat),
})
