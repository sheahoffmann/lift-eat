// Live run screen: GPS, keep-screen-on, pocket lock, splits, finish → recap.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Profile } from '../../lib/profile'
import { discardRun, finishRun, pauseRun, resumeRun, startRun, useRunLive, warmUpGps } from '../../lib/runTracker'
import { formatDuration, formatPace, type RunPoint } from '../../lib/runMath'
import { allowScreenLock, keepScreenOn, useWakeLock, wakeLockSupported } from '../../lib/wakeLock'
import { showRecap } from '../../lib/ui'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'
import { RunRoute } from '../../components/RunRoute'

const runTypes = ['Easy run', 'Partner run', 'Long run', 'Tempo', 'Sprints + agility', 'Walk']

export function RunTracker({ profile, onClose, defaultType = 'Easy run' }: { profile: Profile; onClose: () => void; defaultType?: string }) {
  const live = useRunLive()
  const wake = useWakeLock()
  const [type, setType] = useState(runTypes.includes(defaultType) ? defaultType : 'Easy run')
  const [locked, setLocked] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    warmUpGps()
  }, [])

  const gpsReady = live.accuracy != null && live.accuracy <= 35
  const running = live.status !== 'idle'
  const stale = live.status === 'running' && live.lastFixAt != null && live.now - live.lastFixAt > 20000

  async function toggleScreen() {
    haptic.light()
    if (wake.wanted) await allowScreenLock()
    else await keepScreenOn()
  }

  async function finish() {
    setBusy(true)
    const w = await finishRun(profile)
    setBusy(false)
    setConfirm(false)
    onClose()
    if (w) showRecap(w)
  }

  return (
    <div className="stack" style={{ minHeight: '100%' }}>
      <div className="totals-bar">
        <div className="card-row">
          <button className="icon-btn" onClick={onClose} aria-label={running ? 'Minimize run' : 'Close'}>
            <Icon name={running ? 'chevron' : 'close'} size={18} className={running ? 'rot90' : undefined} />
          </button>
          <span style={{ fontWeight: 700 }}>{running ? type : 'Track a run'}</span>
          <span className={`chip ${gpsReady ? 'chip--accent' : ''}`} aria-live="polite">
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: gpsReady ? 'var(--accent)' : 'var(--text-3)' }} />
            {gpsReady ? `GPS ±${Math.round(live.accuracy!)} m` : 'Finding GPS'}
          </span>
        </div>
      </div>

      <div className="stack gap-4" style={{ padding: `var(--s-2) var(--gutter) calc(env(safe-area-inset-bottom) + var(--s-8))` }}>
        {live.gpsError && (
          <p className="card sub" role="alert" style={{ color: 'var(--text)' }}>
            {live.gpsError}
          </p>
        )}

        {/* Keep screen on: the big, obvious control */}
        <button
          className={`card card-row ${wake.wanted ? 'card--glow' : ''}`}
          onClick={toggleScreen}
          aria-pressed={wake.wanted}
          style={{ textAlign: 'left', outline: wake.wanted ? '2px solid var(--accent)' : undefined, outlineOffset: -2 }}
        >
          <div className="stack" style={{ gap: 2 }}>
            <span className="title3">{wake.wanted ? 'Screen stays on' : 'Keep screen on'}</span>
            <span className="caption">
              {wake.state === 'unsupported'
                ? 'Not supported on this iOS. Set Settings → Display → Auto-Lock → Never for the run.'
                : wake.wanted
                  ? wake.state === 'on'
                    ? 'Your phone won’t lock until you tap this again or finish.'
                    : 'Turns back on when you return to the app.'
                  : 'Tap so your phone doesn’t lock and GPS keeps tracking.'}
            </span>
          </div>
          <span className="toggle" aria-checked={wake.wanted} aria-hidden />
        </button>

        {!running ? (
          <>
            <div className="stack gap-2">
              <span className="eyebrow">Type</span>
              <div className="tool-row" role="radiogroup" aria-label="Run type">
                {runTypes.map((t) => (
                  <button key={t} role="radio" aria-checked={type === t} className={`chip ${type === t ? 'chip--accent' : ''}`} onClick={() => setType(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn--primary btn--block"
              style={{ minHeight: 64, fontSize: 'var(--fs-title3)' }}
              onClick={async () => {
                if (wakeLockSupported() && !wake.wanted) await keepScreenOn()
                startRun(type)
              }}
            >
              <Icon name="play" size={20} /> Start run
            </button>
            <p className="caption" style={{ textAlign: 'center' }}>
              {gpsReady ? 'GPS locked in. Ready when you are.' : 'Waiting for a GPS lock gives the most accurate start. Stepping outside helps.'}
            </p>
            {!wakeLockSupported() && <p className="caption" style={{ textAlign: 'center' }}>Tip: iPhone pauses GPS for web apps when the screen locks.</p>}
          </>
        ) : (
          <>
            <section className="card card--hero stack gap-4" aria-label="Run stats">
              <div className="stack" style={{ alignItems: 'center' }}>
                <span className="num" style={{ fontSize: 'clamp(3.4rem, 18vw, 5rem)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1 }} aria-label={`Time ${formatDuration(live.movingSec)}`}>
                  {formatDuration(live.movingSec)}
                </span>
                <span className="caption">{live.status === 'paused' ? 'Paused' : 'Moving time'}</span>
              </div>
              <div className="stats">
                <div className="stat">
                  <span className="stat__value num">
                    {live.miles.toFixed(2)}
                    <span className="stat__unit">mi</span>
                  </span>
                  <span className="stat__label">distance</span>
                </div>
                <div className="stat">
                  <span className="stat__value num">{formatPace(live.pace)}</span>
                  <span className="stat__label">pace /mi</span>
                </div>
                <div className="stat">
                  <span className="stat__value num">{formatPace(live.avgPace)}</span>
                  <span className="stat__label">avg /mi</span>
                </div>
              </div>
              {stale && <span className="caption" style={{ textAlign: 'center' }}>GPS signal is weak. Keep the screen on and the app open.</span>}
            </section>

            <div className="card" style={{ padding: 'var(--s-3)' }}>
              <RunRoute points={(live.run?.points ?? []) as RunPoint[]} height={200} />
            </div>

            {live.splits.length > 0 && (
              <section className="card stack" style={{ padding: 'var(--s-2) var(--s-4)' }} aria-label="Mile splits">
                {live.splits.map((s, i) => (
                  <div key={i} className="card-row g-row" style={{ minHeight: 40 }}>
                    <span className="caption">Mile {i + 1}</span>
                    <span className="num" style={{ fontWeight: 700 }}>
                      {formatPace(s)}
                    </span>
                  </div>
                ))}
              </section>
            )}

            <div className="row" style={{ gap: 'var(--s-2)' }}>
              {live.status === 'running' ? (
                <button className="btn btn--secondary" style={{ flex: 1 }} onClick={pauseRun}>
                  Pause
                </button>
              ) : (
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={resumeRun}>
                  <Icon name="play" size={16} /> Resume
                </button>
              )}
              <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setLocked(true)} aria-label="Pocket lock">
                Pocket lock
              </button>
            </div>
            <button className="btn btn--invert btn--block" onClick={() => setConfirm(true)}>
              <Icon name="check" size={18} strokeWidth={2.6} /> I'm done
            </button>
          </>
        )}
      </div>

      <AnimatePresence>{locked && <PocketLock live={live} onUnlock={() => setLocked(false)} />}</AnimatePresence>

      {confirm &&
        createPortal(
          <div className="sheet-root" role="dialog" aria-modal="true" aria-label="Finish run">
            <div className="sheet-scrim" onClick={() => setConfirm(false)} />
            <div className="sheet" style={{ padding: 'var(--s-5) var(--gutter) calc(env(safe-area-inset-bottom) + var(--s-5))' }}>
              <div className="stack gap-3">
                <span className="title2">Finish run?</span>
                <span className="sub num">
                  {live.miles.toFixed(2)} mi in {formatDuration(live.movingSec)}. Your screen will be able to lock again.
                </span>
                <button className="btn btn--primary btn--block" disabled={busy} onClick={finish}>
                  Finish and see recap
                </button>
                <button className="btn btn--secondary btn--block" onClick={() => setConfirm(false)}>
                  Keep running
                </button>
                <button
                  className="link-btn"
                  style={{ alignSelf: 'center', color: 'var(--text-3)' }}
                  onClick={async () => {
                    if (window.confirm('Discard this run? It won’t be saved.')) {
                      await discardRun()
                      setConfirm(false)
                      onClose()
                    }
                  }}
                >
                  Discard run
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function PocketLock({ live, onUnlock }: { live: ReturnType<typeof useRunLive>; onUnlock: () => void }) {
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const start = () => {
    const t0 = Date.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200)
      setProgress(p)
      if (p >= 1) {
        stop()
        haptic.success()
        onUnlock()
      }
    }, 30)
  }
  const stop = () => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setProgress(0)
  }
  return createPortal(
    <motion.div
      className="moment"
      style={{ background: '#050403', cursor: 'default' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Pocket lock on"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="stack" style={{ alignItems: 'center', gap: 'var(--s-4)', textAlign: 'center', color: '#f7f3f0' }}>
        <span className="num" style={{ fontSize: '4.5rem', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {formatDuration(live.movingSec)}
        </span>
        <span className="num title2">{live.miles.toFixed(2)} mi · {formatPace(live.avgPace)} /mi</span>
        <span className="caption" style={{ color: 'rgba(247,243,240,0.6)' }}>
          Screen locked to touches
        </span>
        <button
          className="btn"
          style={{ marginTop: 'var(--s-10)', position: 'relative', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', color: '#fff', minWidth: 240 }}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          aria-label="Press and hold to unlock"
        >
          <span aria-hidden style={{ position: 'absolute', inset: 0, width: `${progress * 100}%`, background: 'var(--accent-fill)', transition: 'width 30ms linear' }} />
          <span style={{ position: 'relative' }}>Press and hold to unlock</span>
        </button>
      </div>
    </motion.div>,
    document.body,
  )
}
