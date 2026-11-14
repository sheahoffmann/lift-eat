// Instagram-story style player: progress bars, tap right/left to move,
// swipe down or ✕ to close, auto-advance. Each slide animates in.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, animate } from 'motion/react'
import { haptic } from '../lib/haptics'
import { Icon } from './Icon'

export function Story({ slides, onClose, duration = 6000 }: { slides: ReactNode[]; onClose: () => void; duration?: number }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const start = useRef(Date.now())
  const elapsedBefore = useRef(0)

  useEffect(() => {
    start.current = Date.now()
    elapsedBefore.current = 0
    setProgress(0)
    haptic.light()
  }, [i])

  useEffect(() => {
    if (paused) {
      elapsedBefore.current += Date.now() - start.current
      return
    }
    start.current = Date.now()
    const id = setInterval(() => {
      const p = (elapsedBefore.current + Date.now() - start.current) / duration
      if (p >= 1) {
        if (i < slides.length - 1) setI((n) => n + 1)
        else setProgress(1)
      } else setProgress(p)
    }, 50)
    return () => clearInterval(id)
  }, [paused, i, duration, slides.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((n) => Math.min(slides.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, slides.length])

  const next = () => (i < slides.length - 1 ? setI(i + 1) : onClose())
  const prev = () => setI(Math.max(0, i - 1))

  return createPortal(
    <motion.div
      className="story"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Recap, slide ${i + 1} of ${slides.length}`}
    >
      <div className="glow" aria-hidden />
      <div className="story__bars">
        {slides.map((_, k) => (
          <div key={k} className="story__bar">
            <div className="story__fill" style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <button className="icon-btn story__close" onClick={onClose} aria-label="Close recap">
        <Icon name="close" size={18} />
      </button>
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="story__slide"
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest('button, a, input')) setPaused(true)
          }}
          onPointerUp={(e) => {
            setPaused(false)
            if ((e.target as HTMLElement).closest('button, a, input')) return
            const x = e.clientX / window.innerWidth
            if (x < 0.3) prev()
            else next()
          }}
          onPointerCancel={() => setPaused(false)}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        >
          {slides[i]}
        </motion.div>
      </AnimatePresence>
      <div className="story__nav">
        <button className="btn btn--secondary btn--sm" onClick={prev} disabled={i === 0} aria-label="Previous slide">
          <Icon name="back" size={16} />
        </button>
        <button className="btn btn--invert btn--sm" onClick={next}>
          {i < slides.length - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </motion.div>,
    document.body,
  )
}

/** Number that counts up when it mounts. */
export function CountUp({ value, decimals = 0, suffix = '', className, style }: { value: number; decimals?: number; suffix?: string; className?: string; style?: React.CSSProperties }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const c = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setV })
    return () => c.stop()
  }, [value])
  return (
    <span className={`num ${className ?? ''}`} style={style}>
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}
