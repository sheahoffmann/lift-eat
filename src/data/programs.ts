// Programs: weekly split with full prescriptions (sets, reps, rest), plus
// phase scaling (Refresh week, Preseason) and home/travel substitutes.
//
// Schedule: both train together Sun, Wed, Thu, Fri; Saturday is a shared
// cardio day. Athletic Strength adds Monday (Upper A) for 6 days; Tuesday rest.
import type { MuscleSlug } from '../anatomy/muscles'

export type ProgramId = 'athletic' | 'glute'
export type SessionKind = 'lift' | 'run' | 'sprint' | 'rest' | 'optional'
export type Role = 'power' | 'heavy' | 'secondary' | 'accessory'

export type Prescription = {
  ex: string
  sets: number
  reps: [number, number]
  role: Role
  rest: number // seconds
  perSide?: boolean
  seconds?: number // timed holds
  yards?: number // carries
  /** Equipment-free alternative for the "Home" profile. */
  home?: string
}

export type SessionSummary = {
  key: string // stable session id (history is keyed by this)
  short: string
  name: string
  kind: SessionKind
  minutes: [number, number]
  exercises: Prescription[]
  /** Planned working sets per exercise (derived). */
  sets: number[]
  muscles: Partial<Record<MuscleSlug, number>>
  focus: string
  cardio?: { types: string[]; note: string }
}

export type Program = {
  id: ProgramId
  name: string
  tagline: string
  body: 'male' | 'female'
  calories: number
  protein: number
  daysPerWeek: number
  week: SessionSummary[] // index 0 = Sunday
}

const REST = { power: 120, heavy: 180, secondary: 150, accessory: 75 } as const

const p = (ex: string, sets: number, reps: [number, number] | number, role: Role, extra: Partial<Prescription> = {}): Prescription => ({
  ex,
  sets,
  reps: typeof reps === 'number' ? [reps, reps] : reps,
  role,
  rest: REST[role],
  ...extra,
})

function session(s: Omit<SessionSummary, 'sets'>): SessionSummary {
  return { ...s, sets: s.exercises.map((e) => e.sets) }
}

const rest = (key: string, focus = 'Recover. Walk if you feel like it.'): SessionSummary =>
  session({ key, short: 'Rest', name: 'Rest day', kind: 'rest', minutes: [0, 0], exercises: [], muscles: {}, focus })

// ---------- Athletic Strength ----------

const lowerA = session({
  key: 'athletic-lower-a',
  short: 'Lower A',
  name: 'Lower A',
  kind: 'lift',
  minutes: [60, 70],
  focus: 'Box jump, back squat, RDL',
  muscles: { quadriceps: 1, gluteal: 1, hamstring: 0.8, adductors: 0.5, abs: 0.5, 'lower-back': 0.4, calves: 0.3 },
  exercises: [
    p('box-jump', 3, 3, 'power'),
    p('back-squat', 4, [4, 6], 'heavy'),
    p('romanian-deadlift', 3, [6, 8], 'secondary'),
    p('bulgarian-split-squat', 3, 8, 'secondary', { perSide: true }),
    p('lying-leg-curl', 3, 10, 'accessory'),
    p('ab-wheel', 3, 10, 'accessory'),
  ],
})

const upperA = session({
  key: 'athletic-upper-a',
  short: 'Upper A',
  name: 'Upper A',
  kind: 'lift',
  minutes: [65, 75],
  focus: 'Med ball throw, bench, weighted pull-up',
  muscles: { chest: 1, 'upper-back': 1, deltoids: 0.9, triceps: 0.7, biceps: 0.7, obliques: 0.5, trapezius: 0.4, forearm: 0.3 },
  exercises: [
    p('med-ball-rotational-throw', 3, 5, 'power', { perSide: true }),
    p('bench-press', 4, [5, 6], 'heavy'),
    p('weighted-pull-up', 4, [5, 8], 'heavy'),
    p('overhead-press', 3, 8, 'secondary'),
    p('chest-supported-row', 3, 10, 'accessory'),
    p('lateral-raise', 3, 15, 'accessory'),
    p('db-curl', 2, 12, 'accessory'),
    p('triceps-pushdown', 2, 12, 'accessory'),
  ],
})

