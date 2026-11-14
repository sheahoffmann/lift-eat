// Post-workout story recap: summary → PRs → muscles → fun fact → player card → share.
// Rebuilt from saved data, so any recap can be rewatched from history.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { db, type Workout } from '../../lib/db'
import { exercises } from '../../data/exercises'
import { muscleNames, type MuscleSlug } from '../../anatomy/muscles'
import { AnatomyFigure } from '../../anatomy/AnatomyFigure'
import { intensities, nearMiss, setsPerMuscle, formatSeconds } from '../../lib/training'
import { funFact } from '../../data/funFacts'
import { computeGame, useGameData, xpForWorkout } from '../../lib/game'
import type { Profile } from '../../lib/profile'
import { CountUp, Story } from '../../components/Story'
import { Icon } from '../../components/Icon'
import { prText } from './WorkoutView'
import { renderRunImage, renderWorkoutImage, shareBlob } from '../../lib/shareImage'
import { programs } from '../../data/programs'
import { RunRoute } from '../../components/RunRoute'
import { METERS_PER_MILE, formatPace, formatRunTime, runCalories, type RunPoint } from '../../lib/runMath'

export function WorkoutRecap({ workout, profile, onClose }: { workout: Workout; profile: Profile; onClose: () => void }) {
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(workout.id).toArray(), [workout.id])
  const previous = useLiveQuery(
    async () =>
      (await db.workouts.where('sessionKey').equals(workout.sessionKey).toArray())
        .filter((w) => w.finishedAt && w.id !== workout.id && w.startedAt < workout.startedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null,
    [workout.id],
  )
  const history = useLiveQuery(async () => {
    const ids = [...new Set(workout.plan.map((p) => p.ex))]
    const all = await Promise.all(ids.map((id) => db.sets.where('exerciseId').equals(id).toArray()))
    return all.flat().filter((s) => s.completedAt < workout.startedAt)
  }, [workout.id])
  const data = useGameData()
  const run = useLiveQuery(() => db.runs.where('workoutId').equals(workout.id).first(), [workout.id], undefined)

  const game = useMemo(() => {
    if (!data) return null
    const before = computeGame({ ...data, workouts: data.workouts.filter((w) => w.id !== workout.id), sets: data.sets.filter((s) => s.workoutId !== workout.id) }, profile)
    const after = computeGame(data, profile)
    return { before, after }
  }, [data, workout.id, profile])

  if (!sets || previous === undefined || !history || !game) return null

  const isCardio = !!workout.cardio
  const bw = data?.weighIns.filter((x) => x.lb > 0).at(-1)?.lb ?? (profile.body === 'female' ? 135 : 190)
  const avgPace = run?.distanceM && run.movingSec ? (run.movingSec / run.distanceM) * METERS_PER_MILE : null
  const calories = runCalories(workout.cardio?.distanceMi ?? 0, bw)
  const runStats = [
    { label: 'Distance', value: `${(workout.cardio?.distanceMi ?? 0).toFixed(2)} mi` },
    { label: 'Pace', value: `${formatPace(avgPace)} /mi` },
    { label: 'Time', value: formatRunTime(run?.movingSec ?? workout.durationSec ?? 0) },
  ]
  const volume = Math.round(workout.volume ?? 0)
  const prevVolume = previous?.volume ?? null
  const delta = prevVolume != null ? volume - Math.round(prevVolume) : null

  // Muscles: count completed sets per exercise.
  const perExercise = new Map<string, number>()
  for (const s of sets) perExercise.set(s.exerciseId, (perExercise.get(s.exerciseId) ?? 0) + 1)
  const perMuscle = isCardio
    ? programs[profile.program].week.find((d) => d.key === workout.sessionKey)?.muscles ?? { calves: 1, quadriceps: 0.7, hamstring: 0.7, gluteal: 0.7 }
    : setsPerMuscle([...perExercise].filter(([id]) => exercises[id]).map(([id, n]) => ({ ex: exercises[id], sets: n })))
  const ranked = (Object.entries(perMuscle) as [MuscleSlug, number][]).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const glow = isCardio ? (perMuscle as Partial<Record<MuscleSlug, number>>) : intensities(perMuscle)

  const prs = workout.prs ?? []
  let miss: { name: string; reps: number } | null = null
  if (!prs.length && !isCardio) {
    for (const [id] of perExercise) {
      const ex = exercises[id]
      if (!ex) continue
      const m = nearMiss(ex, sets.filter((s) => s.exerciseId === id), history.filter((h) => h.exerciseId === id), 190)
      if (m && (!miss || m.reps < miss.reps)) miss = { name: ex.name, reps: m.reps }
    }
  }
  const fact = funFact(volume, workout.id)
  const xp = xpForWorkout(workout)
  const { after, before } = game
  const attrUps = (['strength', 'power', 'engine', 'discipline'] as const).filter((k) => after.attributes[k] > before.attributes[k])
  const tierUp = after.tier !== before.tier

  const kicker = (t: string) => <span className="slide-kicker">{t}</span>

  const slides = [
    // 1. Summary
    <div key="sum" className="stack gap-4">
      {kicker(isCardio ? 'Session complete' : 'Workout complete')}
      <h2 className="large-title">{workout.name}</h2>
      {isCardio ? (
        <div className="stats">
          <div className="stat">
            <CountUp value={workout.cardio!.minutes} className="hero-num" />
            <span className="stat__label">minutes</span>
          </div>
          {workout.cardio!.distanceMi ? (
            <div className="stat">
              <CountUp value={workout.cardio!.distanceMi} decimals={1} className="hero-num" />
              <span className="stat__label">miles</span>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="stack gap-1">
            <CountUp value={volume} suffix=" lb" className="hero-num" />
            <span className="sub">total volume</span>
          </div>
          <div className="card stats">
            <div className="stat">
              <span className="stat__value num">{formatSeconds(workout.durationSec ?? 0)}</span>
              <span className="stat__label">duration</span>
            </div>
            <div className="stat">
              <span className="stat__value num">{workout.setsDone}</span>
              <span className="stat__label">sets</span>
            </div>
            <div className="stat">
              <span className="stat__value num">{perExercise.size}</span>
              <span className="stat__label">exercises</span>
            </div>
          </div>
          {delta != null && (
            <span className={`chip ${delta >= 0 ? 'chip--accent' : ''}`} style={{ alignSelf: 'flex-start' }}>
              {delta >= 0 ? '+' : ''}
              {delta.toLocaleString()} lb vs. last {workout.name.replace(': Refresh', '')}
            </span>
          )}
        </>
      )}
      {isCardio && <p className="sub">{workout.cardio!.type}{workout.cardio!.mobility ? ' + mobility' : ''}</p>}
    </div>,

    // Run route + splits (GPS or imported runs)
    ...(run && run.points.length > 1
      ? [
          <div key="route" className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-3)' }}>
            {runStats.map((s, k) => (
              <motion.div key={s.label} className="stack" style={{ gap: 0 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * k }}>
                <span className="sub" style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {s.label}
                </span>
                <span className="num" style={{ fontSize: 'clamp(2.2rem, 11vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
                  {s.value}
                </span>
              </motion.div>
            ))}
            <div style={{ width: '78%', marginTop: 'var(--s-2)' }}>
              <RunRoute points={run.points as RunPoint[]} height={210} label={`Route of your ${(workout.cardio?.distanceMi ?? 0).toFixed(2)} mile run`} />
            </div>
            <span className="caption" style={{ fontWeight: 800, letterSpacing: '0.12em' }}>
              GRIT
            </span>
          </div>,
          <div key="splits" className="stack gap-4">
            {kicker('Splits')}
            <div className="card stats">
              <div className="stat">
                <span className="stat__value num">{formatPace(avgPace)}</span>
                <span className="stat__label">avg /mi</span>
              </div>
              <div className="stat">
                <span className="stat__value num">{calories}</span>
                <span className="stat__label">kcal</span>
              </div>
              <div className="stat">
                <span className="stat__value num">{Math.round((run.elevGainM ?? 0) * 3.281)}</span>
                <span className="stat__label">ft gain</span>
              </div>
            </div>
            {(run.splits?.length ?? 0) === 0 && <p className="sub">Splits appear on runs longer than a mile.</p>}
            {(run.splits?.length ?? 0) > 0 && (
              <div className="stack gap-2">
                {run.splits!.map((s, i) => (
                  <div key={i} className="hbar">
                    <span>Mile {i + 1}</span>
                    <div className="hbar__track">
                      <motion.div className="hbar__fill" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(...run.splits!) / s }} transition={{ delay: 0.1 + i * 0.06 }} />
                    </div>
                    <span className="num caption" style={{ textAlign: 'right', minWidth: 40 }}>
                      {formatPace(s)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>,
        ]
      : []),

    // 2. PRs / near miss
    ...(!isCardio
      ? [
          <div key="pr" className="stack gap-4">
            {kicker(prs.length ? `${prs.length} new PR${prs.length > 1 ? 's' : ''}` : 'Records')}
            {prs.length ? (
              prs.map((pr, k) => {
                const t = prText(pr)
                return (
                  <motion.div key={k} className="card" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 * k }}>
                    <div className="card-row">
                      <div className="stack">
                        <span style={{ fontWeight: 700 }}>{exercises[pr.exerciseId]?.name}</span>
                        <span className="caption">{pr.kind === 'e1rm' ? 'Estimated 1RM' : pr.kind === 'reps' ? 'Rep PR' : pr.kind === 'duration' ? 'Longest hold' : 'Weight PR'}</span>
                      </div>
                      <div className="stack" style={{ alignItems: 'flex-end' }}>
                        <span className="title2 num accent">{t.value}</span>
                        {t.previous && <span className="caption num">was {t.previous}</span>}
                      </div>
                    </div>
                  </motion.div>
                )
              })
            ) : miss ? (
              <>
                <h2 className="title1">
                  {miss.reps} rep{miss.reps > 1 ? 's' : ''} away from a {miss.name} PR
                </h2>
                <p className="sub">Next time. The cue on that exercise will show you the number to beat.</p>
              </>
            ) : (
              <>
                <h2 className="title1">{history.length ? 'Baseline banked' : 'First session logged'}</h2>
                <p className="sub">{history.length ? 'No PRs today, but the work counts. Consistency is the long game.' : 'These numbers are your starting line. Every PR from here is measured against today.'}</p>
              </>
            )}
          </div>,
        ]
      : []),

    // 3. Muscles
    <div key="mus" className="stack gap-4">
      {kicker('Muscles worked')}
      <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-5)' }}>
        <AnatomyFigure body={profile.body} side="front" muscles={glow} height={230} />
        <AnatomyFigure body={profile.body} side="back" muscles={glow} height={230} />
      </div>
      {!isCardio && (
        <div className="stack gap-2">
          {ranked.map(([m, v], k) => (
            <div key={m} className="hbar">
              <span>{muscleNames[m]}</span>
              <div className="hbar__track">
                <motion.div className="hbar__fill" initial={{ scaleX: 0 }} animate={{ scaleX: v / ranked[0][1] }} transition={{ delay: 0.1 + k * 0.06, type: 'spring', stiffness: 120, damping: 20 }} />
              </div>
              <span className="num caption" style={{ textAlign: 'right' }}>
                {Number.isInteger(v) ? v : v.toFixed(1)}
              </span>
            </div>
          ))}
          <span className="caption">Sets per muscle. Secondary muscles count as half.</span>
        </div>
      )}
    </div>,

    // 4. Fun fact
    ...(fact && !isCardio
      ? [
          <div key="fact" className="stack gap-4" style={{ textAlign: 'center', alignItems: 'center' }}>
            {kicker('Fun fact')}
            <span className="sub">You moved</span>
            <CountUp value={volume} suffix=" lb" className="hero-num" />
            <h2 className="title1" style={{ maxWidth: 340 }}>
              {fact.text}
            </h2>
            <span className="caption">Includes an estimate of body weight moved on bodyweight exercises.</span>
          </div>,
        ]
      : []),

    // 5. Player card
    <div key="card" className="stack gap-4">
      {kicker('Player card')}
      <div className="row" style={{ gap: 'var(--s-4)' }}>
        <div className={`player__badge player__badge--${after.tier}`} style={{ width: 96, height: 118 }} aria-hidden>
          <CountUp value={after.attributes.ovr} className="player__ovr" style={{ fontSize: '2.6rem' }} />
          <span className="player__pos">OVR</span>
        </div>
        <div className="stack gap-1">
          <span className="title2">+{xp} XP</span>
          <span className="sub">
            Level {after.level.level} · {after.level.title}
          </span>
          {tierUp && <span className="chip chip--accent">Upgraded to {after.tier}</span>}
        </div>
      </div>
      <div className="stack gap-1">
        <div className="bar" style={{ height: 10 }}>
          <motion.div className="bar__fill" initial={{ scaleX: Math.min(1, Math.max(0, (after.level.into - xp) / after.level.need)) }} animate={{ scaleX: Math.min(1, after.level.into / after.level.need) }} transition={{ delay: 0.3, duration: 1.2 }} />
        </div>
        <span className="caption num">
          {after.level.into.toLocaleString()} / {after.level.need.toLocaleString()} XP to level {after.level.level + 1}
        </span>
      </div>
      <div className="player__attrs" style={{ marginTop: 0 }}>
        {(['strength', 'power', 'engine', 'discipline'] as const).map((k) => (
          <div key={k} className="stack" style={{ gap: 2 }}>
            <span className="stat__value num" style={{ fontSize: 'var(--fs-title1)' }}>
              {after.attributes[k]}
            </span>
            <span className="caption" style={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              {k.slice(0, 3).toUpperCase()}
              {attrUps.includes(k) && <span className="accent"> +{after.attributes[k] - before.attributes[k]}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>,

    // 6. Share
    <div key="share" className="stack gap-4" style={{ alignItems: 'center', textAlign: 'center' }}>
      {kicker('Share')}
      <h2 className="title1">Nice work.</h2>
      <p className="sub">One clean image with your stats, PRs and muscles worked.</p>
      <button
        className="btn btn--primary btn--block"
        style={{ position: 'relative', zIndex: 5 }}
        onClick={async (e) => {
          e.stopPropagation()
          if (run && run.points.length > 1) {
            const rb = await renderRunImage({
              stats: [runStats[0], (run.elevGainM ?? 0) > 5 ? { label: "Elev Gain", value: `${Math.round((run.elevGainM ?? 0) * 3.281)} ft` } : runStats[1], runStats[2]],
              route: run.points as RunPoint[],
            })
            if (rb) await shareBlob(rb, "grit-run.png", workout.name)
            return
          }
          const blob = await renderWorkoutImage({
            title: workout.name.replace(': Refresh', ''),
            date: new Date(workout.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            stats: isCardio
              ? [
                  { label: 'minutes', value: String(workout.cardio!.minutes) },
                  { label: 'type', value: workout.cardio!.type.split(' ')[0] },
                ]
              : [
                  { label: 'volume (lb)', value: volume.toLocaleString() },
                  { label: 'sets', value: String(workout.setsDone ?? 0) },
                  { label: 'time', value: formatSeconds(workout.durationSec ?? 0) },
                ],
            prs: prs.map((pr) => `${exercises[pr.exerciseId]?.name ?? ''} ${prText(pr).value}`),
            body: profile.body,
            muscles: glow,
            route: run && run.points.length > 1 ? (run.points as RunPoint[]) : undefined,
            splits: run?.splits?.map((s, i) => `Mile ${i + 1}   ${formatPace(s)}`),
            footer: fact && !isCardio ? `≈ ${fact.count} ${fact.count === 1 ? fact.object.one : fact.object.many}` : `${after.attributes.ovr} OVR · Level ${after.level.level}`,
          })
          if (blob) await shareBlob(blob, 'grit-workout.png', workout.name)
        }}
      >
        <Icon name="share" size={18} /> Share image
      </button>
    </div>,
  ]

  return <Story slides={slides} onClose={onClose} />
}
