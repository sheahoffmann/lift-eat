// Today: status at a glance → one clear "Up next" → the day as a checklist → season footer.
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Profile } from '../lib/profile'
import { macroTargets, saveProfile, settingsOf, todayISO } from '../lib/profile'
import { programs, plannedSets, sessionFor } from '../data/programs'
import { currentSeason, daysBetween, daysUntil, greeting } from '../lib/season'
import { AnatomyFigure } from '../anatomy/AnatomyFigure'
import { bestSide } from '../anatomy/muscles'
import { PlayerCard, type PlayerStats } from '../components/PlayerCard'
import { RingLegend, Rings, type RingValues } from '../components/Rings'
import { Icon } from '../components/Icon'
import { haptic } from '../lib/haptics'
import { logWeighIn, useWeighIns } from '../lib/weighins'
import type { TabKey } from '../components/TabBar'
import { Sheet } from '../components/Sheet'
import { Planner } from './eat/Planner'
import { addDays, logPlanned, plannedMealsFor, removeEntry, totals, useDayLog, useLatestPlan, usePlanFor, type PlannedMeal } from '../lib/eatStore'
import { calorieRange } from '../lib/nutrition'
import { mealsById, slotMeta } from '../data/meals'
import { MacroGoals } from '../components/MacroGoals'
import { MealBuild } from '../components/MealBuild'
import { PixelDino } from '../components/PixelDino'
import { capture, PetDetail, statusLine, useHatchReveal, usePetProgress } from './Pet'
import { AteSomethingElse } from './eat/AteSomethingElse'
import { toggleSupplement } from './eat/Supplements'
import { rarityInfo } from '../data/dinos'
import { db } from '../lib/db'
import { useGame } from '../lib/game'
import { phaseOf, startWorkout, useActiveWorkout, useWorkoutsOn } from '../lib/workoutStore'
import { openRun, openWorkout, showRecap, showWeekly } from '../lib/ui'
import { celebrate } from '../lib/celebrate'
import { buildTodayItems, pickUpNext, timeLabel, type TodayItem } from '../lib/todayPlan'

const enter = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 140, damping: 20, delay: 0.04 * i },
})

type SheetKind = null | 'player' | 'pet' | 'goals' | 'rings' | 'weigh' | 'countdown' | 'plan' | { meal: PlannedMeal } | { other: PlannedMeal } | 'session'

