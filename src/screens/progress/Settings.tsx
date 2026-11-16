// Settings: targets, phase, schedule, equipment, rest, celebrations, data.
import { myLabels, myLabelsOn } from '../../data/myLabels'
import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { macroTargets, saveProfile, settingsOf, todayISO, updateSettings, type EquipmentProfileKey, type Profile } from '../../lib/profile'
import type { Equipment } from '../../data/exerciseTypes'
import { useTheme, type ThemePref } from '../../lib/theme'
import { exportCSV, exportJSON, restoreBackup } from '../../lib/backup'
import { askNotificationPermission } from '../../lib/restTimer'
import { haptic } from '../../lib/haptics'
import { dayNames } from '../../data/programs'

const equipmentLabels: [Equipment, string][] = [
  ['barbell', 'Barbell + rack'],
  ['trap-bar', 'Trap bar'],
  ['dumbbells', 'Dumbbells'],
  ['kettlebell', 'Kettlebells'],
  ['cable', 'Cable station'],
  ['machine', 'Machines'],
  ['smith', 'Smith machine'],
  ['pull-up-bar', 'Pull-up bar'],
  ['bench', 'Bench'],
  ['box', 'Plyo box'],
  ['med-ball', 'Med ball'],
  ['landmine', 'Landmine'],
  ['bands', 'Bands'],
]

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          role="radio"
          aria-checked={value === k}
          onClick={() => {
            haptic.light()
            onChange(k)
          }}
        >
          {value === k && <motion.span layoutId={`seg-${label}`} className="segmented__pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span>{l}</span>
        </button>
      ))}
    </div>
  )
}

function NumberRow({ label, value, onChange, step = 1, min = 0, max = 10000, suffix = '' }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="card-row" style={{ minHeight: 48 }}>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button className="icon-btn" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))}>
          −
        </button>
        <span className="num" style={{ minWidth: 64, textAlign: 'center', fontWeight: 700 }} aria-live="polite">
          {value.toLocaleString()}
          {suffix}
        </span>
        <button className="icon-btn" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))}>
          +
        </button>
      </div>
    </div>
  )
}

