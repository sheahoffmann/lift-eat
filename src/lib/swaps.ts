// Exercise swaps: same movement pattern + primary muscles, filtered by available
// equipment, ranked by closeness and the reason for swapping.
import { exerciseList, exercises } from '../data/exercises'
import type { Equipment, Exercise } from '../data/exerciseTypes'

export type SwapReason = 'busy' | 'no-equipment' | 'weights' | 'joint' | 'variety'

export const swapReasons: { key: SwapReason; label: string }[] = [
  { key: 'busy', label: 'Machine taken or unavailable' },
  { key: 'no-equipment', label: 'No equipment for this' },
  { key: 'weights', label: "Weights don't go high/low enough" },
  { key: 'joint', label: 'Bothers a joint' },
  { key: 'variety', label: 'Just want variety' },
]

export function canDo(ex: Exercise, available: Equipment[]) {
  return ex.equipment.every((e) => e === 'bodyweight' || available.includes(e))
}

const overlap = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0
  const inter = a.filter((x) => b.includes(x)).length
  return inter / new Set([...a, ...b]).size
}

export function swapCandidates(exId: string, available: Equipment[], reason: SwapReason | null, limit = 5, exclude: string[] = []) {
  const src = exercises[exId]
  if (!src) return []
  const scored = exerciseList
    .filter((e) => e.id !== exId && !exclude.includes(e.id) && canDo(e, available))
    .map((e) => {
      const primary = overlap(src.primary, e.primary)
      if (primary === 0) return null
      let score = primary * 6 + overlap(src.secondary, e.secondary) * 2
      if (e.pattern === src.pattern) score += 4
      else if (src.pattern === 'isolation' || e.pattern === 'isolation') score -= 1
      else score -= 3
      if (e.logType === src.logType) score += 1
      if (!reason && e.loadType === src.loadType) score += 1.5
      if (!!e.unilateral === !!src.unilateral) score += 0.5
      const sharesGear = e.equipment.some((g) => g !== 'bodyweight' && src.equipment.includes(g))
      switch (reason) {
        case 'busy':
          if (sharesGear) score -= 4
          break
        case 'weights':
          if (e.loadType === src.loadType) score -= 4
          break
        case 'joint':
          if (['machine', 'cable', 'dumbbell'].includes(e.loadType)) score += 2
          if (e.loadType === 'barbell') score -= 2
          if (e.loadType === src.loadType) score -= 1
          break
        case 'variety':
          if (sharesGear) score -= 1
          score += Math.random() * 1.5
          break
      }
      return { ex: e, score }
    })
    .filter((x): x is { ex: Exercise; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.ex)
}

/** Best substitute for an exercise under an equipment profile (or itself if doable). */
export function autoSubstitute(exId: string, available: Equipment[], preferred?: string) {
  const ex = exercises[exId]
  if (!ex || canDo(ex, available)) return exId
  if (preferred && exercises[preferred] && canDo(exercises[preferred], available)) return preferred
  return swapCandidates(exId, available, 'no-equipment', 1)[0]?.id ?? exId
}
