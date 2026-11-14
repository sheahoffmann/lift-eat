// Collapsible Today card. Collapsed shows a one-line summary and keeps the main action
// in reach. Remembers your choice on this phone; finished items auto-collapse for the day.
import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { todayISO } from '../lib/profile'
import { haptic } from '../lib/haptics'
import { Icon } from './Icon'

const key = (id: string) => `lift-eat:collapse:${id}`
const read = (id: string) => {
  try {
    return localStorage.getItem(key(id))
  } catch {
    return null
  }
}
const write = (id: string, v: string) => {
  try {
    localStorage.setItem(key(id), v)
  } catch {
    /* ignore */
  }
}

export function Collapsible({
  id,
  title,
  summary,
  action,
  done = false,
  defaultCollapsed = false,
  hero = false,
  glow = false,
  children,
  label,
}: {
  id: string
  title: ReactNode
  summary: ReactNode
  /** Shown on the collapsed row (e.g. "Log it", "Start") so the key action stays one tap. */
  action?: ReactNode
  /** Finished for today: collapses automatically unless you open it again. */
  done?: boolean
  /** Start collapsed until the person opens it. */
  defaultCollapsed?: boolean
  hero?: boolean
  glow?: boolean
  children: ReactNode
  label?: string
}) {
  const today = todayISO()
  const [pref, setPref] = useState<string | null>(() => read(id))
  const collapsed = done ? pref !== `open:${today}` : pref ? pref === "closed" : defaultCollapsed

  function toggle() {
    haptic.light()
    const next = collapsed ? (done ? `open:${today}` : 'open') : 'closed'
    write(id, next)
    setPref(next)
  }

  return (
    <section className={`card ${hero && !collapsed ? 'card--hero' : ''} ${glow && !collapsed ? 'card--glow' : ''}`} aria-label={label} style={{ padding: collapsed ? 'var(--s-3) var(--s-4)' : undefined }}>
      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
        <button className="row" onClick={toggle} aria-expanded={!collapsed} style={{ flex: 1, minWidth: 0, gap: 'var(--s-2)', textAlign: 'left', minHeight: 40 }}>
          <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {title}
            </span>
            {collapsed && (
              <span className="sub" style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {summary}
              </span>
            )}
          </div>
          <span aria-hidden style={{ display: "grid", transform: collapsed ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform var(--dur-med) var(--ease-out)" }}>
            <Icon name="chevron" size={16} className="muted" strokeWidth={2.4} />
          </span>
        </button>
        {collapsed && action}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 'var(--s-2)' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