export function Settings({ profile }: { profile: Profile }) {
  const s = settingsOf(profile)
  const labelsOn = myLabelsOn(profile.program, s.myLabels)
  const [theme, setTheme] = useTheme()
  const [eqProfile, setEqProfile] = useState<EquipmentProfileKey>(s.equipmentProfile)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<Profile>) => saveProfile({ ...profile, ...patch })

  return (
    <div className="stack gap-5">
      <section className="stack gap-2">
        <h3 className="eyebrow">Targets</h3>
        <div className="card" style={{ padding: 'var(--s-2) var(--s-4)' }}>
          <NumberRow label="Calories" value={profile.calorieTarget} step={50} min={1200} max={5000} onChange={(n) => set({ calorieTarget: n })} />
          <NumberRow label="Protein" value={profile.proteinTarget} step={5} min={60} max={350} suffix=" g" onChange={(n) => set({ proteinTarget: n })} />
          <NumberRow label="Carbs" value={macroTargets(profile).carbs} step={5} min={0} max={800} suffix=" g" onChange={(n) => set({ carbTarget: n })} />
          <NumberRow label="Fat" value={macroTargets(profile).fat} step={5} min={20} max={300} suffix=" g" onChange={(n) => set({ fatTarget: n })} />
        </div>
        <p className="caption">
          Carbs and fat {profile.carbTarget == null && profile.fatTarget == null ? 'adjust automatically with your calories (fat ≈ 28%, carbs fill the rest)' : 'are set manually'}.{' '}
          {(profile.carbTarget != null || profile.fatTarget != null) && (
            <button className="link-btn" style={{ minHeight: 0, padding: 0 }} onClick={() => set({ carbTarget: undefined, fatTarget: undefined })}>
              Back to automatic
            </button>
          )}{' '}
          Weekly check-ins suggest ±150 calorie changes based on your weight trend.
        </p>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Season</h3>
        <div className="card stack gap-3">
          <label className="card-row">
            <span style={{ fontWeight: 500 }}>Start date</span>
            <input className="field" type="date" value={profile.startDate} max={todayISO()} onChange={(e) => e.target.value && set({ startDate: e.target.value })} style={{ width: 170, minHeight: 40 }} />
          </label>
          {s.buildStartedAt ? (
            <div className="stack gap-2">
              <span className="sub">Season 2: Build since {s.buildStartedAt}.</span>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  if (confirm('Go back to Season 1: Cut? Calories drop by 700.')) {
                    saveProfile({ ...profile, calorieTarget: profile.calorieTarget - 700, settings: { ...s, buildStartedAt: undefined } })
                  }
                }}
              >
                Back to the cut
              </button>
            </div>
          ) : (
            <div className="stack gap-2">
              <span className="sub">When the cut is done, Season 2: Build adds about 700 calories. Weekly check-ins fine-tune from there.</span>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  if (confirm(`Start Season 2: Build? Calories go from ${profile.calorieTarget} to ${profile.calorieTarget + 700}.`)) {
                    saveProfile({ ...profile, calorieTarget: profile.calorieTarget + 700, settings: { ...s, buildStartedAt: todayISO() } })
                    haptic.celebrate()
                  }
                }}
              >
                Start Season 2: Build
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Shopping day</h3>
        <div className="tool-row">
          {dayNames.map((d, i) => (
            <button key={d} className={`chip ${s.shoppingDay === i ? 'chip--accent' : ''}`} onClick={() => updateSettings(profile, { shoppingDay: i })} aria-pressed={s.shoppingDay === i}>
              {d}
            </button>
          ))}
        </div>
        <p className="caption">Today shows "Plan your week" on this day.</p>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Equipment by location</h3>
        <Segmented
          label="Location"
          value={eqProfile}
          onChange={setEqProfile}
          options={[
            ['gym', 'Full gym'],
            ['travel', 'Hotel'],
            ['home', 'Home'],
          ]}
        />
        <div className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
          {equipmentLabels.map(([k, label]) => {
            const on = s.equipment[eqProfile].includes(k)
            return (
              <button
                key={k}
                className="g-row"
                role="switch"
                aria-checked={on}
                onClick={() => {
                  const list = on ? s.equipment[eqProfile].filter((e) => e !== k) : [...s.equipment[eqProfile], k]
                  updateSettings(profile, { equipment: { ...s.equipment, [eqProfile]: list } })
                }}
              >
                <span style={{ flex: 1 }}>{label}</span>
                <span className="toggle" aria-checked={on} aria-hidden />
              </button>
            )
          })}
        </div>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Your gym's weights</h3>
        <div className="card" style={{ padding: 'var(--s-2) var(--s-4)' }}>
          <NumberRow label="Dumbbell jumps" value={s.dumbbellStep} step={2.5} min={2.5} max={10} suffix=" lb" onChange={(n) => updateSettings(profile, { dumbbellStep: n })} />
          <NumberRow label="Heaviest dumbbell" value={s.dumbbellMax} step={5} min={20} max={200} suffix=" lb" onChange={(n) => updateSettings(profile, { dumbbellMax: n })} />
          <NumberRow label="Smallest barbell jump" value={s.barbellStep} step={2.5} min={2.5} max={10} suffix=" lb" onChange={(n) => updateSettings(profile, { barbellStep: n })} />
          <NumberRow label="Machine pin steps" value={s.stackStep} step={2.5} min={2.5} max={20} suffix=" lb" onChange={(n) => updateSettings(profile, { stackStep: n })} />
        </div>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Rest timer</h3>
        <div className="card" style={{ padding: 'var(--s-2) var(--s-4)' }}>
          <NumberRow label="Heavy compounds" value={s.rest.heavy} step={15} min={30} max={600} suffix="s" onChange={(n) => updateSettings(profile, { rest: { ...s.rest, heavy: n } })} />
          <NumberRow label="Secondary lifts" value={s.rest.secondary} step={15} min={30} max={600} suffix="s" onChange={(n) => updateSettings(profile, { rest: { ...s.rest, secondary: n } })} />
          <NumberRow label="Accessories" value={s.rest.accessory} step={15} min={15} max={600} suffix="s" onChange={(n) => updateSettings(profile, { rest: { ...s.rest, accessory: n } })} />
          <NumberRow label="Power work" value={s.rest.power} step={15} min={30} max={600} suffix="s" onChange={(n) => updateSettings(profile, { rest: { ...s.rest, power: n } })} />
          <button className="g-row" role="switch" aria-checked={s.sound} onClick={() => updateSettings(profile, { sound: !s.sound })}>
            <span style={{ flex: 1 }}>Chime when rest ends</span>
            <span className="toggle" aria-checked={s.sound} aria-hidden />
          </button>
        </div>
        <button className="link-btn" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={askNotificationPermission}>
          Allow notifications
        </button>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">My food labels</h3>
        <div className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
          <button className="g-row" role="switch" aria-checked={labelsOn} onClick={() => updateSettings(profile, { myLabels: !labelsOn })}>
            <span style={{ flex: 1 }}>Use my exact label numbers</span>
            <span className="toggle" aria-checked={labelsOn} aria-hidden />
          </button>
          {Object.entries(myLabels).map(([id, l]) => (
            <div key={id} className="g-row" style={{ minHeight: 44, opacity: labelsOn ? 1 : 0.5 }}>
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--fs-sub)' }}>{l.name}</span>
                <span className="caption">{l.serving}</span>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(s.scannedLabels ?? {}).length > 0 && (
          <>
            <span className="caption" style={{ fontWeight: 600, marginTop: 'var(--s-2)' }}>
              Labels you scanned (always used)
            </span>
            <div className="card" style={{ padding: 'var(--s-1) var(--s-4)' }}>
              {Object.entries(s.scannedLabels ?? {}).map(([id, l]) => (
                <div key={id} className="g-row" style={{ minHeight: 44 }}>
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--fs-sub)' }}>{l.name}</span>
                    <span className="caption">{l.serving}</span>
                  </div>
                  <button
                    className="link-btn"
                    style={{ color: 'var(--text-3)' }}
                    onClick={() => {
                      const next = { ...(s.scannedLabels ?? {}) }
                      delete next[id]
                      updateSettings(profile, { scannedLabels: next })
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="caption">Meal macros, the planner and the grocery list use these numbers on this phone only. Turn it off to go back to typical values.</p>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Photo &amp; link reader</h3>
        <input
          className="field"
          type="password"
          autoComplete="off"
          placeholder="Passcode (same as APP_PASSCODE on Netlify)"
          defaultValue={s.aiPasscode ?? ''}
          onChange={(e) => updateSettings(profile, { aiPasscode: e.target.value.trim() || undefined })}
          aria-label="Photo and link reader passcode"
        />
        <p className="caption">
          {s.aiPasscode ? <span className="accent">Saved ✓ </span> : null}
          Lets you log food from a nutrition-label photo or a link. Each read costs about a cent on your Anthropic account.
        </p>
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Celebrations</h3>
        <Segmented
          label="Celebrations"
          value={s.celebration}
          onChange={(v) => updateSettings(profile, { celebration: v })}
          options={[
            ['full', 'Full'],
            ['subtle', 'Subtle'],
            ['off', 'Off'],
          ]}
        />
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Appearance</h3>
        <Segmented
          label="Appearance"
          value={theme}
          onChange={(v: ThemePref) => setTheme(v)}
          options={[
            ['system', 'System'],
            ['dark', 'Dark'],
            ['light', 'Light'],
          ]}
        />
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Your data</h3>
        <p className="caption">Everything lives only on this phone. Back up now and then, especially before clearing Safari data or switching phones.</p>
        <button className="btn btn--primary btn--block" onClick={() => exportJSON(profile)}>
          Back up everything (JSON)
        </button>
        <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
          {(
            [
              ['sets', 'Sets CSV'],
              ['workouts', 'Workouts CSV'],
              ['food', 'Food CSV'],
              ['weight', 'Weight CSV'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className="chip" onClick={() => exportCSV(k)}>
              {l}
            </button>
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            if (!confirm('Restore this backup? It replaces everything currently on this phone.')) return
            try {
              await restoreBackup(f)
              setMsg('Backup restored.')
            } catch (err) {
              setMsg((err as Error).message)
            }
          }}
        />
        <button className="btn btn--secondary btn--block" onClick={() => fileRef.current?.click()}>
          Restore from backup
        </button>
        {msg && <p className="caption accent">{msg}</p>}
      </section>

      <section className="stack gap-2">
        <h3 className="eyebrow">Profile</h3>
        <div className="card-row card">
          <div className="stack">
            <span style={{ fontWeight: 600 }}>{profile.name}</span>
            <span className="caption">{profile.program === 'athletic' ? 'Athletic Strength' : 'Glute Builder'}</span>
          </div>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => {
              if (confirm('Switch program? This returns to setup. Your logged data stays on this phone.')) saveProfile(null)
            }}
          >
            Change
          </button>
        </div>
      </section>
    </div>
  )
}
