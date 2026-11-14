// Global overlays: floating rest timer and celebration moments.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { addRest, skipRest, useRest } from '../lib/restTimer'
import { dismissCelebration, useCelebration } from '../lib/celebrate'
import { formatSeconds } from '../lib/training'
import { Icon } from './Icon'

export function RestTimerPill() {
  const rest = useRest()
  return createPortal(
    <AnimatePresence>
      {rest && (
        <motion.div
          className="rest-pill"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          role="timer"
          aria-live="off"
          aria-label={`Rest ${formatSeconds(rest.left)} remaining`}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--ring-track)" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${rest.left / rest.total} 1`}
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dasharray 250ms linear' }}
            />
          </svg>
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <span className="num" style={{ fontSize: 'var(--fs-title2)', fontWeight: 700, lineHeight: 1 }}>
              {formatSeconds(rest.left)}
            </span>
            <span className="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Next: {rest.label}
            </span>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={() => addRest(30)}>
            +30s
          </button>
          <button className="btn btn--invert btn--sm" onClick={skipRest}>
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function CelebrationLayer() {
  const c = useCelebration()

  useEffect(() => {
    if (!c) return
    const t = setTimeout(dismissCelebration, c.kind === 'toast' ? 2200 : 2600)
    return () => clearTimeout(t)
  }, [c])

  return createPortal(
    <AnimatePresence mode="wait">
      {c && c.kind === 'toast' && (
        <motion.button
          key={c.title}
          className="toast"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          onClick={dismissCelebration}
          role="status"
        >
          <Icon name="sparkle" size={16} className="accent" /> {c.title}
        </motion.button>
      )}
      {c && c.kind !== 'toast' && (
        <motion.button
          key={c.title + c.kind}
          className="moment"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          onClick={dismissCelebration}
          aria-label={`${c.title}. Tap to dismiss.`}
          role="alert"
        >
          <motion.div
            className="stack"
            style={{ alignItems: 'center', gap: 'var(--s-3)', textAlign: 'center' }}
            initial={{ scale: 0.7, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <span className="moment__badge">
              <Icon name={c.kind === 'pr' ? 'bolt' : c.kind === 'rings' ? 'today' : 'trophy'} size={36} strokeWidth={2.4} />
            </span>
            <span className="eyebrow" style={{ color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {c.kind === 'pr' ? 'New PR' : c.kind === 'rings' ? 'All rings closed' : `${c.rarity} card unlocked`}
            </span>
            <span className="title1">{c.title}</span>
            {c.kind === 'pr' && (
              <>
                <motion.span
                  className="num"
                  style={{ fontSize: '3.6rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {c.value}
                </motion.span>
                {c.previous && <span className="sub">Previous best {c.previous}</span>}
                {c.attribute && <span className="chip chip--accent">{c.attribute}</span>}
              </>
            )}
            {c.kind === 'achievement' && <span className="sub">{c.desc}</span>}
            <span className="caption" style={{ marginTop: 'var(--s-4)' }}>
              Tap to continue
            </span>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body,
  )
}