export function Today({ profile, go }: { profile: Profile; go: (t: TabKey) => void }) {
  const program = programs[profile.program]
  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const date = todayISO()
  const season = currentSeason(profile.startDate, now)
  const phase = phaseOf(profile)
  const session = sessionFor(program, now.getDay(), phase)
  const settings = settingsOf(profile)
  const seasonName = settings.buildStartedAt ? 'Season 2: Build' : season.name

  const weighIns = useWeighIns()
  const todayWeigh = weighIns.find((w) => w.date === date && w.lb > 0)
  const game = useGame(profile)
  const active = useActiveWorkout()
  const doneToday = useWorkoutsOn(date)
  const trained = doneToday.length > 0
  const doneSession = doneToday.find((w) => w.sessionKey === session.key) ?? (session.kind !== 'lift' ? doneToday.find((w) => !!w.cardio) : undefined)
  const pet = usePetProgress(profile)
  useHatchReveal(pet)

  const plan = usePlanFor(date)
  const latestPlan = useLatestPlan()
  const log = useDayLog(date) ?? []
  const meals = plan ? plannedMealsFor(plan, date, log) : []
  const eaten = totals(log)
  const targets = macroTargets(profile)
  const [lo, hi] = calorieRange({ calories: profile.calorieTarget, protein: profile.proteinTarget })
  const fuelClosed = eaten.protein >= profile.proteinTarget - 5 && eaten.cal >= lo && eaten.cal <= hi
  const mealsLogged = meals.filter((m) => m.entry).length
  const taken = useLiveQuery(() => db.supplementLog.where('date').equals(date).toArray(), [date], [])
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [busy, setBusy] = useState(false)

  const stats: PlayerStats = {
    name: profile.name,
    ovr: game?.attributes.ovr ?? 40,
    tier: game?.tier ?? 'bronze',
    level: game?.level.level ?? 1,
    levelTitle: game?.level.title ?? 'Walk-on',
    xp: game?.level.into ?? 0,
    xpToNext: game?.level.need ?? 500,
    attributes: game?.attributes ?? { strength: 40, power: 40, engine: 40, discipline: 40 },
  }

  const rings: RingValues = {
    train: trained || session.kind === 'rest' || session.kind === 'optional' ? 1 : active ? 0.5 : 0,
    // Fuel closes only when protein is hit AND calories are in range (never rewards undereating).
    fuel: fuelClosed ? 1 : Math.min(0.97, eaten.protein / profile.proteinTarget),
    log: (mealsLogged + (todayWeigh ? 1 : 0)) / ((plan ? meals.length : 4) + 1),
  }

  const items = buildTodayItems({
    hasPlan: plan !== null && plan !== undefined,
    weighedLb: todayWeigh?.lb,
    meals,
    session,
    sessionDone: !!doneSession,
    supplements: settings.supplements,
    suppsTaken: new Set(taken.map((t) => t.suppId)),
  })
  const upNext = plan === undefined ? null : pickUpNext(items, nowHour)
  const doneCount = items.filter((i) => i.done).length

  const lastWorkout = game?.data.workouts.filter((w) => w.finishedAt).sort((a, b) => b.date.localeCompare(a.date))[0]
  const backAtIt = !!lastWorkout && daysBetween(lastWorkout.date) >= 4 && !trained
  const isMonday = now.getDay() === 1
  const shoppingDay = plan && now.getDay() === settings.shoppingDay && plan.endDate <= addDays(date, 1)

  // Celebrate the moment all three rings close (once per day).
  const allClosed = rings.train >= 1 && rings.fuel >= 1 && rings.log >= 1
  const wasClosed = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasClosed.current === false && allClosed) {
      const key = `lift-eat:rings:${date}`
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          celebrate({ kind: 'rings', title: 'Train. Fuel. Log. Done.' })
        }
      } catch {
        celebrate({ kind: 'rings', title: 'Train. Fuel. Log. Done.' })
      }
    }
    wasClosed.current = allClosed
  }, [allClosed, date])

  async function startSession() {
    haptic.success()
    if (active) return openWorkout()
    if (session.kind === 'lift') {
      await startWorkout(profile, now.getDay())
      openWorkout()
    } else openRun(session.kind === 'sprint' ? 'Sprints + agility' : 'Partner run')
  }

  async function logMeal(m: PlannedMeal) {
    await logPlanned(date, m)
    const p = eaten.protein + m.macros.protein
    const c = eaten.cal + m.macros.cal
    if (!fuelClosed && p >= profile.proteinTarget - 5 && c >= lo && c <= hi) haptic.celebrate()
    else haptic.success()
  }

  /** The one main action for a checklist item. */
  function act(i: TodayItem) {
    switch (i.kind) {
      case 'plan':
        return setSheet('plan')
      case 'weigh':
        return setSheet('weigh')
      case 'meal':
        return i.done ? setSheet({ meal: i.meal }) : logMeal(i.meal)
      case 'session':
        if (i.rest) return
        return doneSession ? showRecap(doneSession) : startSession()
      case 'supp':
        haptic.success()
        return toggleSupplement(date, i.supp, i.done)
    }
  }

  const ringPct = (v: number) => (v >= 1 ? '✓' : `${Math.round(v * 100)}%`)

  return (
    <main className="screen">
      <motion.header {...enter(0)} className="card-row" style={{ alignItems: 'flex-start' }}>
        <div className="stack gap-1">
          <span className="eyebrow">
            {greeting(now)}, {profile.name}
          </span>
          <h1 className="large-title">Today</h1>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 6, marginTop: 6 }}>
          <span className="chip chip--accent">
            {seasonName} · Wk {season.week}
          </span>
          {game && game.streak.streak > 0 && (
            <span className="chip">
              <Icon name="flame" size={13} className="accent" /> {game.streak.streak}-wk streak
            </span>
          )}
        </div>
      </motion.header>

      {/* 1. Status at a glance: rings · player · dino · fuel */}
      <motion.section {...enter(1)} className="card stack gap-4" aria-label="Today's status" style={{ padding: 'var(--s-4)' }}>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          <button className="status-col" onClick={() => setSheet('rings')} aria-label={`Daily rings: Train ${ringPct(rings.train)}, Fuel ${ringPct(rings.fuel)}, Log ${ringPct(rings.log)}`}>
            <Rings values={rings} size={76} />
          </button>
          <button className="status-col" onClick={() => setSheet('player')} aria-label={`Player card: ${stats.ovr} overall, level ${stats.level}`}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className={`player__badge player__badge--${stats.tier}`} style={{ width: 36, height: 44, borderRadius: 9, flex: 'none' }} aria-hidden>
                <span className="player__ovr num" style={{ fontSize: '1.05rem' }}>
                  {stats.ovr}
                </span>
                <span className="player__pos" style={{ fontSize: '0.42rem' }}>
                  OVR
                </span>
              </span>
              {/* Bar is only as wide as the level text */}
              <div className="stack" style={{ gap: 3, textAlign: 'left' }}>
                <span style={{ fontWeight: 650, fontSize: 'var(--fs-sub)', whiteSpace: 'nowrap' }}>Level {stats.level}</span>
                <span className="caption" style={{ whiteSpace: 'nowrap', fontSize: '0.7rem' }}>{stats.levelTitle}</span>
                <div className="bar" style={{ height: 3, width: '100%' }}>
                  <motion.div className="bar__fill" animate={{ scaleX: Math.max(0.04, stats.xp / stats.xpToNext) }} />
                </div>
              </div>
            </div>
          </button>
          {pet ? (
            <button className="status-col" onClick={() => setSheet('pet')} aria-label={`Your dinosaur: ${pet.stage === 'Egg' ? `${rarityInfo[pet.species.rarity].label} egg` : pet.species.name}. ${statusLine(pet)}`}>
              <PixelDino species={pet.species} stage={pet.stage} size={60} mood={pet.todayFed ? 'happy' : 'hungry'} />
              <span className="caption num" style={{ fontSize: '0.65rem', marginTop: -4 }}>
                {pet.progress}/{pet.target}
                {pet.todayFed ? ' · fed' : ''}
              </span>
            </button>
          ) : (
            <span className="status-col" aria-hidden />
          )}
        </div>
        <button className="stack" onClick={() => setSheet('goals')} style={{ gap: 8, textAlign: 'left' }} aria-label="Today's macro goals">
          <MiniBar label="Protein" value={eaten.protein} target={targets.protein} unit="g" color="var(--accent)" hit={eaten.protein >= targets.protein - 5} />
          <MiniBar label="Calories" value={eaten.cal} target={targets.calories} color="var(--ring-fuel)" hit={eaten.cal >= lo && eaten.cal <= hi} />
        </button>
      </motion.section>

      {/* Contextual banners (only when relevant) */}
      {pet?.captureReady && (
        <motion.section {...enter(2)} className="card card-row" style={{ padding: 'var(--s-3) var(--s-4)', outline: `2px solid ${rarityInfo[pet.species.rarity].color}`, outlineOffset: -2 }}>
          <span className="title3">{pet.species.name} is fully grown!</span>
          <button
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await capture(pet)
              setBusy(false)
            }}
          >
            Capture
          </button>
        </motion.section>
      )}
      {backAtIt && (
        <motion.section {...enter(2)} className="card card-row" style={{ padding: 'var(--s-3) var(--s-4)' }}>
          <div className="stack">
            <span className="title3">Back at it</span>
            <span className="caption">One session today restarts the momentum.</span>
          </div>
          <Icon name="bolt" size={22} className="accent" />
        </motion.section>
      )}
      {isMonday && (
        <motion.button {...enter(2)} className="card card--glow card-row" onClick={() => showWeekly(true)} style={{ textAlign: 'left', padding: 'var(--s-3) var(--s-4)' }}>
          <span className="title3">Your week in review</span>
          <Icon name="play" size={18} className="accent" />
        </motion.button>
      )}
      {shoppingDay && (
        <motion.button {...enter(2)} className="card card-row" onClick={() => setSheet('plan')} style={{ textAlign: 'left', padding: 'var(--s-3) var(--s-4)' }}>
          <div className="stack">
            <span className="caption accent" style={{ fontWeight: 700 }}>
              Shopping day
            </span>
            <span className="title3">Plan next week</span>
          </div>
          <Icon name="cart" size={20} className="accent" />
        </motion.button>
      )}

      {/* 2. The one thing to do now */}
      <motion.div {...enter(3)}>
        <UpNextHero
          item={upNext}
          profile={profile}
          session={session}
          phase={phase}
          active={!!active}
          eatenProtein={eaten.protein}
          doneCount={doneCount}
          total={items.length}
          portion={plan?.portion ?? 1}
          onAct={act}
          onOther={(m) => setSheet({ other: m })}
          onWeigh={async (lb) => {
            await logWeighIn(lb)
            haptic.success()
          }}
          lastWeight={weighIns.at(-1)?.lb}
        />
      </motion.div>

      {/* 3. The day as a checklist */}
      <motion.section {...enter(4)} className="card" aria-label="Today's checklist" style={{ padding: 'var(--s-2) var(--s-4)' }}>
        <div className="card-row" style={{ padding: 'var(--s-2) 0' }}>
          <span className="eyebrow">Today</span>
          <span className="caption num">
            {doneCount}/{items.length} done
          </span>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((i) => (
            <TimelineRow key={i.id} item={i} isNext={upNext?.id === i.id} onAct={() => act(i)} onOpen={() => (i.kind === 'meal' ? setSheet({ meal: i.meal }) : i.kind === 'session' && !i.rest ? setSheet('session') : act(i))} />
          ))}
        </ol>
      </motion.section>

      {/* 4. Season footer */}
      <motion.section {...enter(5)} className="card" style={{ padding: 'var(--s-3) var(--s-4)' }} aria-label="This season">
        <div className="row" style={{ alignItems: 'stretch', gap: 'var(--s-4)' }}>
          <button className="stack" onClick={() => setSheet('countdown')} style={{ flex: 1, textAlign: 'left', gap: 2 }}>
            <span className="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.goal ? profile.goal.label : 'Countdown'}</span>
            {profile.goal ? (
              <span style={{ fontWeight: 700 }} className="num">
                <span className="accent">{Math.max(0, daysUntil(profile.goal.date))}</span> days to go
              </span>
            ) : (
              <span className="accent" style={{ fontWeight: 650 }}>
                Add a trip or event
              </span>
            )}
          </button>
          <div style={{ width: 1, background: 'var(--hairline)' }} />
          <div className="stack" style={{ flex: 1, gap: 4 }}>
            <span className="caption">{seasonName}</span>
            {season.progress !== null ? (
              <>
                <span style={{ fontWeight: 700 }} className="num">
                  Day {season.dayOfSeason} of {season.lengthDays}
                </span>
                <div className="bar" style={{ height: 4 }}>
                  <motion.div className="bar__fill" animate={{ scaleX: season.progress }} />
                </div>
              </>
            ) : (
              <span style={{ fontWeight: 700 }} className="num">
                Week {season.week}
              </span>
            )}
          </div>
        </div>
      </motion.section>

      {/* Detail sheets */}
      <Sheet open={sheet === 'player'} onClose={() => setSheet(null)} title="Player card">
        <PlayerCard stats={stats} />
      </Sheet>
      <Sheet open={sheet === 'pet'} onClose={() => setSheet(null)} title="Your dinosaur">
        {pet && <PetDetail p={pet} />}
      </Sheet>
      <Sheet open={sheet === 'goals'} onClose={() => setSheet(null)} title="Today's goals">
        <MacroGoals eaten={eaten} targets={targets} calorieRange={[lo, hi]} bare />
      </Sheet>
      <Sheet open={sheet === 'rings'} onClose={() => setSheet(null)} title="Daily rings">
        <div className="row" style={{ gap: 'var(--s-5)' }}>
          <Rings values={rings} />
          <RingLegend
            values={rings}
            detail={{
              train: trained ? `${doneToday[0].name.replace(': Refresh', '')} done` : session.kind === 'rest' ? 'Rest day counts' : session.kind === 'optional' ? 'Optional day, already counts' : active ? 'In progress' : `${session.short} not done yet`,
              fuel: fuelClosed ? `${Math.round(eaten.protein)} g protein, in range` : `${Math.round(eaten.protein)} / ${profile.proteinTarget} g protein, ${lo.toLocaleString()}–${hi.toLocaleString()} cal`,
              log: plan ? `${mealsLogged}/${meals.length} meals${todayWeigh ? ' + weigh-in' : ', weigh-in'}` : todayWeigh ? 'Weigh-in logged' : 'Meals + weigh-in',
            }}
          />
        </div>
      </Sheet>
      <Sheet open={sheet === 'weigh'} onClose={() => setSheet(null)} title="Morning weigh-in">
        <WeighInCard logged={todayWeigh?.lb} last={weighIns.at(-1)?.lb} bare />
      </Sheet>
      <Sheet open={sheet === 'countdown'} onClose={() => setSheet(null)} title="Countdown">
        <GoalCard profile={profile} bare />
      </Sheet>
      <Sheet open={sheet === 'session'} onClose={() => setSheet(null)} title="Today's session">
        <SessionDetail session={session} profile={profile} phase={phase} onTrain={() => { setSheet(null); go('train') }} />
      </Sheet>
      <Sheet open={!!sheet && typeof sheet === 'object' && 'meal' in sheet} onClose={() => setSheet(null)} title="Meal">
        {sheet && typeof sheet === 'object' && 'meal' in sheet && (
          <MealSheet
            meal={sheet.meal}
            portion={plan?.portion ?? 1}
            onLog={async () => {
              await logMeal(sheet.meal)
              setSheet(null)
            }}
            onUndo={async () => {
              if (sheet.meal.entry) await removeEntry(sheet.meal.entry.id)
              setSheet(null)
            }}
            onOther={() => setSheet({ other: sheet.meal })}
          />
        )}
      </Sheet>
      <Sheet open={!!sheet && typeof sheet === 'object' && 'other' in sheet} onClose={() => setSheet(null)} title="Ate something else">
        {sheet && typeof sheet === 'object' && 'other' in sheet && (
          <AteSomethingElse date={date} target={{ slot: sheet.other.slot, replacesMealId: sheet.other.mealId, replacing: sheet.other.name }} onDone={() => setSheet(null)} />
        )}
      </Sheet>
      <Sheet open={sheet === 'plan'} onClose={() => setSheet(null)} title="Plan your week" full bare>
        <Planner profile={profile} previous={latestPlan ?? null} onClose={() => setSheet(null)} />
      </Sheet>
    </main>
  )
}

