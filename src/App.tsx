import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { settingsOf, useProfile } from './lib/profile'
import './lib/theme'
import { TabBar, type TabKey } from './components/TabBar'
import { Onboarding } from './screens/Onboarding'
import { Today } from './screens/Today'
import { Train } from './screens/Train'
import { Eat } from './screens/Eat'
import { Progress } from './screens/Progress'
import { Sheet } from './components/Sheet'
import { CelebrationLayer, RestTimerPill } from './components/Overlays'
import { WorkoutView } from './screens/train/WorkoutView'
import { WorkoutRecap } from './screens/train/WorkoutRecap'
import { WeeklyRecap } from './screens/progress/WeeklyRecap'
import { closeRun, closeWorkout, showRecap, showWeekly, useUI } from './lib/ui'
import { RunTracker } from './screens/train/RunTracker'
import { restoreActiveRun } from './lib/runTracker'
import { useActiveWorkout } from './lib/workoutStore'
import { persistGame, useGame } from './lib/game'
import { celebrate, setCelebrationMode } from './lib/celebrate'
import { setRestSound } from './lib/restTimer'
import { setHapticsEnabled } from './lib/haptics'
import { useCustomMealsSync } from './lib/customMeals'
import { useCustomExercisesSync } from './lib/customExercises'
import { applyLabels, myLabelsOn } from './data/myLabels'
import './lib/tune' // registers tuned meals as plans load
import { backfillLibrary } from './lib/labelLibrary'
import { setSyncProfile, syncShared } from './lib/shared'

export default function App() {
  const [profile] = useProfile()
  const [tab, setTab] = useState<TabKey>('today')
  const ui = useUI()
  const active = useActiveWorkout()
  const game = useGame(profile)
  useCustomMealsSync()
  useCustomExercisesSync()
  useEffect(() => {
    restoreActiveRun()
  }, [])
  setSyncProfile(profile ?? null)
  // Shared library: sync on open and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!profile) return
    const run = () => document.visibilityState === 'visible' && syncShared(profile)
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [profile])
  useEffect(() => {
    if (profile) backfillLibrary(profile).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.createdAt])
  const settings = settingsOf(profile)
  // Exact label numbers for this phone's products (before anything computes macros).
  applyLabels(myLabelsOn(profile?.program, settings.myLabels), settings.scannedLabels, settings.labelOff)
  const lastTier = useRef<string | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab, profile?.createdAt])

  useEffect(() => {
    setCelebrationMode(settings.celebration)
    setRestSound(settings.sound)
    setHapticsEnabled(true)
  }, [settings.celebration, settings.sound])

  // Save attribute history; celebrate newly unlocked cards and tier upgrades.
  useEffect(() => {
    // Hold unlock pop-ups until the workout and recap are closed, so they never interrupt.
    if (!game || ui.recap || ui.workoutOpen || ui.weekly || ui.runOpen) return
    const t = setTimeout(async () => {
      const fresh = await persistGame(game)
      for (const a of fresh) celebrate({ kind: 'achievement', title: a.name, desc: a.desc, rarity: a.rarity })
      if (lastTier.current && lastTier.current !== game.tier) celebrate({ kind: 'toast', title: `Card upgraded to ${game.tier[0].toUpperCase()}${game.tier.slice(1)}` })
      lastTier.current = game.tier
    }, 800)
    return () => clearTimeout(t)
  }, [game?.totalXP, game?.tier, game?.achievements.filter((a) => a.unlocked).length, ui.recap, ui.workoutOpen, ui.weekly]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <div className="glow" aria-hidden />
        {!profile ? (
          <Onboarding />
        ) : (
          <>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {tab === 'today' && <Today profile={profile} go={setTab} />}
                {tab === 'train' && <Train profile={profile} />}
                {tab === 'eat' && <Eat profile={profile} />}
                {tab === 'progress' && <Progress profile={profile} />}
              </motion.div>
            </AnimatePresence>
            <TabBar active={tab} onChange={setTab} />

            <Sheet open={ui.workoutOpen && !!active} onClose={closeWorkout} title="Workout" full bare>
              {active && (
                <WorkoutView
                  workout={active}
                  profile={profile}
                  onMinimize={closeWorkout}
                  onFinished={(w) => {
                    showRecap(w)
                  }}
                />
              )}
            </Sheet>

            <AnimatePresence>{ui.recap && <WorkoutRecap key={ui.recap.id} workout={ui.recap} profile={profile} onClose={() => showRecap(null)} />}</AnimatePresence>
            <AnimatePresence>{ui.weekly && <WeeklyRecap profile={profile} onClose={() => showWeekly(false)} />}</AnimatePresence>
            <Sheet open={ui.runOpen} onClose={closeRun} title="Run" full bare>
              <RunTracker profile={profile} onClose={closeRun} defaultType={ui.runType} />
            </Sheet>
            <RestTimerPill />
            <CelebrationLayer />
          </>
        )}
      </div>
    </MotionConfig>
  )
}
