import { describe, expect, it } from 'vitest'
import { acceptFix, currentPace, elevationGain, formatPace, haversine, METERS_PER_MILE, mileSplits, parseGPX, totalDistance, type RunPoint } from './runMath'

// A straight line heading north: 1 degree latitude ≈ 111,195 m.
const DEG_PER_M = 1 / 111195
function line(meters: number, secPerMile: number, seg = 0, startT = 0, stepM = 10): RunPoint[] {
  const pts: RunPoint[] = []
  for (let d = 0; d <= meters; d += stepM) pts.push([40 + d * DEG_PER_M, -105, startT + (d / METERS_PER_MILE) * secPerMile * 1000, 1800, seg])
  return pts
}

describe('run math', () => {
  it('haversine is accurate for short distances', () => {
    expect(Math.round(haversine([40, -105], [40 + 1000 * DEG_PER_M, -105]))).toBe(1000)
  })

  it('total distance and mile splits', () => {
    const pts = line(2 * METERS_PER_MILE + 100, 540) // 9:00/mi
    expect(Math.abs(totalDistance(pts) - (2 * METERS_PER_MILE + 100))).toBeLessThan(10)
    const splits = mileSplits(pts)
    expect(splits).toHaveLength(2)
    for (const s of splits) expect(Math.abs(s - 540)).toBeLessThanOrEqual(2)
  })

  it('does not count distance across a pause gap', () => {
    const a = line(500, 540, 0, 0)
    const b = line(500, 540, 1, 10_000_000).map((p) => [p[0] + 0.01, p[1], p[2], p[3], p[4]] as RunPoint)
    expect(Math.round(totalDistance([...a, ...b]))).toBe(1000)
  })

  it('current pace over the last 30 s', () => {
    const pts = line(400, 480) // 8:00/mi
    const pace = currentPace(pts, pts.at(-1)![2])
    expect(Math.abs(pace! - 480)).toBeLessThan(5)
    expect(formatPace(480)).toBe('8:00')
    expect(formatPace(null)).toBe('--:--')
  })

  it('filters bad fixes', () => {
    const p: RunPoint = [40, -105, 0, null, 0]
    expect(acceptFix(p, [40 + 50 * DEG_PER_M, -105, 1000, null, 0], 10)).toBe(false) // 50 m in 1 s
    expect(acceptFix(p, [40 + 1 * DEG_PER_M, -105, 1000, null, 0], 10)).toBe(false) // jitter
    expect(acceptFix(p, [40 + 4 * DEG_PER_M, -105, 1000, null, 0], 10)).toBe(true)
    expect(acceptFix(p, [40 + 4 * DEG_PER_M, -105, 1000, null, 0], 80)).toBe(false) // poor accuracy
  })

  it('elevation gain ignores jitter', () => {
    const alts = [100, 101, 100, 102, 105, 104, 110, 109, 111]
    const pts = alts.map((a, i) => [40, -105, i * 1000, a, 0] as RunPoint)
    expect(elevationGain(pts)).toBe(10) // +5, +5; the final 1 m wiggle is ignored
  })

  it('parses Strava-style GPX', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><name>Morning Run</name><trkseg>
      <trkpt lat="40.0" lon="-105.0"><ele>1600</ele><time>2026-11-14T15:00:00Z</time></trkpt>
      <trkpt lat="40.001" lon="-105.0"><ele>1601</ele><time>2026-11-14T15:00:30Z</time></trkpt>
    </trkseg></trk></gpx>`
    const { points, name } = parseGPX(gpx)
    expect(name).toBe('Morning Run')
    expect(points).toHaveLength(2)
    expect(points[1][2] - points[0][2]).toBe(30000)
    expect(Math.round(totalDistance(points))).toBe(111)
  })
})
