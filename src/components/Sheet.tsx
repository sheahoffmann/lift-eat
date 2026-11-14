// Bottom sheet and full-screen cover, iOS-style. Swipe down or tap the scrim to close.
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Icon } from './Icon'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Full-height cover (planner) instead of a content-height sheet. */
  full?: boolean
  /** Hide the built-in header when the content draws its own. */
  bare?: boolean
}

export function Sheet({ open, onClose, title, children, full, bare }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root" role="presentation">
          <motion.div
            className="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`sheet ${full ? 'sheet--full' : ''}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={!full}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="glow glow--sheet" aria-hidden />
            {!full && <div className="sheet__handle" aria-hidden />}
            {!bare && (
              <div className="sheet__header">
                <h2 className="title3">{title}</h2>
                <button className="icon-btn" onClick={onClose} aria-label="Close">
                  <Icon name="close" size={18} />
                </button>
              </div>
            )}
            <div className="sheet__body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
