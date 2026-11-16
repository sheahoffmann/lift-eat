import { describe, expect, it } from 'vitest'
import { toExercise } from './customExercises'
import { draftToFields } from '../screens/train/ExerciseFields'

describe('custom exercises', () => {
  it('carry main + supporting muscles and their own cues', () => {
    const ex = toExercise({ id: 'custom-1', name: 'Hack Squat', logType: 'weighted', primary: ['quadriceps'], secondary: ['gluteal', 'quadriceps'], cues: ['a', 'b', 'c'], mistake: 'm', createdAt: '' })
    expect(ex.primary).toEqual(['quadriceps'])
    expect(ex.secondary).toEqual(['gluteal']) // never repeats a main muscle
    expect(ex.cues).toEqual(['a', 'b', 'c'])
    expect(ex.mistake).toBe('m')
  })

  it('falls back to generic cues when they are blank', () => {
    const ex = toExercise({ id: 'custom-2', name: 'X', logType: 'bodyweight', primary: [], createdAt: '' })
    expect(ex.cues[0]).toBe('Your own exercise.')
    expect(ex.loadType).toBe('bodyweight')
  })

  it('form drafts drop half-filled cues and duplicate muscles', () => {
    const f = draftToFields({ name: ' Hack ', logType: 'weighted', primary: ['quadriceps'], secondary: ['quadriceps', 'gluteal'], cues: ['a', '', 'c'], mistake: ' ' })
    expect(f).toMatchObject({ name: 'Hack', secondary: ['gluteal'], cues: undefined, mistake: undefined })
  })
})
