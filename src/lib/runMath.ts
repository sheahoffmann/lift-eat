// Pure run math: GPS distance, pace, mile splits, elevation, GPX parsing.

/** [lat, lon, time ms, altitude m | null, segment index] */
export type RunPoint = [number, number, number, number | null, number]

export const METERS_PER_MILE = 1609.344

export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Distance in meters; gaps between segments (pauses) are not counted. */
export function totalDistance(points: RunPoint[]) {
  let d = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][4] !== points[i - 1][4]) continue
    d += haversine([points[i - 1][0], points[i - 1][1]], [points[i][0], points[i][1]])
  }
  return d
}

/** Seconds per mile for each completed mile, based on moving time within segments. */
export function mileSplits(points: RunPoint[]) {
  const splits: number[] = []
  let dist = 0
  let time = 0
  let splitStartTime = 0
  for (let i = 1; i < points.length; i++) {
    if (points[i][4] !== points[i - 1][4]) continue
    const d = haversine([points[i - 1][0], points[i - 1][1]], [points[i][0], points[i][1]])
    const t = (points[i][2] - points[i - 1][2]) / 1000
    const before = dist
    dist += d
    time += t
    const target = (splits.length + 1) * METERS_PER_MILE
    if (before < target && dist >= target) {
      // Interpolate the exact crossing time.
      const frac = d > 0 ? (target - before) / d : 1
      const crossTime = time - t + t * frac
      splits.push(Math.round(crossTime - splitStartTime))
      splitStartTime = crossTime
    }
  }
  return splits
}

/** Elevation gain in meters, smoothed to ignore GPS jitter (< 3 m changes). */
export function elevationGain(points: RunPoint[]) {
  let gain = 0
  let ref: number | null = null
  for (const p of points) {
    const alt = p[3]
    if (alt == null) continue
    if (ref == null) {
      ref = alt
      continue
    }
    if (alt - ref >= 3) {
      gain += alt - ref
      ref = alt
    } else if (ref - alt >= 3) ref = alt
  }
  return gain
}

/** Pace (sec per mile) over the last `windowSec` seconds; null if not enough movement. */
export function currentPace(points: RunPoint[], now: number, windowSec = 30) {
  const seg = points.at(-1)?.[4]
  const recent = points.filter((p) => p[4] === seg && now - p[2] <= windowSec * 1000)
  if (recent.length < 2) return null
  const d = totalDistance(recent)
  const t = (recent.at(-1)![2] - recent[0][2]) / 1000
  if (d < 15 || t <= 0) return null
  return (t / d) * METERS_PER_MILE
}

export function formatPace(secPerMile: number | null) {
  if (secPerMile == null || !isFinite(secPerMile) || secPerMile <= 0 || secPerMile > 60 * 60) return '--:--'
  const m = Math.floor(secPerMile / 60)
  const s = Math.round(secPerMile % 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** Rough running calories: ~0.63 kcal per lb of body weight per mile. */
export function runCalories(miles: number, bodyweightLb: number) {
  return Math.round(0.63 * bodyweightLb * miles)
}

/** Should a new GPS fix be kept? Filters poor accuracy, jitter and impossible jumps. */
export function acceptFix(prev: RunPoint | undefined, next: RunPoint, accuracyM: number) {
  if (accuracyM > 35) return false
  if (!prev || prev[4] !== next[4]) return true
  const d = haversine([prev[0], prev[1]], [next[0], next[1]])
  const dt = (next[2] - prev[2]) / 1000
  if (d < Math.max(3, accuracyM * 0.3)) return false // standing still / jitter
  if (dt > 0 && d / dt > 12) return false // faster than a sprint: GPS glitch
  return true
}

/** Parse a GPX file (from Strava, Garmin, etc.) into run points. Regex-based so it runs anywhere. */
export function parseGPX(xml: string): { points: RunPoint[]; name: string | null } {
  const name = xml.match(/<name>([\s\S]*?)<\/name>/)?.[1]?.trim() ?? null
  const points: RunPoint[] = []
  const segments = xml.split(/<trkseg[^>]*>/).slice(1)
  segments.forEach((segXml, segIndex) => {
    const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(segXml))) {
      const attrs = m[1] ?? m[3] ?? ''
      const body = m[2] ?? ''
      const lat = Number(attrs.match(/lat="([^"]+)"/)?.[1])
      const lon = Number(attrs.match(/lon="([^"]+)"/)?.[1])
      if (!isFinite(lat) || !isFinite(lon)) continue
      const ele = body.match(/<ele>([^<]+)<\/ele>/)?.[1]
      const time = body.match(/<time>([^<]+)<\/time>/)?.[1]
      points.push([lat, lon, time ? Date.parse(time) : NaN, ele != null ? Number(ele) : null, segIndex])
    }
  })
  // If times are missing, space points 1 s apart so math still works.
  if (points.some((p) => isNaN(p[2]))) points.forEach((p, i) => (p[2] = i * 1000))
  return { points, name }
}

/** Downsample a route for drawing (keeps shape, caps point count). */
export function simplify(points: RunPoint[], max = 600) {
  if (points.length <= max) return points
  const step = points.length / max
  const out: RunPoint[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)])
  out.push(points.at(-1)!)
  return out
}

/** "1h 30m" / "32m 10s", Strava-style. */
export function formatRunTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`
}
