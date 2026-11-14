// Collectible player card. Compact on Today; tap to expand attributes.
// Real ratings come from logged data in Milestone 5; M0 shows starting values.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { haptic } from '../lib/haptics'

export type Tier = 'bronze' | 'silver' | 'gold' | 'elite' | 'legend'

export type PlayerStats = {
  name: string
  ovr: number
  tier: Tier
  level: number
  levelTitle: string
  xp: number
  xpToNext: number
  attributes: { strength: number; power: number; engine: number; discipline: number }
}

const tierLabel: Record<Tier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  elite: 'Elite',
  legend: 'Legend',
}

const attrMeta = [
  { key: 'strength', short: 'STR', name: 'Strength' },
  { key: 'power', short: 'PWR', name: 'Power' },
  { key: 'engine', short: 'ENG', name: 'Engine' },
  { key: 'discipline', short: 'DIS', name: 'Discipline' },
] as const

export function PlayerCard({ stats, bare = false }: { stats: PlayerStats; bare?: boolean }) {
  const [open, setOpen] = useState(false)
  const pct = Math.min(1, stats.xp / stats.xpToNext)

  return (
    <motion.button
      layout
      className={bare ? "player" : "card player"}
      onClick={() => {
        haptic.light()
        setOpen((o) => !o)
      }}
      aria-expanded={open}
      aria-label={`Player card: ${stats.ovr} overall, ${tierLabel[stats.tier]} tier, level ${stats.level} ${stats.levelTitle}. ${open ? 'Collapse' : 'Expand'} attributes.`}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      style={{ textAlign: "left", width: "100%", padding: bare ? 0 : "var(--s-4)" }}
    >
      <motion.div layout="position" className="row" style={{ gap: 'var(--s-4)' }}>
        <div className={`player__badge player__badge--${stats.tier}`} aria-hidden>
          <span className="player__ovr num">{stats.ovr}</span>
          <span className="player__pos">OVR</span>
        </div>
        <div className="stack gap-1" style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="title3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stats.name}
            </span>
            <span className="chip" style={{ minHeight: 22, fontSize: 'var(--fs-caption)', padding: '0 8px' }}>
              {tierLabel[stats.tier]}
            </span>
          </div>
          <span className="caption">
            Level {stats.level} · {stats.levelTitle}
          </span>
          <div className="bar" style={{ marginTop: 6 }}>
            <motion.div
              className="bar__fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.max(0.02, pct) }}
              transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.2 }}
            />
          </div>
          <span className="caption num">
            {stats.xp.toLocaleString()} / {stats.xpToNext.toLocaleString()} XP
          </span>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="attrs"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="player__attrs">
              {attrMeta.map((a) => (
                <div key={a.key} className="stack" style={{ gap: 4 }}>
                  <span className="stat__value num" style={{ fontSize: 'var(--fs-title1)' }}>
                    {stats.attributes[a.key]}
                  </span>
                  <span className="caption" style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
                    {a.short}
                  </span>
                  <div className="bar" style={{ height: 4 }}>
                    <div className="bar__fill" style={{ width: `${stats.attributes[a.key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="caption" style={{ marginTop: 'var(--s-3)' }}>
              Ratings come from what you log: lifts, power work, conditioning and nutrition.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