const lowerB = session({
  key: 'athletic-lower-b',
  short: 'Lower B',
  name: 'Lower B',
  kind: 'lift',
  minutes: [60, 70],
  focus: 'Lateral bound, trap bar deadlift, front squat',
  muscles: { gluteal: 1, quadriceps: 0.9, hamstring: 0.8, calves: 0.7, forearm: 0.6, trapezius: 0.6, 'lower-back': 0.5, adductors: 0.5, abs: 0.4 },
  exercises: [
    p('lateral-bound', 3, 4, 'power', { perSide: true }),
    p('trap-bar-deadlift', 4, [4, 6], 'heavy'),
    p('front-squat', 3, [8, 10], 'secondary'),
    p('walking-lunge', 3, 10, 'secondary', { perSide: true }),
    p('single-leg-rdl', 3, 8, 'accessory', { perSide: true }),
    p('standing-calf-raise', 3, 12, 'accessory'),
    p('farmer-carry', 3, 1, 'accessory', { yards: 40 }),
  ],
})

const upperB = session({
  key: 'athletic-upper-b',
  short: 'Upper B',
  name: 'Upper B',
  kind: 'lift',
  minutes: [60, 70],
  focus: 'Plyo push-up, incline DB press, pulldown',
  muscles: { chest: 1, deltoids: 1, 'upper-back': 0.9, triceps: 0.7, biceps: 0.7, trapezius: 0.4 },
  exercises: [
    p('plyo-push-up', 3, 5, 'power'),
    p('incline-db-press', 4, [8, 10], 'secondary'),
    p('lat-pulldown', 3, 10, 'secondary'),
    p('landmine-press', 3, 8, 'secondary', { perSide: true }),
    p('seated-cable-row', 3, 12, 'accessory'),
    p('rear-delt-fly', 3, 15, 'accessory'),
    p('db-curl', 2, 12, 'accessory'),
    p('triceps-pushdown', 2, 12, 'accessory'),
  ],
})

const conditioning = session({
  key: 'athletic-conditioning',
  short: 'Engine',
  name: 'Conditioning + Mobility',
  kind: 'run',
  minutes: [35, 50],
  focus: '25–40 min easy cardio at the gym, then 10 min mobility',
  muscles: { calves: 0.6, quadriceps: 0.5, hamstring: 0.4, gluteal: 0.4 },
  exercises: [],
  cardio: { types: ['Incline treadmill', 'Bike', 'Rower', 'Stair climber', 'Easy run', 'Ruck'], note: 'Conversational pace, then 10 min mobility.' },
})

const speed = session({
  key: 'athletic-speed',
  short: 'Speed',
  name: 'Sprints + Agility',
  kind: 'sprint',
  minutes: [40, 55],
  focus: 'Easy partner run as warm-up, then 6–8 × 20–40 m sprints, 5-10-5 shuttles, cones',
  muscles: { hamstring: 1, gluteal: 0.9, calves: 0.8, quadriceps: 0.7, adductors: 0.5, abs: 0.3 },
  exercises: [],
  cardio: { types: ['Sprints + agility'], note: 'Full rest between sprints. Quality over quantity.' },
})

// ---------- Glute Builder ----------

const glutesA = session({
  key: 'glute-a',
  short: 'Glutes A',
  name: 'Glutes + Hamstrings',
  kind: 'lift',
  minutes: [50, 60],
  focus: 'Hip thrust, Romanian deadlift, kickbacks',
  muscles: { gluteal: 1, hamstring: 0.9, adductors: 0.4, 'lower-back': 0.4, abs: 0.3 },
  exercises: [
    p('hip-thrust', 3, [10, 12], 'heavy', { home: 'single-leg-glute-bridge' }),
    p('romanian-deadlift', 3, 10, 'secondary', { home: 'bw-single-leg-rdl' }),
    p('cable-kickback', 3, 12, 'accessory', { perSide: true, home: 'donkey-kick' }),
    p('seated-leg-curl', 3, 12, 'accessory', { home: 'bw-glute-bridge' }),
    p('hip-abduction-machine', 3, 15, 'accessory', { home: 'fire-hydrant' }),
    p('dead-bug', 2, 10, 'accessory', { perSide: true, home: 'dead-bug' }),
  ],
})

