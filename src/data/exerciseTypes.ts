import type { MuscleSlug } from '../anatomy/muscles'

export type Equipment =
  | 'barbell'
  | 'trap-bar'
  | 'dumbbells'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'pull-up-bar'
  | 'bench'
  | 'box'
  | 'med-ball'
  | 'landmine'
  | 'bands'
  | 'bodyweight'

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'h-push'
  | 'v-push'
  | 'h-pull'
  | 'v-pull'
  | 'carry'
  | 'core'
  | 'power'
  | 'isolation'

/** How a set is logged.
 *  weighted: weight × reps · bodyweight: reps (optional added weight) ·
 *  timed: seconds · distance: yards (with weight, e.g. carries). */
export type LogType = 'weighted' | 'bodyweight' | 'timed' | 'distance'

/** Drives weight-availability suggestions (plate/dumbbell jumps). */
export type LoadType = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'bodyweight' | 'band'

export type Exercise = {
  id: string
  name: string
  pattern: Pattern
  primary: MuscleSlug[]
  secondary: MuscleSlug[]
  /** Everything needed (all required). 'bodyweight' alone = no equipment. */
  equipment: Equipment[]
  logType: LogType
  loadType: LoadType
  /** Fraction of body weight moved per rep, counted toward volume (push-up ≈ 0.65). 0 for external-load lifts. */
  bodyweightFactor: number
  unilateral?: boolean
  cues: [string, string, string]
  mistake: string
}