function MiniBar({ label, value, target, unit = '', color, hit }: { label: string; value: number; target: number; unit?: string; color: string; hit: boolean }) {
  const v = Math.round(value)
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="card-row caption" style={{ color: 'var(--text-2)' }}>
        <span style={{ fontWeight: 600 }}>
          {label} {hit && <Icon name="check" size={11} strokeWidth={3} className="accent" />}
        </span>
        <span className="num">
          <strong style={{ color: 'var(--text)' }}>{v.toLocaleString()}</strong> / {target.toLocaleString()}
          {unit}
        </span>
      </div>
      <div className="bar" style={{ height: 5 }}>
        <motion.div className="bar__fill" style={{ background: color, boxShadow: 'none' }} animate={{ scaleX: Math.max(0.01, Math.min(1, value / target)) }} />
      </div>
    </div>
  )
}

function TimelineRow({ item, isNext, onAct, onOpen }: { item: TodayItem; isNext: boolean; onAct: () => void; onOpen: () => void }) {
  const icon = item.kind === 'meal' ? 'eat' : item.kind === 'session' ? (item.rest ? 'moon' : 'train') : item.kind === 'weigh' ? 'scale' : item.kind === 'supp' ? 'sparkle' : 'cart'
  const actionLabel =
    item.kind === 'meal' ? 'Log' : item.kind === 'session' ? (item.done ? 'Recap' : 'Start') : item.kind === 'weigh' ? 'Log' : item.kind === 'plan' ? 'Plan' : ''
  return (
    <li className="g-row" style={{ minHeight: 52, gap: 'var(--s-3)', position: 'relative' }}>
      {isNext && <span aria-hidden style={{ position: 'absolute', left: -16, top: 10, bottom: 10, width: 3, borderRadius: 2, background: 'var(--accent)' }} />}
      <span className="caption num" style={{ width: 34, flex: 'none', color: isNext ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>
        {item.time == null ? '' : timeLabel(item.time)}
      </span>
      <button
        className={`check-dot ${item.done ? 'check-dot--on' : ''}`}
        onClick={item.kind === 'supp' || (item.kind === 'meal' && !item.done) ? onAct : onOpen}
        aria-label={item.done ? `${item.title} done` : item.kind === 'supp' || item.kind === 'meal' ? `Mark ${item.title} done` : `Open ${item.title}`}
        aria-pressed={item.done}
        style={{ width: 24, height: 24 }}
      >
        {item.done ? <Icon name="check" size={13} strokeWidth={3} /> : <Icon name={icon} size={12} className="muted" />}
      </button>
      <button className="stack" onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: 'left', gap: 1 }}>
        <span style={{ fontWeight: isNext ? 700 : 600, color: item.done ? 'var(--text-3)' : undefined, textDecoration: item.done && item.kind === 'supp' ? 'line-through' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </span>
        <span className="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.sub}
        </span>
      </button>
      {!item.done && actionLabel && item.kind !== 'supp' && !(item.kind === 'session' && item.rest) && (
        <button className={`btn btn--sm ${isNext ? 'btn--primary' : 'btn--secondary'}`} onClick={onAct} style={{ minHeight: 36, padding: '0 14px' }}>
          {actionLabel}
        </button>
      )}
      {item.done && item.kind === 'session' && !item.rest && (
        <button className="btn btn--sm btn--secondary" onClick={onAct} style={{ minHeight: 36, padding: '0 14px' }}>
          Recap
        </button>
      )}
    </li>
  )
}

function UpNextHero({
  item,
  profile,
  session,
  phase,
  active,
  eatenProtein,
  doneCount,
  total,
  portion,
  onAct,
  onOther,
  onWeigh,
  lastWeight,
}: {
  item: TodayItem | null
  profile: Profile
  session: ReturnType<typeof sessionFor>
  phase: ReturnType<typeof phaseOf>
  active: boolean
  eatenProtein: number
  doneCount: number
  total: number
  portion: number
  onAct: (i: TodayItem) => void
  onOther: (m: PlannedMeal) => void
  onWeigh: (lb: number) => void
  lastWeight?: number
}) {
  const [recipe, setRecipe] = useState(false)
  const [weight, setWeight] = useState('')

  if (!item) {
    return (
      <section className="card card--hero card--glow stack" style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-2)' }}>
        <span className="icon-btn" style={{ width: 56, height: 56, background: 'var(--accent-fill)', color: '#fff' }} aria-hidden>
          <Icon name="check" size={28} strokeWidth={3} />
        </span>
        <h2 className="title1">Day complete</h2>
        <p className="sub">
          {doneCount}/{total} done. Rest up, the season continues tomorrow.
        </p>
      </section>
    )
  }

  const kicker = (t: string) => (
    <span className="chip chip--accent" style={{ alignSelf: 'flex-start' }}>
      Up next · {t}
    </span>
  )

  return (
    <section className="card card--hero card--glow stack gap-3" aria-label="Up next">
      {item.kind === 'plan' && (
        <>
          {kicker('Eat')}
          <h2 className="title1">Plan your week</h2>
          <p className="sub">Pick your meals once, get a grocery list, and every meal after that is one tap to log.</p>
          <button className="btn btn--primary btn--block" onClick={() => onAct(item)}>
            Plan my week
          </button>
        </>
      )}

      {item.kind === 'weigh' && (
        <>
          {kicker('Morning')}
          <h2 className="title1">Morning weigh-in</h2>
          <p className="sub">Before breakfast, after the bathroom. Same time daily gives the cleanest trend.</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(weight)
              if (n > 60 && n < 500) {
                onWeigh(Math.round(n * 10) / 10)
                setWeight('')
              }
            }}
          >
            <input className="field num" inputMode="decimal" placeholder={lastWeight ? `${lastWeight.toFixed(1)} lb last time` : 'Weight in lb'} value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ''))} style={{ flex: 1 }} aria-label="Body weight in pounds" />
            <button className="btn btn--primary" type="submit" disabled={!weight}>
              Log
            </button>
          </form>
        </>
      )}

      {item.kind === 'meal' && (
        <>
          {kicker(`${item.meal.slot === 'extra' ? 'Extra' : slotMeta[item.meal.slot].label} · ${item.meal.time}`)}
          <h2 className="title1">{item.meal.name}</h2>
          <p className="sub">{mealsById[item.meal.mealId]?.desc}</p>
          <div className="stats">
            <Stat label="Protein" value={String(item.meal.macros.protein)} unit="g" />
            <Stat label="Calories" value={String(item.meal.macros.cal)} />
            <Stat label="Protein left" value={String(Math.max(0, Math.round(profile.proteinTarget - eatenProtein)))} unit="g" />
          </div>
          <button className="btn btn--primary btn--block" onClick={() => onAct(item)}>
            <Icon name="check" size={18} strokeWidth={2.6} /> Log it
          </button>
          <div className="row" style={{ justifyContent: 'center', gap: 'var(--s-4)' }}>
            <button className="link-btn" onClick={() => setRecipe((r) => !r)} aria-expanded={recipe}>
              {recipe ? 'Hide recipe' : 'How to make it'}
            </button>
            <button className="link-btn" style={{ color: 'var(--text-2)' }} onClick={() => onOther(item.meal)}>
              Ate something else
            </button>
          </div>
          {recipe && mealsById[item.meal.mealId] && (
            <div className="card" style={{ padding: 'var(--s-3) var(--s-4)', background: 'var(--surface-strong)', boxShadow: 'none' }}>
              <MealBuild meal={mealsById[item.meal.mealId]} portion={portion} />
            </div>
          )}
        </>
      )}

      {item.kind === 'session' && (
        <>
          <div className="row" style={{ alignItems: 'stretch', gap: 'var(--s-3)' }}>
            <div className="stack gap-2" style={{ flex: 1, minWidth: 0 }}>
              {kicker(session.kind === 'lift' ? 'Workout' : 'Session')}
              <h2 className="title1">{session.name}</h2>
              <p className="sub">{session.focus}</p>
            </div>
            <div style={{ flex: 'none', marginRight: -8 }}>
              <AnatomyFigure body={profile.body} side={bestSide(session.muscles)} muscles={session.muscles} height={140} />
            </div>
          </div>
          <div className="stats">
            {session.sets.length > 0 ? (
              <>
                <Stat icon="layers" label="Sets" value={String(plannedSets(session, phase))} />
                <Stat icon="train" label="Exercises" value={String(session.sets.length)} />
              </>
            ) : (
              <Stat icon="run" label="Type" value={session.kind === 'sprint' ? 'Speed' : 'Easy'} />
            )}
            <Stat icon="clock" label="Time" value={`${session.minutes[0]}–${session.minutes[1]}`} unit="min" />
          </div>
          <button className="btn btn--primary btn--block" onClick={() => onAct(item)}>
            <Icon name="play" size={18} /> {active ? 'Continue workout' : session.kind === 'lift' ? 'Start workout' : 'Start run'}
          </button>
        </>
      )}

      {item.kind === 'supp' && (
        <>
          {kicker('Anytime')}
          <h2 className="title1">{item.supp.name}</h2>
          <p className="sub">
            {item.supp.dose}
            {item.supp.timing && ` · ${item.supp.timing}`}
          </p>
          <button className="btn btn--primary btn--block" onClick={() => onAct(item)}>
            <Icon name="check" size={18} strokeWidth={2.6} /> Mark taken
          </button>
        </>
      )}
    </section>
  )
}