const glutesB = session({
  key: 'glute-b',
  short: 'Glutes B',
  name: 'Glutes + Quads',
  kind: 'lift',
  minutes: [50, 60],
  focus: 'Goblet squat, split squat, leg press',
  muscles: { gluteal: 1, quadriceps: 0.9, adductors: 0.5, hamstring: 0.4, calves: 0.2 },
  exercises: [
    p('goblet-squat', 3, [10, 12], 'secondary', { home: 'bw-squat' }),
    p('bulgarian-split-squat', 3, [8, 10], 'secondary', { perSide: true, home: 'bw-split-squat' }),
    p('leg-press', 3, 12, 'secondary', { home: 'wall-sit' }),
    p('db-step-up', 3, 10, 'accessory', { perSide: true, home: 'bw-step-up' }),
    p('hip-abduction-machine', 3, 15, 'accessory', { home: 'fire-hydrant' }),
  ],
})

const gluteUpper = session({
  key: 'glute-upper',
  short: 'Upper',
  name: 'Upper + Glute',
  kind: 'lift',
  minutes: [45, 55],
  focus: 'Pulldown, DB press, rows, glute bridge',
  muscles: { 'upper-back': 1, chest: 0.8, deltoids: 0.8, gluteal: 0.6, triceps: 0.5, biceps: 0.5, abs: 0.4 },
  exercises: [
    p('lat-pulldown', 3, [10, 12], 'secondary', { home: 'superman' }),
    p('db-bench-press', 3, [10, 12], 'secondary', { home: 'incline-push-up' }),
    p('seated-cable-row', 3, 12, 'accessory', { home: 'superman' }),
    p('db-shoulder-press', 3, [10, 12], 'accessory', { home: 'pike-push-up' }),
    p('glute-bridge', 2, 15, 'accessory', { home: 'bw-glute-bridge' }),
    p('plank', 2, 1, 'accessory', { seconds: 30, home: 'plank' }),
  ],
})

const glutePump = session({
  key: 'glute-pump',
  short: 'Pump',
  name: 'Glute Pump + Upper',
  kind: 'lift',
  minutes: [45, 55],
  focus: 'Pull-through, single-leg thrust, assisted pull-up',
  muscles: { gluteal: 1, 'upper-back': 0.8, deltoids: 0.6, chest: 0.6, hamstring: 0.5, biceps: 0.4 },
  exercises: [
    p('cable-pull-through', 3, 12, 'secondary', { home: 'bw-glute-bridge' }),
    p('single-leg-hip-thrust', 3, 10, 'accessory', { perSide: true, home: 'single-leg-glute-bridge' }),
    p('assisted-pull-up', 3, 8, 'secondary', { home: 'superman' }),
    p('incline-db-press', 3, 10, 'accessory', { home: 'push-up' }),
    p('lateral-raise', 2, 15, 'accessory', { home: 'pike-push-up' }),
    p('frog-pump', 2, 20, 'accessory', { home: 'frog-pump' }),
  ],
})

const gluteWalk = session({
  key: 'glute-walk',
  short: 'Walk',
  name: 'Optional Walk',
  kind: 'optional',
  minutes: [20, 30],
  focus: 'Optional: an easy walk, any pace',
  muscles: { calves: 0.5, gluteal: 0.3, hamstring: 0.3, quadriceps: 0.3 },
  exercises: [],
  cardio: { types: ['Walk', 'Incline walk', 'Bike'], note: 'Optional. Any easy movement counts.' },
})

const gluteRun = session({
  key: 'glute-run',
  short: 'Run',
  name: 'Easy Run or Walk',
  kind: 'optional',
  minutes: [25, 40],
  focus: 'Run or walk together, conversational pace',
  muscles: { calves: 0.6, quadriceps: 0.4, hamstring: 0.4, gluteal: 0.4 },
  exercises: [],
  cardio: { types: ['Easy run', 'Run/walk', 'Long walk', 'Hike'], note: 'Walk breaks are fine. Enjoy it.' },
})

