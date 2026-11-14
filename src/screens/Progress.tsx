import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import type { Profile } from '../lib/profile'
import { saveProfile, todayISO } from '../lib/profile'
import { db } from '../lib/db'
import { programs } from '../data/programs'
import { exercises } from '../data/exercises'
import { muscleNames, type MuscleSlug } from '../anatomy/muscles'
import { AnatomyFigure } from '../anatomy/AnatomyFigure'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { LineChart } from '../components/LineChart'
import { PlayerCard } from '../components/PlayerCard'
import { haptic } from '../lib/haptics'
import { logWaist, movingAverage, useWeighIns } from '../lib/weighins'
import { addDaysISO, bestE1RM, useGame, weekStart } from '../lib/game'
import { computeCheckIn } from '../lib/checkin'
import { phaseOf } from '../lib/workoutStore'
import { e1rm, effectiveLoad, intensities, setsPerMuscle } from '../lib/training'
import { showWeekly } from '../lib/ui'
import { renderCardImage, shareBlob } from '../lib/shareImage'
import { Settings } from './progress/Settings'

const trendLifts: Record<string, string[]> = {
  athletic: ['back-squat', 'trap-bar-deadlift', 'bench-press', 'weighted-pull-up', 'overhead-press', 'incline-db-press'],
  glute: ['hip-thrust', 'romanian-deadlift', 'goblet-squat', 'leg-press', 'db-bench-press', 'lat-pulldown'],
}

