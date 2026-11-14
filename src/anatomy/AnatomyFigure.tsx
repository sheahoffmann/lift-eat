// X-ray style body: translucent silhouette, faint muscle contours,
// worked muscles glowing orange by intensity (0–1).
import { useId, useMemo } from 'react'
import { bodyData } from './bodyData'
import { muscleNames, nonMuscleParts, type MuscleSlug } from './muscles'

type Props = {
  body: 'male' | 'female'
  side: 'front' | 'back'
  muscles?: Partial<Record<MuscleSlug, number>>
  height?: number | string
  className?: string
  /** Breathing glow animation on highlighted muscles. */
  pulse?: boolean
}

export function AnatomyFigure({ body, side, muscles = {}, height = 280, className, pulse = true }: Props) {
  const uid = useId().replace(/:/g, '')
  const view = bodyData[body][side]
  const parts = view.muscles as Record<string, string[]>

  const lit = useMemo(
    () =>
      Object.entries(muscles)
        .filter(([slug, v]) => (v ?? 0) > 0 && parts[slug])
        .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0)) as [MuscleSlug, number][],
    [muscles, parts],
  )

  const label = lit.length
    ? `${side === 'front' ? 'Front' : 'Back'} body view. Worked: ${lit
        .slice()
        .reverse()
        .map(([s]) => muscleNames[s])
        .join(', ')}`
    : `${side === 'front' ? 'Front' : 'Back'} body view`

  return (
    <svg
      viewBox={view.viewBox}
      style={{ height, width: 'auto', display: 'block', overflow: 'visible' }}
      className={className}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--body-fill-top)" />
          <stop offset="1" stopColor="var(--body-fill-bottom)" />
        </linearGradient>
        <linearGradient id={`lit-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-hot)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <filter id={`glow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={`soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      {/* Silhouette */}
      {view.outline.map((d, i) => (
        <path
          key={`o${i}`}
          d={d}
          fill={`url(#fill-${uid})`}
          stroke="var(--body-stroke)"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Muscle contours */}
      {Object.entries(parts).map(([slug, ds]) =>
        slug === 'hair'
          ? null
          : ds.map((d, i) => (
              <path
                key={`${slug}${i}`}
                d={d}
                fill="var(--muscle-fill)"
                stroke="var(--muscle-stroke)"
                strokeWidth={nonMuscleParts.has(slug) ? 0.5 : 0.8}
                vectorEffect="non-scaling-stroke"
              />
            )),
      )}

      {/* Glow halo (blurred) */}
      <g filter={`url(#glow-${uid})`} className={pulse ? 'anatomy-pulse' : undefined}>
        {lit.map(([slug, v]) =>
          parts[slug].map((d, i) => (
            <path key={`g${slug}${i}`} d={d} fill="var(--accent)" opacity={0.55 + 0.45 * v} />
          )),
        )}
      </g>

      {/* Lit muscles */}
      {lit.map(([slug, v]) =>
        parts[slug].map((d, i) => (
          <g key={`l${slug}${i}`}>
            <path d={d} fill={`url(#lit-${uid})`} opacity={0.45 + 0.55 * v} filter={`url(#soft-${uid})`} />
            <path
              d={d}
              fill="none"
              stroke="var(--accent-hot)"
              strokeOpacity={0.5 + 0.5 * v}
              strokeWidth={0.9}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )),
      )}
    </svg>
  )
}