export const programs: Record<ProgramId, Program> = {
  athletic: {
    id: 'athletic',
    name: 'Athletic Strength',
    tagline: 'Power, strength and speed. 6 days.',
    body: 'male',
    calories: 2250,
    protein: 190,
    daysPerWeek: 6,
    //     Sun     Mon     Tue                    Wed     Thu     Fri           Sat
    week: [lowerA, upperA, rest('athletic-rest'), lowerB, upperB, conditioning, speed],
  },
  glute: {
    id: 'glute',
    name: 'Glute Builder',
    tagline: 'Lean, strong, glute-focused. 4 days.',
    body: 'female',
    calories: 1800,
    protein: 125,
    daysPerWeek: 4,
    //     Sun      Mon                Tue        Wed      Thu         Fri        Sat
    week: [glutesA, rest('glute-rest'), gluteWalk, glutesB, gluteUpper, glutePump, gluteRun],
  },
}

export type Phase = 'refresh' | 'preseason' | 'cut' | 'build'

const easyRun = (key: string, name: string, minutes: [number, number], focus: string): SessionSummary =>
  session({
    key,
    short: 'Run',
    name,
    kind: 'run',
    minutes,
    focus,
    muscles: { calves: 0.6, hamstring: 0.5, quadriceps: 0.4, gluteal: 0.4 },
    exercises: [],
    cardio: { types: ['Easy run', 'Run/walk', 'Walk', 'Bike'], note: focus },
  })

/** Sets for a prescription in a phase. */
export function phaseSets(_role: Role, sets: number, phase: Phase) {
  if (phase === 'refresh') return 2
  if (phase === 'preseason') return Math.max(2, Math.ceil(sets / 2))
  return sets
}

/** Reps-in-reserve guidance per phase. */
export function effortCue(phase: Phase) {
  if (phase === 'refresh') return 'Light weights. Finish every set feeling like you could do 5 more.'
  if (phase === 'preseason') return 'Stop 3–4 reps short of failure.'
  return 'Stop 1–3 reps short of failure.'
}

/** The session for a weekday with phase adjustments applied (exercise list, sets, cardio swaps). */
export function sessionFor(program: Program, day: number, phase: Phase): SessionSummary {
  const s = program.week[day]
  if (s.kind === 'lift') {
    const list = phase === 'refresh' ? s.exercises.slice(0, 4) : s.exercises
    const exercises = list.map((e) => ({ ...e, sets: phaseSets(e.role, e.sets, phase) }))
    return {
      ...s,
      name: phase === 'refresh' ? `${s.name}: Refresh` : s.name,
      minutes: phase === 'refresh' ? [30, 40] : phase === 'preseason' ? [Math.round(s.minutes[0] * 0.75), Math.round(s.minutes[1] * 0.75)] : s.minutes,
      exercises,
      sets: exercises.map((e) => e.sets),
    }
  }
  if (phase === 'refresh' && (s.kind === 'sprint' || s.kind === 'run')) {
    return easyRun(s.key, s.kind === 'sprint' ? 'Easy Run Together' : 'Easy Cardio', [20, 30], 'Easy pace. Just get moving.')
  }
  if (phase === 'refresh' && s.kind === 'optional') {
    return { ...s, minutes: [20, 30], focus: 'Easy pace, walk breaks welcome.' }
  }
  if (phase === 'preseason' && s.kind === 'sprint') {
    return easyRun(s.key, 'Easy Run + Strides', [30, 40], 'Easy run together, then 4–6 relaxed strides')
  }
  return s
}

/** Total planned working sets (phase already applied by sessionFor). */
export function plannedSets(s: SessionSummary, _phase?: Phase) {
  return s.sets.reduce((a, b) => a + b, 0)
}

export const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** All sessions a user can pick from, Sunday first (matches the schedule). */
export function allSessions(program: Program) {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day: d, session: program.week[d] })).filter((x) => x.session.kind !== 'rest')
}
