// Fields that define an exercise you add yourself: name (with AI auto-fill), how it's
// logged, main vs. supporting muscles (live figure preview), and form cues.
import { useState } from 'react'
import { muscleNames, bestSide, type MuscleSlug } from '../../anatomy/muscles'
import { AnatomyFigure } from '../../anatomy/AnatomyFigure'
import type { CustomExercise } from '../../lib/db'
import { autofillExercise } from '../../lib/aiExercise'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export type ExerciseDraft = {
  name: string
  logType: CustomExercise['logType']
  primary: MuscleSlug[]
  secondary: MuscleSlug[]
  cues: [string, string, string]
  mistake: string
}

export const draftFrom = (c?: Partial<CustomExercise>, fallbackPrimary: MuscleSlug[] = []): ExerciseDraft => ({
  name: c?.name ?? '',
  logType: c?.logType ?? 'weighted',
  primary: (c?.primary as MuscleSlug[]) ?? fallbackPrimary,
  secondary: (c?.secondary as MuscleSlug[]) ?? [],
  cues: c?.cues ?? ['', '', ''],
  mistake: c?.mistake ?? '',
})

/** Draft → stored fields (blank cues are left out so defaults apply). */
export const draftToFields = (d: ExerciseDraft) => ({
  name: d.name.trim(),
  logType: d.logType,
  primary: d.primary,
  secondary: d.secondary.filter((m) => !d.primary.includes(m)),
  cues: d.cues.every((c) => c.trim()) ? (d.cues.map((c) => c.trim()) as [string, string, string]) : undefined,
  mistake: d.mistake.trim() || undefined,
})

const logTypes: { key: CustomExercise['logType']; label: string }[] = [
  { key: 'weighted', label: 'Weight × reps' },
  { key: 'bodyweight', label: 'Reps only' },
  { key: 'timed', label: 'Time' },
  { key: 'distance', label: 'Distance' },
]

export function ExerciseFields({ draft, setDraft, passcode, body }: { draft: ExerciseDraft; setDraft: (d: ExerciseDraft) => void; passcode?: string; body: 'male' | 'female' }) {
  const [filling, setFilling] = useState(false)
  const [msg, setMsg] = useState('')
  const [cuesOpen, setCuesOpen] = useState(draft.cues.some((c) => c.trim()))
  const set = (p: Partial<ExerciseDraft>) => setDraft({ ...draft, ...p })
  const figure = Object.fromEntries([...draft.secondary.map((m) => [m, 0.45]), ...draft.primary.map((m) => [m, 1])])

  // Tap: off → main → also works → off.
  function cycle(m: MuscleSlug) {
    haptic.light()
    if (draft.primary.includes(m)) set({ primary: draft.primary.filter((x) => x !== m), secondary: [...draft.secondary, m] })
    else if (draft.secondary.includes(m)) set({ secondary: draft.secondary.filter((x) => x !== m) })
    else set({ primary: [...draft.primary, m] })
  }

  async function fill() {
    if (!passcode) return
    setFilling(true)
    setMsg('')
    try {
      const r = await autofillExercise(draft.name, passcode)
      setDraft({
        name: draft.name.trim() || r.name,
        logType: r.logType,
        primary: r.primary as MuscleSlug[],
        secondary: r.secondary as MuscleSlug[],
        cues: r.cues,
        mistake: r.mistake,
      })
      setCuesOpen(true)
      haptic.success()
      setMsg('Filled in. Check it over and change anything that looks off.')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setFilling(false)
    }
  }

  return (
    <div className="stack gap-4">
      <div className="stack gap-1">
        <label className="caption" style={{ fontWeight: 600 }} htmlFor="ex-name">
          Exercise name
        </label>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <input id="ex-name" className="field" style={{ flex: 1 }} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Hack squat" />
          <button type="button" className="btn btn--secondary" style={{ flex: 'none' }} disabled={!passcode || filling || draft.name.trim().length < 2} onClick={fill}>
            <Icon name="wand" size={16} /> {filling ? 'Filling…' : 'Auto-fill'}
          </button>
        </div>
        <span className="caption" role={msg ? 'status' : undefined}>
          {msg || (passcode ? 'Auto-fill picks the muscles and form cues for you (about a cent).' : 'Auto-fill needs the passcode in Progress → ⚙ → Photo & link reader.')}
        </span>
      </div>

      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          How you log it
        </span>
        <div className="tool-row" role="radiogroup" aria-label="How you log it">
          {logTypes.map((t) => (
            <button type="button" key={t.key} role="radio" aria-checked={draft.logType === t.key} className={`chip ${draft.logType === t.key ? 'chip--accent' : ''}`} onClick={() => set({ logType: t.key })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stack gap-2">
        <span className="caption" style={{ fontWeight: 600 }}>
          Muscles it works
        </span>
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start' }}>
          <div className="tool-row" role="group" aria-label="Muscles it works" style={{ flex: 1 }}>
            {(Object.keys(muscleNames) as MuscleSlug[]).map((m) => {
              const main = draft.primary.includes(m)
              const also = draft.secondary.includes(m)
              return (
                <button
                  type="button"
                  key={m}
                  aria-label={`${muscleNames[m]}: ${main ? 'main' : also ? 'also works' : 'off'}`}
                  className="chip"
                  style={main ? { background: 'var(--accent-fill)', color: '#fff' } : also ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : undefined}
                  onClick={() => cycle(m)}
                >
                  {muscleNames[m]}
                </button>
              )
            })}
          </div>
          {(draft.primary.length > 0 || draft.secondary.length > 0) && (
            <div style={{ flex: 'none' }} aria-hidden>
              <AnatomyFigure body={body} side={bestSide(figure)} muscles={figure} height={130} />
            </div>
          )}
        </div>
        <span className="caption">Tap once for a main muscle (bright), twice for one it also works (lighter), again to clear.</span>
      </div>

      <div className="stack gap-2">
        <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} aria-expanded={cuesOpen} onClick={() => setCuesOpen(!cuesOpen)}>
          {cuesOpen ? 'Hide form cues' : 'Add form cues (optional)'}
        </button>
        {cuesOpen && (
          <>
            {draft.cues.map((c, i) => (
              <input
                key={i}
                className="field"
                value={c}
                aria-label={`Form cue ${i + 1}`}
                placeholder={['e.g. Feet shoulder-width on the platform', 'e.g. Lower until thighs are parallel', 'e.g. Drive through your whole foot'][i]}
                onChange={(e) => {
                  const cues = [...draft.cues] as [string, string, string]
                  cues[i] = e.target.value
                  set({ cues })
                }}
              />
            ))}
            <input className="field" value={draft.mistake} aria-label="Common mistake" placeholder="Common mistake, e.g. Knees caving in" onChange={(e) => set({ mistake: e.target.value })} />
          </>
        )}
      </div>
    </div>
  )
}