function MealSheet({ meal, portion, onLog, onUndo, onOther }: { meal: PlannedMeal; portion: number; onLog: () => void; onUndo: () => void; onOther: () => void }) {
  const option = mealsById[meal.mealId]
  return (
    <div className="stack gap-4">
      <div className="stack gap-1">
        <span className="caption">
          {meal.slot === 'extra' ? 'Extra' : slotMeta[meal.slot].label} · {meal.time}
        </span>
        <h2 className="title2">{meal.name}</h2>
        <span className="caption num">
          {meal.macros.protein} g protein · {meal.macros.cal} cal
        </span>
      </div>
      {option && <MealBuild meal={option} portion={portion} />}
      {meal.entry ? (
        <>
          <p className="sub">
            Logged{!meal.entry.planned ? `: had ${meal.entry.name} instead` : ''}.
          </p>
          <button className="btn btn--secondary btn--block" onClick={onUndo}>
            Undo
          </button>
        </>
      ) : (
        <>
          <button className="btn btn--primary btn--block" onClick={onLog}>
            <Icon name="check" size={18} strokeWidth={2.6} /> Log it
          </button>
          <button className="link-btn" style={{ alignSelf: 'center' }} onClick={onOther}>
            Ate something else
          </button>
        </>
      )}
    </div>
  )
}

