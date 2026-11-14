// Training pet: a pixel dinosaur that grows with consistency. Card for Today + collection sheet.
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { dinoSpecies, rarityInfo, speciesById, type DinoRarity } from '../data/dinos'
import { capturePet, computeProgress, ensurePet, usePets, type PetProgress } from '../lib/pet'
import { useGameData } from '../lib/game'
import type { Profile } from '../lib/profile'
import { celebrate } from '../lib/celebrate'
import { haptic } from '../lib/haptics'
import { PixelDino } from '../components/PixelDino'
import { Sheet } from '../components/Sheet'
import { Icon } from '../components/Icon'
import { Collapsible } from '../components/Collapsible'

function usePetProgress(profile: Profile): PetProgress | null {
  const pets = usePets()
  const data = useGameData()
  useEffect(() => {
    if (pets && !pets.some((p) => p.status === 'active')) ensurePet()
  }, [pets])
  const active = pets?.find((p) => p.status === 'active')
  if (!active || !data) return null
  return computeProgress(active, data, profile)
}

function statusLine(p: PetProgress) {
  if (p.pet.hatchedAt > new Date().toISOString().slice(0, 10)) return 'A new egg arrives tomorrow.'
  if (p.captureReady) return 'Fully grown. Capture it to keep it forever!'
  if (p.todayFed) return p.stage === 'Egg' ? 'Warming up…' : 'Fed today. Nice work.'
  if (p.trend === 'shrinking') return 'It shrank a little. One good day grows it back.'
  if (!p.today.train) return 'Hungry: train today and log your food to feed it.'
  return 'Hungry: log your food to feed it.'
}

