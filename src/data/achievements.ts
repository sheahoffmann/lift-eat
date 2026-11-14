// Collectible achievement cards. Each has a metric + target (see lib/game.ts).
import type { IconName } from '../components/Icon'
import type { ProgramId } from './programs'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export type AchievementDef = {
  id: string
  name: string
  desc: string
  metric: string
  target: number
  rarity: Rarity
  icon: IconName
  program?: ProgramId
}

export const achievementDefs: AchievementDef[] = [
  { id: 'first-workout', name: 'Opening Day', desc: 'Finish your first workout.', metric: 'workouts', target: 1, rarity: 'common', icon: 'play' },
  { id: 'workouts-10', name: 'Regular', desc: 'Finish 10 workouts.', metric: 'workouts', target: 10, rarity: 'common', icon: 'train' },
  { id: 'workouts-25', name: 'Rotation Player', desc: 'Finish 25 workouts.', metric: 'workouts', target: 25, rarity: 'rare', icon: 'train' },
  { id: 'workouts-50', name: 'Iron Man', desc: 'Finish 50 workouts.', metric: 'workouts', target: 50, rarity: 'epic', icon: 'train' },
  { id: 'workouts-100', name: 'Century Club', desc: 'Finish 100 workouts.', metric: 'workouts', target: 100, rarity: 'legendary', icon: 'trophy' },
  { id: 'first-pr', name: 'Personal Best', desc: 'Hit your first PR.', metric: 'prs', target: 1, rarity: 'common', icon: 'bolt' },
  { id: 'prs-10', name: 'Record Breaker', desc: 'Hit 10 PRs.', metric: 'prs', target: 10, rarity: 'rare', icon: 'bolt' },
  { id: 'prs-50', name: 'Record Book', desc: 'Hit 50 PRs.', metric: 'prs', target: 50, rarity: 'epic', icon: 'bolt' },
  { id: 'streak-4', name: 'Four-Week Run', desc: '4-week streak.', metric: 'streak', target: 4, rarity: 'rare', icon: 'flame' },
  { id: 'streak-8', name: 'Hot Streak', desc: '8-week streak.', metric: 'streak', target: 8, rarity: 'epic', icon: 'flame' },
  { id: 'streak-12', name: 'Full Season', desc: '12-week streak.', metric: 'streak', target: 12, rarity: 'legendary', icon: 'flame' },
  { id: 'plan-4', name: 'Game Planner', desc: 'Plan 4 weeks in a row.', metric: 'planWeeks', target: 4, rarity: 'rare', icon: 'cart' },
  { id: 'lost-5', name: 'Down 5', desc: 'Lose 5 lb (7-day average).', metric: 'lost', target: 5, rarity: 'common', icon: 'scale' },
  { id: 'lost-10', name: 'Down 10', desc: 'Lose 10 lb.', metric: 'lost', target: 10, rarity: 'rare', icon: 'scale' },
  { id: 'lost-15', name: 'Down 15', desc: 'Lose 15 lb.', metric: 'lost', target: 15, rarity: 'epic', icon: 'scale' },
  { id: 'lost-20', name: 'Down 20', desc: 'Lose 20 lb.', metric: 'lost', target: 20, rarity: 'legendary', icon: 'scale' },
  { id: 'weigh-30', name: 'On the Scale', desc: 'Log 30 weigh-ins.', metric: 'weighIns', target: 30, rarity: 'rare', icon: 'scale' },
  { id: 'protein-7', name: 'Fueled', desc: 'Hit protein on 7 days.', metric: 'proteinDays', target: 7, rarity: 'common', icon: 'eat' },
  { id: 'protein-30', name: 'Built Different', desc: 'Hit protein on 30 days.', metric: 'proteinDays', target: 30, rarity: 'epic', icon: 'eat' },
  { id: 'cardio-10', name: 'Engine Room', desc: '10 conditioning sessions.', metric: 'cardio', target: 10, rarity: 'rare', icon: 'run' },
  { id: 'preseason', name: 'Preseason Done', desc: 'Complete Preseason.', metric: 'preseason', target: 1, rarity: 'rare', icon: 'sparkle' },
  { id: 'bench-225', name: 'Two Plates', desc: 'Bench 225 lb.', metric: 'bench', target: 225, rarity: 'epic', icon: 'trophy', program: 'athletic' },
  { id: 'squat-315', name: 'Three Plates', desc: 'Squat 315 lb.', metric: 'squat', target: 315, rarity: 'epic', icon: 'trophy', program: 'athletic' },
  { id: 'deadlift-405', name: 'Four Plates', desc: 'Trap bar deadlift 405 lb.', metric: 'trapbar', target: 405, rarity: 'legendary', icon: 'trophy', program: 'athletic' },
  { id: 'pullup-45', name: 'Plate on the Belt', desc: 'Pull-up with +45 lb.', metric: 'pullupAdded', target: 45, rarity: 'epic', icon: 'trophy', program: 'athletic' },
  { id: 'thrust-1x', name: 'Bodyweight Thrust', desc: 'Hip thrust your body weight.', metric: 'hipThrustRatio', target: 1, rarity: 'rare', icon: 'trophy', program: 'glute' },
  { id: 'thrust-1-5x', name: 'Glute Queen', desc: 'Hip thrust 1.5× body weight.', metric: 'hipThrustRatio', target: 1.5, rarity: 'epic', icon: 'trophy', program: 'glute' },
  { id: 'thrust-2x', name: 'Double Bodyweight', desc: 'Hip thrust 2× body weight.', metric: 'hipThrustRatio', target: 2, rarity: 'legendary', icon: 'trophy', program: 'glute' },
]