function SessionDetail({ session, profile, phase, onTrain }: { session: ReturnType<typeof sessionFor>; profile: Profile; phase: ReturnType<typeof phaseOf>; onTrain: () => void }) {
  return (
    <div className="stack gap-3">
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="stack gap-1" style={{ flex: 1 }}>
          <h2 className="title2">{session.name}</h2>
          <p className="sub">{session.focus}</p>
          <span className="caption num">
            {session.sets.length ? `${plannedSets(session, phase)} sets · ` : ''}
            {session.minutes[0]}–{session.minutes[1]} min
          </span>
        </div>
        {session.kind !== 'rest' && <AnatomyFigure body={profile.body} side={bestSide(session.muscles)} muscles={session.muscles} height={140} />}
      </div>
      {phase === 'refresh' && session.sets.length > 0 && <p className="caption">Refresh week: easy weights, finish feeling like you could do a lot more.</p>}
      {phase === 'preseason' && session.sets.length > 0 && <p className="caption">Preseason: about half the sets, stop 3–4 reps short of failure.</p>}
      <button className="btn btn--secondary btn--block" onClick={onTrain}>
        See exercises on Train
      </button>
    </div>
  )
}

function Stat({ label, value, unit, icon }: { label: string; value: string; unit?: string; icon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <div className="stat">
      <span className="stat__value num">
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </span>
      <span className="stat__label">
        {icon && <Icon name={icon} size={13} />}
        {label}
      </span>
    </div>
  )
}

