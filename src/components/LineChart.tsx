// Minimal, accessible SVG line chart (dates on x). Tap a point to see its value.
import { useMemo, useState } from 'react'

export type Series = { name: string; color: string; points: { date: string; value: number }[]; dots?: boolean; width?: number; dashed?: boolean }

const t = (d: string) => new Date(d + 'T12:00:00').getTime()
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function LineChart({
  series,
  height = 180,
  unit = '',
  label,
  decimals = 0,
}: {
  series: Series[]
  height?: number
  unit?: string
  label: string
  decimals?: number
}) {
  const [sel, setSel] = useState<{ s: number; i: number } | null>(null)
  const W = 340
  const H = height
  const pad = { l: 34, r: 8, t: 10, b: 22 }
  const all = series.flatMap((s) => s.points)
  const { x, y, ticks, xs } = useMemo(() => {
    const ts = all.map((p) => t(p.date))
    const vs = all.map((p) => p.value)
    const minT = Math.min(...ts)
    const maxT = Math.max(...ts, minT + 86_400_000)
    let minV = Math.min(...vs)
    let maxV = Math.max(...vs)
    if (maxV - minV < 2) {
      minV -= 1
      maxV += 1
    }
    const span = maxV - minV
    minV -= span * 0.1
    maxV += span * 0.1
    const x = (d: string) => pad.l + ((t(d) - minT) / (maxT - minT)) * (W - pad.l - pad.r)
    const y = (v: number) => pad.t + (1 - (v - minV) / (maxV - minV)) * (H - pad.t - pad.b)
    const ticks = [0, 0.5, 1].map((f) => minV + f * (maxV - minV))
    const dates = [...new Set(all.map((p) => p.date))].sort()
    const xs = dates.length > 1 ? [dates[0], dates[dates.length - 1]] : dates
    return { x, y, ticks, xs }
  }, [all, H])

  if (!all.length) return null
  const latest = series[0].points.at(-1)
  const summary = `${label}: ${series.map((s) => `${s.name} latest ${s.points.at(-1)?.value.toFixed(decimals)}${unit}`).join(', ')}`
  const selected = sel ? series[sel.s].points[sel.i] : null

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} style={{ display: 'block', overflow: 'visible' }}>
        {ticks.map((v, k) => (
          <g key={k}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--hairline)" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)" className="num">
              {v.toFixed(decimals)}
            </text>
          </g>
        ))}
        {xs.map((d) => (
          <text key={d} x={x(d)} y={H - 4} textAnchor={d === xs[0] ? 'start' : 'end'} fontSize="10" fill="var(--text-3)">
            {fmtDate(d)}
          </text>
        ))}
        {series.map((s, si) => {
          const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
          return (
            <g key={s.name}>
              {s.points.length > 1 && (
                <path d={path} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '4 4' : undefined} />
              )}
              {(s.dots || s.points.length === 1) &&
                s.points.map((p, i) => (
                  <circle key={i} cx={x(p.date)} cy={y(p.value)} r={sel?.s === si && sel.i === i ? 5 : 3} fill={s.color} opacity={s.dots ? 0.7 : 1} />
                ))}
              {/* Larger invisible tap targets */}
              {s.points.map((p, i) => (
                <circle key={`t${i}`} cx={x(p.date)} cy={y(p.value)} r={12} fill="transparent" onClick={() => setSel({ s: si, i })} style={{ cursor: 'pointer' }} />
              ))}
            </g>
          )
        })}
      </svg>
      <figcaption className="row" style={{ gap: 'var(--s-3)', flexWrap: 'wrap', marginTop: 6 }}>
        {series.length > 1 &&
          series.map((s) => (
            <span key={s.name} className="caption row" style={{ gap: 5 }}>
              <span aria-hidden style={{ width: 10, height: 3, borderRadius: 2, background: s.color }} /> {s.name}
            </span>
          ))}
        <span className="caption num" style={{ marginLeft: 'auto' }}>
          {selected ? `${fmtDate(selected.date)}: ${selected.value.toFixed(decimals)}${unit}` : latest ? `Latest ${latest.value.toFixed(decimals)}${unit}` : ''}
        </span>
      </figcaption>
    </figure>
  )
}
