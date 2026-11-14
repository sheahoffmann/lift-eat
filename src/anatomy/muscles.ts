// Muscle slugs available in the body map, with display names for labels/VoiceOver.
export const muscleNames = {
  chest: 'Chest',
  abs: 'Abs',
  obliques: 'Obliques',
  biceps: 'Biceps',
  triceps: 'Triceps',
  deltoids: 'Shoulders',
  trapezius: 'Traps',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  forearm: 'Forearms',
  gluteal: 'Glutes',
  quadriceps: 'Quads',
  hamstring: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
  tibialis: 'Shins',
} as const

export type MuscleSlug = keyof typeof muscleNames

/** Parts drawn faintly but never highlighted. */
export const nonMuscleParts = new Set(['head', 'hair', 'hands', 'feet', 'ankles', 'knees', 'neck'])

const backOnly: MuscleSlug[] = ['upper-back', 'lower-back', 'gluteal', 'hamstring']

/** Pick the view that shows the most of the highlighted muscles. */
export function bestSide(muscles: Partial<Record<MuscleSlug, number>>): 'front' | 'back' {
  let front = 0
  let back = 0
  for (const [k, v] of Object.entries(muscles) as [MuscleSlug, number][]) {
    if (backOnly.includes(k)) back += v
    else if (k === 'triceps' || k === 'trapezius' || k === 'calves') back += v * 0.5
    else front += v
  }
  return back > front ? 'back' : 'front'
}
