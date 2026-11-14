// Soundtrack: something to listen to while you train.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { links, pickFor, soundtrack, type ListenItem, type ListenKind } from '../data/soundtrack'
import type { SessionKind } from '../data/programs'
import { todayISO } from '../lib/profile'
import { haptic } from '../lib/haptics'
import { Icon } from '../components/Icon'

const kindLabel: Record<ListenKind, string> = { playlist: 'Playlist', podcast: 'Podcast', audiobook: 'Audiobook' }

function ListenLinks({ item }: { item: ListenItem }) {
  const l = links(item)
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <a className="chip chip--accent" href={l.spotify} target="_blank" rel="noopener noreferrer">
        Spotify
      </a>
      <a className="chip" href={l.apple} target="_blank" rel="noopener noreferrer">
        Apple
      </a>
      <a className="chip" href={l.youtube} target="_blank" rel="noopener noreferrer">
        YouTube
      </a>
    </div>
  )
}

/** Compact "today's pick" card (Today tab, workout screen). */
export function SoundtrackPick({ kind, onMore }: { kind: SessionKind; onMore: () => void }) {
  const [seed, setSeed] = useState(0)
  const item = pickFor(kind, todayISO(), seed)
  return (
    <section className="card stack gap-3" aria-label="Today's soundtrack">
      <div className="card-row">
        <span className="eyebrow row" style={{ gap: 6 }}>
          <Icon name="headphones" size={15} className="accent" /> Today's soundtrack
        </span>
        <button
          className="link-btn"
          style={{ minHeight: 32, padding: 0 }}
          onClick={() => {
            haptic.light()
            setSeed((s) => s + 1)
          }}
          aria-label="Shuffle suggestion"
        >
          <Icon name="swap" size={14} /> Shuffle
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="stack gap-1">
          <span className="caption accent" style={{ fontWeight: 700 }}>
            {kindLabel[item.kind]}
          </span>
          <span className="title3">
            {item.title}
            {item.by && <span className="muted" style={{ fontWeight: 500 }}> · {item.by}</span>}
          </span>
          <span className="sub">{item.why}</span>
        </motion.div>
      </AnimatePresence>
      <div className="card-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <ListenLinks item={item} />
        <button className="link-btn" style={{ minHeight: 32, padding: 0 }} onClick={onMore}>
          More picks
        </button>
      </div>
    </section>
  )
}

/** Full list, grouped by type. Shown in a sheet. */
export function SoundtrackLibrary({ kind }: { kind: SessionKind }) {
  const [tab, setTab] = useState<ListenKind>(kind === 'lift' || kind === 'sprint' ? 'playlist' : 'podcast')
  const items = soundtrack.filter((s) => s.kind === tab)
  return (
    <div className="stack gap-4">
      <div className="segmented" role="tablist" aria-label="Type">
        {(['playlist', 'podcast', 'audiobook'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} aria-checked={tab === k} onClick={() => setTab(k)}>
            {tab === k && <span className="segmented__pill" />}
            <span>{kindLabel[k]}s</span>
          </button>
        ))}
      </div>
      <div className="stack gap-2">
        {items.map((it) => (
          <div key={it.id} className="card stack gap-2" style={{ padding: 'var(--s-4)' }}>
            <div className="stack" style={{ gap: 2 }}>
              <span style={{ fontWeight: 650 }}>
                {it.title}
                {it.by && <span className="muted" style={{ fontWeight: 500 }}> · {it.by}</span>}
              </span>
              <span className="caption">{it.why}</span>
            </div>
            <ListenLinks item={it} />
          </div>
        ))}
      </div>
      <p className="caption">Links open a search in each app, so you can pick the exact episode or playlist you like.</p>
    </div>
  )
}