function GoalCard({ profile, bare = false }: { profile: Profile; bare?: boolean }) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const goal = profile.goal

  if (goal) {
    const left = daysUntil(goal.date)
    const total = Math.max(1, daysUntil(goal.date, new Date(profile.startDate + 'T12:00:00')))
    const pct = Math.min(1, Math.max(0, 1 - left / total))
    const weeks = Math.floor(left / 7)
    return (
      <section className={bare ? "" : "card card--glow"} aria-label={`${left} days until ${goal.label}`}>
        <div className="card-row" style={{ alignItems: 'flex-end' }}>
          <div className="stack gap-1">
            <span className="eyebrow">Countdown</span>
            <span className="title2">{goal.label}</span>
          </div>
          <div className="stack" style={{ alignItems: 'flex-end' }}>
            <span className="stat__value num" style={{ fontSize: 'var(--fs-hero-stat)' }}>
              {Math.max(0, left)}
            </span>
            <span className="caption">days to go</span>
          </div>
        </div>
        <div className="bar" style={{ marginTop: 'var(--s-4)' }}>
          <motion.div
            className="bar__fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.max(0.02, pct) }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.3 }}
          />
        </div>
        <p className="caption" style={{ marginTop: 'var(--s-2)' }}>
          {left > 0 ? `${weeks} week${weeks === 1 ? '' : 's'} of work left. Stack the days.` : 'Game day. Enjoy it.'}
        </p>
      </section>
    )
  }

  const valid = label.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && daysUntil(date) > 0
  return (
    <section className={bare ? "" : "card"} aria-labelledby="goal-title">
      <h2 id="goal-title" className="title3">
        Training for something?
      </h2>
      <p className="sub" style={{ marginTop: 4 }}>
        Add a trip or event and Today counts down to it.
      </p>
      <form
        className="stack gap-2"
        style={{ marginTop: 'var(--s-3)' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          haptic.success()
          saveProfile({ ...profile, goal: { label: label.trim(), date } })
        }}
      >
        <label className="sr-only" htmlFor="goal-label">
          Goal name
        </label>
        <input
          id="goal-label"
          className="field"
          placeholder="e.g. Beach trip"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="row">
          <label className="sr-only" htmlFor="goal-date">
            Goal date
          </label>
          <input
            id="goal-date"
            className="field"
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary" disabled={!valid} type="submit">
            Save
          </button>
        </div>
      </form>
    </section>
  )
}

