import { motion } from 'motion/react'
import { Icon, type IconName } from './Icon'
import { haptic } from '../lib/haptics'

export type TabKey = 'today' | 'train' | 'eat' | 'progress'

const tabs: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Today', icon: 'today' },
  { key: 'train', label: 'Train', icon: 'train' },
  { key: 'eat', label: 'Eat', icon: 'eat' },
  { key: 'progress', label: 'Progress', icon: 'progress' },
]

export function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => {
        const current = t.key === active
        return (
          <button
            key={t.key}
            className="tab"
            aria-current={current ? 'page' : undefined}
            onClick={() => {
              if (!current) haptic.light()
              onChange(t.key)
            }}
          >
            {current && (
              <motion.span
                layoutId="tab-pill"
                className="tab__pill"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
