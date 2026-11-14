// Season framing for program phases.
// Preseason = first 3 weeks from start date; then Season 1: Cut.
// Season 2: Build is a manual switch (added in Milestone 2).

export type Season = {
  key: 'refresh' | 'preseason' | 'cut' | 'build'
  name: string
  week: number
  /** 0–1 progress through the season, or null when open-ended. */
  progress: number | null
  dayOfSeason: number
  lengthDays: number | null
}

const DAY = 86_400_000

export function daysBetween(fromISO: string, to = new Date()) {
  const [y, m, d] = fromISO.split('-').map(Number)
  const start = new Date(y, m - 1, d).getTime()
  const today = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  return Math.max(0, Math.round((today - start) / DAY))
}

export function currentSeason(startISO: string, now = new Date()): Season {
  const days = daysBetween(startISO, now)
  if (days < 7) {
    // Week 1: easy "refresh" week to rebuild the habit.
    return {
      key: 'refresh',
      name: 'Refresh Week',
      week: 1,
      progress: (days + 1) / 21,
      dayOfSeason: days + 1,
      lengthDays: 21,
    }
  }
  if (days < 21) {
    return {
      key: 'preseason',
      name: 'Preseason',
      week: Math.floor(days / 7) + 1,
      progress: (days + 1) / 21,
      dayOfSeason: days + 1,
      lengthDays: 21,
    }
  }
  const d = days - 21
  return {
    key: 'cut',
    name: 'Season 1: Cut',
    week: Math.floor(d / 7) + 1,
    progress: null,
    dayOfSeason: d + 1,
    lengthDays: null,
  }
}

/** Days until a goal date (0 on the day itself, negative after). */
export function daysUntil(goalISO: string, now = new Date()) {
  const [y, m, d] = goalISO.split('-').map(Number)
  const goal = new Date(y, m - 1, d).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((goal - today) / DAY)
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