function WeighInCard({ logged, last, bare = false }: { logged?: number; last?: number; bare?: boolean }) {
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)

  if (logged && !editing) {
    return (
      <section className={bare ? "" : "card"} aria-label="Morning weigh-in">
        <div className="card-row">
          <div className="row">
            <span className="icon-btn" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }} aria-hidden>
              <Icon name="check" size={20} strokeWidth={2.6} />
            </span>
            <div className="stack">
              <span className="title3 num">{logged.toFixed(1)} lb</span>
              <span className="caption">Weigh-in logged · +15 XP</span>
            </div>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </section>
    )
  }

  const n = Number(value)
  const valid = value !== '' && n > 60 && n < 500

  return (
    <section className={bare ? "" : "card"} aria-labelledby="weigh-title">
      {bare ? (
        <h2 id="weigh-title" className="sr-only">Morning weigh-in</h2>
      ) : (
        <div className="row" style={{ marginBottom: "var(--s-3)" }}>
          <Icon name="scale" size={20} className="accent" />
          <h2 id="weigh-title" className="title3">
            Morning weigh-in
          </h2>
        </div>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          logWeighIn(Math.round(n * 10) / 10)
          haptic.success()
          setEditing(false)
          setValue('')
        }}
      >
        <label className="sr-only" htmlFor="weigh">
          Body weight in pounds
        </label>
        <input
          id="weigh"
          className="field num"
          inputMode="decimal"
          placeholder={last ? `${last.toFixed(1)} lb last time` : 'Weight in lb'}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          style={{ flex: 1 }}
        />
        <button className="btn btn--primary" disabled={!valid} type="submit">
          Log
        </button>
      </form>
    </section>
  )
}
