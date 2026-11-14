// Swap an exercise: pick why, then one of 3–5 ranked alternatives; just today or in the program.
import { useMemo, useState } from 'react'
import { exercises } from '../../data/exercises'
import { muscleNames } from '../../anatomy/muscles'
import { swapCandidates, swapReasons, type SwapReason } from '../../lib/swaps'
import type { Equipment } from '../../data/exerciseTypes'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export function SwapSheet({
  exerciseId,
  available,
  exclude,
  onSwap,
}: {
  exerciseId: string
  available: Equipment[]
  exclude: string[]
  onSwap: (newEx: string, scope: 'today' | 'program') => void
}) {
  const [reason, setReason] = useState<SwapReason | null>(null)
  const [scope, setScope] = useState<'today' | 'program'>('today')
  const alts = useMemo(() => swapCandidates(exerciseId, available, reason, 5, exclude), [exerciseId, available, reason, exclude])
  const src = exercises[exerciseId]

  return (
    <div className="stack gap-4">
      <p className="sub">
        Replacing <strong style={{ color: 'var(--text)' }}>{src?.name}</strong>. Why?
      </p>
      <div className="tool-row" role="radiogroup" aria-label="Reason">
        {swapReasons.map((r) => (
          <button
            key={r.key}
            role="radio"
            aria-checked={reason === r.key}
            className={`chip ${reason === r.key ? 'chip--accent' : ''}`}
            onClick={() => {
              haptic.light()
              setReason(reason === r.key ? null : r.key)
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="segmented" role="radiogroup" aria-label="Swap scope">
        {(
          [
            ['today', 'Just today'],
            ['program', 'Replace in my program'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={scope === k} onClick={() => setScope(k)}>
            {scope === k && <span className="segmented__pill" />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="stack gap-2">
        {alts.length === 0 && <p className="sub">No alternatives with the equipment in this profile.</p>}
        {alts.map((a, i) => (
          <button
            key={a.id}
            className="option"
            onClick={() => {
              haptic.success()
              onSwap(a.id, scope)
            }}
          >
            <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 650 }}>{a.name}</span>
                {i === 0 && <span className="pill-sm pill-sm--accent">Closest</span>}
              </div>
              <span className="caption">
                {a.primary.map((m) => muscleNames[m]).join(', ')} · {a.equipment.join(', ')}
              </span>
            </div>
            <Icon name="swap" size={18} className="muted" />
          </button>
        ))}
      </div>
      <p className="caption">History and PRs are tracked per exercise, so swapping never changes the original lift's numbers.</p>
    </div>
  )
}
