// First launch: pick a program and a name. Everything stays on this phone.
import { useState } from 'react'
import { motion } from 'motion/react'
import { AnatomyFigure } from '../anatomy/AnatomyFigure'
import { programs, type ProgramId } from '../data/programs'
import { saveProfile, todayISO } from '../lib/profile'
import { haptic } from '../lib/haptics'
import { Icon } from '../components/Icon'

export function Onboarding() {
  const [program, setProgram] = useState<ProgramId>('athletic')
  const [name, setName] = useState('')
  const p = programs[program]

  function start() {
    haptic.celebrate()
    saveProfile({
      name: name.trim() || 'Athlete',
      program,
      body: p.body,
      calorieTarget: p.calories,
      proteinTarget: p.protein,
      startDate: todayISO(),
      createdAt: new Date().toISOString(),
    })
  }

  const heroMuscles =
    program === 'athletic'
      ? { quadriceps: 1, gluteal: 0.8, chest: 0.7, deltoids: 0.9, abs: 0.6, biceps: 0.5 }
      : { gluteal: 1, hamstring: 0.8, quadriceps: 0.6, adductors: 0.5, abs: 0.4 }

  return (
    <main className="screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--s-8))' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="stack"
        style={{ alignItems: 'center', textAlign: 'center', gap: 'var(--s-3)', marginTop: 'var(--s-6)' }}
      >
        <span className="chip chip--accent">
          <Icon name="sparkle" size={14} /> Lift &amp; Eat
        </span>
        <h1 className="large-title">Train like you're in season.</h1>
        <p className="sub" style={{ maxWidth: 320 }}>
          Plan your meals once a week, log every set in a tap, and watch your player card level up.
        </p>
      </motion.div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: 'var(--s-2) 0' }}>
        <motion.div
          key={program}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        >
          <AnatomyFigure
            body={p.body}
            side={program === 'glute' ? 'back' : 'front'}
            muscles={heroMuscles}
            height="min(36vh, 300px)"
          />
        </motion.div>
      </div>

      <section className="stack gap-3" aria-labelledby="pick-program">
        <h2 id="pick-program" className="eyebrow">
          Choose your program
        </h2>
        <div role="radiogroup" aria-labelledby="pick-program" className="stack gap-3">
          {Object.values(programs).map((prog) => {
            const selected = prog.id === program
            return (
              <button
                key={prog.id}
                role="radio"
                aria-checked={selected}
                className="card"
                onClick={() => {
                  haptic.light()
                  setProgram(prog.id)
                }}
                style={{
                  textAlign: 'left',
                  padding: 'var(--s-4) var(--s-5)',
                  outline: selected ? '2px solid var(--accent)' : '2px solid transparent',
                  outlineOffset: -2,
                  transition: 'outline-color var(--dur-med)',
                }}
              >
                <div className="card-row">
                  <div className="stack gap-1">
                    <span className="title3">{prog.name}</span>
                    <span className="sub">{prog.tagline}</span>
                    <span className="caption num">
                      {prog.calories.toLocaleString()} cal · {prog.protein} g protein (editable)
                    </span>
                  </div>
                  <span
                    aria-hidden
                    style={{
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 13,
                      display: 'grid',
                      placeItems: 'center',
                      background: selected ? 'var(--accent-fill)' : 'var(--surface-strong)',
                      color: '#fff',
                      transition: 'background var(--dur-med)',
                    }}
                  >
                    {selected && <Icon name="check" size={16} strokeWidth={3} />}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <label className="stack gap-2">
        <span className="eyebrow">Your name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Shown on your player card"
          autoComplete="given-name"
          enterKeyHint="go"
          onKeyDown={(e) => e.key === 'Enter' && start()}
        />
      </label>

      <button className="btn btn--primary btn--block" onClick={start}>
        Start Preseason <Icon name="chevron" size={18} strokeWidth={2.5} />
      </button>
      <p className="caption" style={{ textAlign: 'center' }}>
        Your data stays on this phone. No account needed.
      </p>
    </main>
  )
}
