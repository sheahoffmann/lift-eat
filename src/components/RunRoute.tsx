// The run line: GPS points projected to a box, drawn as a glowing orange path.
import { useId } from 'react'
import { simplify, type RunPoint } from '../lib/runMath'

/** Project points to [x, y] within w×h, preserving shape. Returns one path per segment. */
export function projectRoute(points: RunPoint[], w: number, h: number, pad = 12) {
  const pts = simplify(points)
  if (pts.length < 2) return { paths: [] as string[], start: null as [number, number] | null, end: null as [number, number] | null }
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xs = pts.map((p) => p[1] * k)
  const ys = pts.map((p) => -p[0])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
  const offX = (w - spanX * scale) / 2
  const offY = (h - spanY * scale) / 2
  const xy = pts.map((_, i) => [offX + (xs[i] - minX) * scale, offY + (ys[i] - minY) * scale] as [number, number])
  const paths: string[] = []
  let cur = ''
  pts.forEach((p, i) => {
    const [x, y] = xy[i]
    const newSeg = i === 0 || p[4] !== pts[i - 1][4]
    if (newSeg && cur) {
      paths.push(cur)
      cur = ''
    }
    cur += `${newSeg ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  })
  if (cur) paths.push(cur)
  return { paths, start: xy[0], end: xy.at(-1)! }
}

export function RunRoute({ points, height = 240, label = 'Run route' }: { points: RunPoint[]; height?: number; label?: string }) {
  const uid = useId().replace(/:/g, '')
  const W = 340
  const { paths, start, end } = projectRoute(points, W, height)
  if (!paths.length) {
    return (
      <div className="empty" style={{ height, padding: 0, justifyContent: 'center' }}>
        <span className="caption">Your route appears here once you start moving.</span>
      </div>
    )
  }
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <filter id={`rg-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {paths.map((d, i) => (
        <path key={`g${i}`} d={d} fill="none" stroke="var(--accent)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} filter={`url(#rg-${uid})`} />
      ))}
      {paths.map((d, i) => (
        <path key={`l${i}`} d={d} fill="none" stroke="var(--accent-hot)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {start && <circle cx={start[0]} cy={start[1]} r={6} fill="var(--text)" stroke="var(--bg)" strokeWidth={2} />}
      {end && <circle cx={end[0]} cy={end[1]} r={7} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2.5} />}
    </svg>
  )
}