export function Progress({ profile }: { profile: Profile }) {
  const game = useGame(profile)
  const weighIns = useWeighIns()
  const snaps = useLiveQuery(() => db.attributes.orderBy('date').toArray(), [], [])
  const checkinsDone = useLiveQuery(() => db.xp.where('reason').equals('Weekly check-in').toArray(), [], [])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [binder, setBinder] = useState(false)
  const [waist, setWaist] = useState('')

  const avg = movingAverage(weighIns)
  const phase = phaseOf(profile)
  const checkin = computeCheckIn(weighIns, phase === 'build' ? 'build' : 'cut')
  const checkinDone = checkin && checkinsDone.some((x) => x.id === `checkin:${checkin.weekStart}`)
  const thisWeek = weekStart(todayISO())
  const waistThisWeek = weighIns.find((w) => w.date >= thisWeek && w.waist)
  const waists = weighIns.filter((w) => w.waist).map((w) => ({ date: w.date, value: w.waist! }))

  const strength = useMemo(() => {
    if (!game) return []
    const bw = weighIns.filter((w) => w.lb > 0).at(-1)?.lb ?? 180
    return trendLifts[profile.program]
      .map((id) => {
        const ex = exercises[id]
        const byDate = new Map<string, number>()
        for (const s of game.data.sets.filter((x) => x.exerciseId === id)) {
          const v = e1rm(effectiveLoad(ex, s.weight, s.bodyweight ?? bw), s.reps)
          byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, v))
        }
        const points = [...byDate].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value: Math.round(value) }))
        return { id, name: ex?.name ?? id, points, best: Math.round(bestE1RM(game.data.sets, id, bw)) }
      })
      .filter((x) => x.points.length)
  }, [game, profile.program, weighIns])

  const balance = useMemo(() => {
    if (!game) return null
    const end = addDaysISO(thisWeek, 6)
    const week = game.data.sets.filter((s) => s.date >= thisWeek && s.date <= end)
    const per = new Map<string, number>()
    for (const s of week) per.set(s.exerciseId, (per.get(s.exerciseId) ?? 0) + 1)
    const m = setsPerMuscle([...per].filter(([id]) => exercises[id]).map(([id, n]) => ({ ex: exercises[id], sets: n })))
    return { per: m, ranked: (Object.entries(m) as [MuscleSlug, number][]).sort((a, b) => b[1] - a[1]) }
  }, [game, thisWeek])

  if (!game) return <main className="screen" aria-busy="true" />

  const unlocked = game.achievements.filter((a) => a.unlocked).length
  const attrColors = { strength: 'var(--accent)', power: 'var(--ring-fuel)', engine: 'var(--ring-log)', discipline: 'var(--text-2)' }

  return (
    <main className="screen">
      <header className="card-row" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-1">
          <span className="eyebrow">Your season so far</span>
          <h1 className="large-title">Progress</h1>
        </div>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
          <Icon name="gear" size={20} />
        </button>
      </header>

      <PlayerCard
        stats={{
          name: profile.name,
          ovr: game.attributes.ovr,
          tier: game.tier,
          level: game.level.level,
          levelTitle: game.level.title,
          xp: game.level.into,
          xpToNext: game.level.need,
          attributes: game.attributes,
        }}
      />
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button
          className="btn btn--secondary btn--sm"
          style={{ flex: 1 }}
          onClick={async () => {
            const b = await renderCardImage({
              name: profile.name,
              ovr: game.attributes.ovr,
              tier: game.tier,
              level: `Level ${game.level.level} · ${game.level.title}`,
              attrs: [
                ['STR', game.attributes.strength],
                ['PWR', game.attributes.power],
                ['ENG', game.attributes.engine],
                ['DIS', game.attributes.discipline],
              ],
              body: profile.body,
            })
            if (b) shareBlob(b, 'grit-card.png', 'My player card')
          }}
        >
          <Icon name="share" size={15} /> Share card
        </button>
        <button className="btn btn--secondary btn--sm" style={{ flex: 1 }} onClick={() => showWeekly(true)}>
          <Icon name="play" size={13} /> Last week's recap
        </button>
      </div>

      {snaps.length > 1 && (
        <section className="card stack gap-2">
          <span className="title3">Ratings over time</span>
          <LineChart
            label="Attribute ratings"
            series={(['strength', 'power', 'engine', 'discipline'] as const).map((k) => ({
              name: k[0].toUpperCase() + k.slice(1),
              color: attrColors[k],
              points: snaps.map((s) => ({ date: s.date, value: s[k] })),
            }))}
          />
        </section>
      )}

      {/* Weight */}
      <section className="card stack gap-3" aria-label="Weight">
        <div className="card-row">
          <span className="title3">Weight</span>
          <span className="caption">{weighIns.filter((w) => w.lb > 0).length} weigh-ins</span>
        </div>
        {avg.length ? (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat__value num">
                  {avg.at(-1)!.avg.toFixed(1)}
                  <span className="stat__unit">lb</span>
                </span>
                <span className="stat__label">7-day avg</span>
              </div>
              <div className="stat">
                <span className="stat__value num">
                  {(avg.at(-1)!.avg - avg[0].lb > 0 ? '+' : '') + (avg.at(-1)!.avg - avg[0].lb).toFixed(1)}
                  <span className="stat__unit">lb</span>
                </span>
                <span className="stat__label">since start</span>
              </div>
            </div>
            <LineChart
              label="Body weight"
              unit=" lb"
              decimals={1}
              series={[
                { name: '7-day average', color: 'var(--accent)', points: avg.map((a) => ({ date: a.date, value: Math.round(a.avg * 10) / 10 })), width: 3 },
                { name: 'Daily', color: 'var(--text-3)', points: avg.map((a) => ({ date: a.date, value: a.lb })), dots: true, width: 0.01 },
              ]}
            />
          </>
        ) : (
          <p className="sub">Log a morning weigh-in on Today to start your trend line.</p>
        )}

        <div className="stack gap-2" style={{ borderTop: '1px solid var(--hairline)', paddingTop: 'var(--s-3)' }}>
          <span className="eyebrow">Waist at navel · weekly</span>
          {waistThisWeek ? (
            <span className="sub">
              Logged {waistThisWeek.waist}" this week{waists.length > 1 ? ` · ${(waists.at(-1)!.value - waists[0].value).toFixed(1)}" since first` : ''}
            </span>
          ) : (
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault()
                const n = Number(waist)
                if (n > 15 && n < 70) {
                  await logWaist(Math.round(n * 4) / 4)
                  haptic.success()
                  setWaist('')
                }
              }}
            >
              <input className="field num" inputMode="decimal" placeholder='Inches, e.g. 34.5' value={waist} onChange={(e) => setWaist(e.target.value.replace(/[^0-9.]/g, ''))} style={{ flex: 1 }} aria-label="Waist in inches" />
              <button className="btn btn--primary" type="submit" disabled={!waist}>
                Log
              </button>
            </form>
          )}
          {waists.length > 1 && <LineChart label="Waist" unit='"' decimals={1} height={120} series={[{ name: 'Waist', color: 'var(--ring-fuel)', points: waists, dots: true }]} />}
        </div>
      </section>

      {/* Weekly check-in */}
      {checkin && phase !== 'refresh' && phase !== 'preseason' && (
        <section className="card card--glow stack gap-3" aria-label="Weekly check-in">
          <div className="card-row">
            <span className="title3">Weekly check-in</span>
            <span className="caption num">
              {checkin.prevAvg.toFixed(1)} → {checkin.thisAvg.toFixed(1)} lb
            </span>
          </div>
          <p className="sub" style={{ color: 'var(--text)' }}>
            {checkin.message}
          </p>
          {checkinDone ? (
            <span className="caption accent">Done for this week.</span>
          ) : (
            <div className="row">
              {checkin.delta !== 0 && (
                <button
                  className="btn btn--primary btn--sm"
                  onClick={async () => {
                    saveProfile({ ...profile, calorieTarget: profile.calorieTarget + checkin.delta })
                    await db.xp.put({ id: `checkin:${checkin.weekStart}`, date: todayISO(), amount: 75, reason: 'Weekly check-in' })
                    haptic.success()
                  }}
                >
                  {checkin.delta > 0 ? '+' : '−'}150 cal → {(profile.calorieTarget + checkin.delta).toLocaleString()}
                </button>
              )}
              <button
                className="btn btn--secondary btn--sm"
                onClick={async () => {
                  await db.xp.put({ id: `checkin:${checkin.weekStart}`, date: todayISO(), amount: 75, reason: 'Weekly check-in' })
                  haptic.success()
                }}
              >
                {checkin.delta === 0 ? 'Got it' : 'Keep as is'}
              </button>
            </div>
          )}
        </section>
      )}
      {!checkin && (phase === 'cut' || phase === 'build') && (
        <p className="caption">Weekly check-in appears once you have 2+ weigh-ins in each of the last two weeks.</p>
      )}

      {/* Strength */}
      <section className="card stack gap-3" aria-label="Strength">
        <span className="title3">Strength · estimated 1RM</span>
        {strength.length === 0 ? (
          <p className="sub">Your main lifts appear here after your first sessions.</p>
        ) : (
          strength.map((l) => (
            <div key={l.id} className="stack gap-1">
              <div className="card-row">
                <span style={{ fontWeight: 600 }}>{l.name}</span>
                <span className="caption num">Best {l.best} lb</span>
              </div>
              {l.points.length > 1 ? (
                <LineChart label={`${l.name} estimated 1RM`} unit=" lb" height={110} series={[{ name: l.name, color: 'var(--accent)', points: l.points, dots: true }]} />
              ) : (
                <span className="caption">One session so far. The trend starts next time.</span>
              )}
            </div>
          ))
        )}
      </section>

      {/* Muscle balance */}
      <section className="card stack gap-3" aria-label="Weekly muscle balance">
        <div className="card-row">
          <span className="title3">This week's muscle balance</span>
          <span className="caption">sets</span>
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-6)' }}>
          <AnatomyFigure body={profile.body} side="front" muscles={balance ? intensities(balance.per) : {}} height={190} />
          <AnatomyFigure body={profile.body} side="back" muscles={balance ? intensities(balance.per) : {}} height={190} />
        </div>
        {balance && balance.ranked.length ? (
          <div className="stack gap-2">
            {balance.ranked.slice(0, 8).map(([m, v]) => (
              <div key={m} className="hbar">
                <span>{muscleNames[m]}</span>
                <div className="hbar__track">
                  <motion.div className="hbar__fill" initial={{ scaleX: 0 }} animate={{ scaleX: v / balance.ranked[0][1] }} />
                </div>
                <span className="num caption" style={{ textAlign: 'right' }}>
                  {Number.isInteger(v) ? v : v.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="caption" style={{ textAlign: 'center' }}>
            Muscles light up as you log sets this week.
          </p>
        )}
      </section>

      {/* Streak calendar */}
      <section className="card stack gap-3" aria-label="Streak">
        <div className="card-row">
          <span className="title3">Weekly streak</span>
          <span className="chip chip--accent">
            <Icon name="flame" size={13} /> {game.streak.streak} week{game.streak.streak === 1 ? '' : 's'}
          </span>
        </div>
        <p className="caption">
          A week counts with {profile.program === 'athletic' ? '4 of your 5 key sessions (4 lifts + 1 cardio)' : '4 sessions'} and 5+ Fuel days. Rest and deload weeks never break it.{' '}
          {game.streak.freezeAvailable ? 'Injury reserve available this month.' : 'Injury reserve used this month.'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {game.streak.weeks.slice(-16).map((w) => (
            <div
              key={w.start}
              title={`${w.start}: ${w.status}`}
              aria-label={`Week of ${w.start}: ${w.status}, ${w.workouts} sessions, ${w.fuelDays} fuel days`}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 700,
                background: w.status === 'hit' ? 'var(--accent-fill)' : w.status === 'frozen' ? 'var(--ring-log)' : w.status === 'current' ? 'var(--surface-strong)' : 'var(--ring-track)',
                color: w.status === 'hit' ? '#fff' : w.status === 'frozen' ? '#14100d' : 'var(--text-2)',
                outline: w.status === 'current' ? '2px dashed var(--accent)' : undefined,
              }}
            >
              {w.status === 'frozen' ? 'IR' : new Date(w.start + 'T12:00:00').getDate()}
            </div>
          ))}
        </div>
      </section>

      {/* Achievements */}
      <section className="card stack gap-3" aria-label="Achievements">
        <div className="card-row">
          <span className="title3">Collection</span>
          <span className="caption num">
            {unlocked} / {game.achievements.length} cards
          </span>
        </div>
        <div className="ach-grid">
          {[...game.achievements]
            .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
            .slice(0, 6)
            .map((a) => (
              <AchievementCard key={a.id} a={a} />
            ))}
        </div>
        <button className="btn btn--secondary btn--block" onClick={() => setBinder(true)}>
          Open binder
        </button>
      </section>

      <p className="caption" style={{ textAlign: 'center' }}>
        {programs[profile.program].name} · started {profile.startDate}. Body map artwork adapted from react-native-body-highlighter (MIT).
      </p>

      <Sheet open={binder} onClose={() => setBinder(false)} title="Binder">
        <div className="ach-grid">
          {game.achievements.map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
      </Sheet>
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <Settings profile={profile} />
      </Sheet>
    </main>
  )
}

function AchievementCard({ a }: { a: ReturnType<typeof useGame> extends infer G ? (G extends { achievements: (infer A)[] } ? A : never) : never }) {
  return (
    <div className={`ach ach--${a.rarity} ${a.unlocked ? '' : 'ach--locked'}`} aria-label={`${a.name}: ${a.desc} ${a.unlocked ? 'Unlocked' : `Locked, ${Math.round(a.progress * 100)}%`}`}>
      <span className="ach__icon">
        <Icon name={a.unlocked ? a.icon : 'close'} size={22} />
      </span>
      <span className="ach__name">{a.unlocked ? a.name : '???'}</span>
      <span className="ach__rarity">{a.rarity}</span>
      {!a.unlocked && <span className="ach__rarity" style={{ opacity: 0.8 }}>{a.desc}</span>}
    </div>
  )
}
