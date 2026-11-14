// Three concentric daily rings (Train / Fuel / Log), Apple Fitness-style.
import { motion } from 'motion/react'

export type RingValues = { train: number; fuel: number; log: number }

const rings = [
  { key: 'train', label: 'Train', color: 'var(--ring-train)' },
  { key: 'fuel', label: 'Fuel', color: 'var(--ring-fuel)' },
  { key: 'log', label: 'Log', color: 'var(--ring-log)' },
] as const

export function Rings({ values, size = 132 }: { values: RingValues; size?: number }) {
  const stroke = size * 0.105
  const gap = stroke * 0.22
  const label = rings.map((r) => `${r.label} ${Math.round(Math.min(1, values[r.key]) * 100)}%`).join(', ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Daily rings: ${label}`}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap)
        const v = Math.max(0, Math.min(1, values[r.key]))
        return (
          <g key={r.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={r.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: v === 0 ? 0.001 : v, opacity: v === 0 ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 60, damping: 16, delay: 0.15 + i * 0.08, opacity: { duration: 0.2 } }}
              style={{ filter: v >= 1 ? `drop-shadow(0 0 6px ${r.color})` : undefined }}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function RingLegend({ values, detail }: { values: RingValues; detail: Record<keyof RingValues, string> }) {
  return (
    <div className="stack gap-3">
      {rings.map((r) => (
        <div key={r.key} className="stack" style={{ gap: 1 }}>
          <div className="row" style={{ gap: 6 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: r.color }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--fs-sub)' }}>{r.label}</span>
            {values[r.key] >= 1 && <span className="caption accent">Closed</span>}
          </div>
          <span className="caption" style={{ paddingLeft: 14 }}>
            {detail[r.key]}
          </span>
        </div>
      ))}
    </div>
  )
}
