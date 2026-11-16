import { describe, expect, it } from 'vitest'
import { buildLibrary } from './Library'
import type { Workout } from '../../lib/db'

const item = (ex: string) => ({ slotEx: ex, ex, sets: 3, reps: [8, 10] as [number, number], rest: 90, role: 'secondary' })
const w = (id: string, date: string, exs: string[], extra: Partial<Workout> = {}): Workout => ({
  id,
  date,
  sessionKey: 'athletic-lower-a',
  name: 'Lower A',
  kind: 'lift',
  phase: 'build',
  equipmentProfile: 'gym',
  startedAt: `${date}T17:00:00Z`,
  finishedAt: `${date}T18:00:00Z`,
  plan: exs.map(item),
  ...extra,
})

describe('workout library', () => {
  it('groups repeats of the same lineup and counts them', () => {
    const lib = buildLibrary([w('a', '2026-11-01', ['squat', 'rdl']), w('b', '2026-11-08', ['squat', 'rdl'])])
    expect(lib).toHaveLength(1)
    expect(lib[0]).toMatchObject({ timesDone: 2, firstDate: '2026-11-01', lastDate: '2026-11-08', lastWorkoutId: 'b' })
  })

  it('a swapped or custom exercise makes a new entry; newest first', () => {
    const lib = buildLibrary([w('a', '2026-11-01', ['squat', 'rdl']), w('b', '2026-11-08', ['custom-x', 'rdl'])])
    expect(lib.map((e) => e.lastWorkoutId)).toEqual(['b', 'a'])
  })

  it('skips cardio, unfinished and empty workouts', () => {
    const lib = buildLibrary([
      w('a', '2026-11-01', [], { cardio: { type: 'Run', minutes: 30 } }),
      w('b', '2026-11-02', ['squat'], { finishedAt: undefined }),
      w('c', '2026-11-03', []),
    ])
    expect(lib).toHaveLength(0)
  })
})