export function PetCard({ profile }: { profile: Profile }) {
  const p = usePetProgress(profile)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Hatch reveal, once per pet.
  useEffect(() => {
    if (!p || p.stage === 'Egg' || p.stage === 'Captured') return
    const key = `lift-eat:hatched:${p.pet.id}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      return
    }
    celebrate({ kind: 'toast', title: `Your egg hatched: it's a ${rarityInfo[p.species.rarity].label} ${p.species.name}!` })
  }, [p?.pet.id, p?.stage]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null
  const rarity = rarityInfo[p.species.rarity]
  const isEgg = p.stage === 'Egg'

  async function capture() {
    if (!p) return
    setBusy(true)
    await capturePet(p.pet)
    haptic.celebrate()
    celebrate({ kind: 'achievement', title: `${p.species.name} captured!`, desc: `${p.species.blurb} It's in your collection forever.`, rarity: p.species.rarity })
    setBusy(false)
  }

  return (
    <>
      <Collapsible
        id="pet"
        label="Your dinosaur"
        title="Your dino"
        summary={`${isEgg ? `${rarity.label} egg` : p.species.name} · ${p.stage} · ${p.progress}/${p.target} days${p.todayFed ? " · fed ✓" : ""}`}
        action={<PixelDino species={p.species} stage={p.stage} size={44} mood={p.todayFed ? "happy" : "hungry"} />}
      >
      <motion.button
        onClick={() => setOpen(true)}
        style={{ width: "100%", textAlign: "left", padding: 0, borderRadius: "var(--r-md)", outline: p.captureReady ? `2px solid ${rarity.color}` : undefined, outlineOffset: 4 }}
        aria-label={`Your dinosaur: ${isEgg ? `${rarity.label} egg` : `${p.species.name}, ${p.stage}`}. ${p.progress} of ${p.target} days. ${statusLine(p)}`}
      >
        <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
          <PixelDino species={p.species} stage={p.stage} size={104} mood={p.todayFed ? 'happy' : 'hungry'} />
          <div className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <span className="pill-sm" style={{ alignSelf: 'flex-start', color: rarity.color, background: 'var(--surface-strong)' }}>
              {rarity.label}
            </span>
            <span className="title3">{isEgg ? 'Mystery egg' : p.species.name}</span>
            <span className="caption">
              {p.stage} · {p.progress}/{p.target} days
            </span>
            <div className="bar" style={{ marginTop: 2 }}>
              <motion.div className="bar__fill" style={{ background: rarity.color, boxShadow: 'none' }} animate={{ scaleX: Math.max(0.02, p.progress / p.target) }} />
            </div>
            <span className="caption" style={{ color: p.todayFed ? 'var(--accent)' : 'var(--text-2)' }}>
              {statusLine(p)}
            </span>
            {!p.captureReady && p.stage !== 'Captured' && (
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} aria-label="Today's feeding checklist">
                <span className={`pill-sm ${p.today.train ? 'pill-sm--accent' : ''}`}>{p.today.train ? '✓' : '○'} Train</span>
                <span className={`pill-sm ${p.today.fuel || p.today.log ? 'pill-sm--accent' : ''}`}>
                  {p.today.fuel || p.today.log ? '✓ Food' : `○ Food · ${p.today.foodCount}/3 logged${p.today.weighed ? '' : ' or weigh-in + 1'}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.button>
      </Collapsible>
      {p.captureReady && (
        <button className="btn btn--primary btn--block" onClick={capture} disabled={busy} style={{ marginTop: 'calc(var(--s-5) * -0.5)' }}>
          <Icon name="sparkle" size={18} /> Capture {p.species.name}
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Your dinosaur">
        <PetDetail p={p} />
      </Sheet>
    </>
  )
}

function PetDetail({ p }: { p: PetProgress }) {
  const pets = usePets() ?? []
  const captured = new Set(pets.filter((x) => x.status === 'captured').map((x) => x.species))
  const rarity = rarityInfo[p.species.rarity]
  const isEgg = p.stage === 'Egg'
  const order: DinoRarity[] = ['common', 'rare', 'epic', 'legendary']

  return (
    <div className="stack gap-5">
      <div className="card card--glow stack" style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-2)' }}>
        <PixelDino species={p.species} stage={p.stage} size={210} mood={p.todayFed ? 'happy' : 'hungry'} roam={p.stage !== 'Egg'} />
        <span className="pill-sm" style={{ color: rarity.color, background: 'var(--surface-strong)' }}>
          {rarity.label}
        </span>
        <span className="title2">{isEgg ? 'Mystery egg' : p.species.name}</span>
        {!isEgg && <span className="sub">{p.species.blurb}</span>}
        <span className="caption num">
          {p.stage} · {p.progress} of {p.target} consistent days to capture
        </span>
      </div>

      <Collapsible id="pet-howto" label="How it works" title="How it works" summary="Feed it daily to grow and capture it" defaultCollapsed>
        <ul className="stack gap-2 sub" style={{ margin: 0, paddingLeft: "1.1em" }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Feed it</strong> by closing your Train ring (a workout, or a planned rest day) and either Fuel (protein + calories) or Log (3+ foods logged).
          </li>
          <li>Each fed day grows it one step: egg → hatchling → baby → juvenile → adult.</li>
          <li>A missed day shrinks it back a step, but never back into the egg. Today only counts once it's over.</li>
          <li>Fully grown? Capture it to keep it forever, then a new random egg arrives.</li>
          <li>
            Rarity sets the challenge: Common 3 days, Rare 7, Epic 14, Legendary 21.
          </li>
        </ul>
      </Collapsible>

      <section className="stack gap-3">
        <div className="card-row">
          <h3 className="eyebrow">Collection</h3>
          <span className="caption num">
            {captured.size} / {dinoSpecies.length}
          </span>
        </div>
        {order.map((r) => (
          <div key={r} className="stack gap-2">
            <span className="caption" style={{ color: rarityInfo[r].color, fontWeight: 700 }}>
              {rarityInfo[r].label} · {rarityInfo[r].daysToCapture} days
            </span>
            <div className="ach-grid">
              {dinoSpecies
                .filter((s) => s.rarity === r)
                .map((s) => {
                  const got = captured.has(s.id)
                  return (
                    <div key={s.id} className="card stack" style={{ alignItems: 'center', padding: 'var(--s-2)', gap: 2, textAlign: 'center' }}>
                      <PixelDino species={speciesById[s.id]} stage="Adult" size={76} silhouette={!got} animate={got} />
                      <span className="caption" style={{ fontWeight: 600, color: got ? 'var(--text)' : 'var(--text-3)' }}>
                        {got ? s.name : '???'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
