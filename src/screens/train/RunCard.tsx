// "Go for a run" card on Train: GPS tracker, log a run by hand, or import a GPX file from Strava.
import { useRef, useState } from 'react'
import type { Profile } from '../../lib/profile'
import { db, uid, type RunRecord } from '../../lib/db'
import { elevationGain, formatPace, mileSplits, parseGPX, totalDistance, type RunPoint } from '../../lib/runMath'
import { todayISO } from '../../lib/profile'
import { Sheet } from '../../components/Sheet'
import { logManualRun, saveRunAsWorkout, useRunLive } from '../../lib/runTracker'
import { openRun, showRecap } from '../../lib/ui'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export function RunCard({ profile, suggestedType, date }: { profile: Profile; suggestedType?: string; date?: string }) {
  const live = useRunLive()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [manual, setManual] = useState(false)

  async function importGPX(file: File) {
    setMsg('')
    try {
      const { points, name } = parseGPX(await file.text())
      if (points.length < 2) throw new Error('No GPS track found in that file.')
      const pts = points as RunPoint[]
      // Moving time: total time minus gaps longer than 30 s.
      let moving = 0
      for (let i = 1; i < pts.length; i++) {
        const dt = (pts[i][2] - pts[i - 1][2]) / 1000
        if (pts[i][4] === pts[i - 1][4] && dt > 0 && dt < 30) moving += dt
      }
      const run: RunRecord = {
        id: uid(),
        status: 'done',
        source: 'gpx',
        type: 'Run',
        name: name ?? undefined,
        startedAt: new Date(pts[0][2] > 1e11 ? pts[0][2] : Date.now()).toISOString(),
        endedAt: new Date(pts.at(-1)![2] > 1e11 ? pts.at(-1)![2] : Date.now()).toISOString(),
        points: pts,
        pauses: [],
        distanceM: totalDistance(pts),
        movingSec: Math.round(moving),
        splits: mileSplits(pts),
        elevGainM: elevationGain(pts),
      }
      const dup = await db.runs.where('status').equals('done').filter((r) => r.startedAt === run.startedAt).first()
      if (dup) throw new Error('That run is already imported.')
      const w = await saveRunAsWorkout(run, profile)
      haptic.success()
      showRecap(w)
    } catch (e) {
      setMsg((e as Error).message || "Couldn't read that file.")
    }
  }

  return (
    <section className="card stack gap-3" aria-label="Go for a run">
      <div className="card-row">
        <div className="stack" style={{ gap: 2 }}>
          <span className="title3">{live.status !== 'idle' ? 'Run in progress' : 'Going for a run?'}</span>
          <span className="caption">
            {live.status !== 'idle' ? `${live.miles.toFixed(2)} mi · ${live.status === 'paused' ? 'paused' : 'tracking'}` : 'GPS tracking with pace, splits and your route line.'}
          </span>
        </div>
        <Icon name="run" size={22} className="accent" />
      </div>
      <button className="btn btn--primary btn--block" onClick={() => openRun(suggestedType)}>
        <Icon name="play" size={16} /> {live.status !== 'idle' ? 'Back to run' : 'Track a run'}
      </button>
      {live.status === 'idle' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".gpx,application/gpx+xml,application/xml,text/xml"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) importGPX(f)
            }}
          />
          <button className="btn btn--secondary btn--block" onClick={() => setManual(true)}>
            <Icon name="pencil" size={15} /> Log a run by hand
          </button>
          <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => fileRef.current?.click()}>
            Import a GPX file (from Strava)
          </button>
        </>
      )}
      {msg && (
        <p className="caption" role="alert" style={{ color: 'var(--text)' }}>
          {msg}
        </p>
      )}
      <Sheet open={manual} onClose={() => setManual(false)} title="Log a run">
        {manual && (
          <ManualRunForm
            initialDate={date}
            onSave={async (r) => {
              const w = await logManualRun(profile, r)
              haptic.success()
              setManual(false)
              showRecap(w)
            }}
          />
        )}
      </Sheet>
    </section>
  )
}

const runTypes = ['Run', 'Easy run', 'Treadmill', 'Trail run', 'Walk']

function ManualRunForm({ onSave, initialDate }: { onSave: (r: { date: string; type: string; miles: number; seconds: number }) => void; initialDate?: string }) {
  const today = todayISO()
  const yesterday = todayISO(new Date(Date.now() - 864e5))
  const [date, setDate] = useState(initialDate && initialDate < today ? initialDate : today)
  const [type, setType] = useState('Run')
  const [miles, setMiles] = useState('')
  const [h, setH] = useState('')
  const [m, setM] = useState('')
  const [sec, setSec] = useState('')
  const [busy, setBusy] = useState(false)
  const seconds = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(sec) || 0)
  const mi = Number(miles) || 0
  const valid = seconds > 0 && date <= today
  const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 2)

  return (
    <form
      className="stack gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid || busy) return
        setBusy(true)
        onSave({ date, type, miles: mi, seconds })
      }}
    >
      <p className="sub">Forgot to track it? Add it here and it counts for your rings, streak and dino like any other run.</p>
      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          When
        </span>
        <div className="tool-row">
          <button type="button" className={`chip ${date === today ? 'chip--accent' : ''}`} aria-pressed={date === today} onClick={() => setDate(today)}>
            Today
          </button>
          <button type="button" className={`chip ${date === yesterday ? 'chip--accent' : ''}`} aria-pressed={date === yesterday} onClick={() => setDate(yesterday)}>
            Yesterday
          </button>
          <input
            type="date"
            className="field"
            aria-label="Pick a date"
            style={{ flex: 1, minWidth: 140, minHeight: 36, padding: '0 12px' }}
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Type
        </span>
        <div className="tool-row" role="radiogroup" aria-label="Type">
          {runTypes.map((t) => (
            <button type="button" key={t} role="radio" aria-checked={type === t} className={`chip ${type === t ? 'chip--accent' : ''}`} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <label className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Distance (miles)
        </span>
        <input className="field num" inputMode="decimal" value={miles} onChange={(e) => setMiles(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 3.1" />
      </label>
      <div className="stack gap-1">
        <span className="caption" style={{ fontWeight: 600 }}>
          Time
        </span>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          <input className="field num" inputMode="numeric" aria-label="Hours" value={h} onChange={(e) => setH(digits(e.target.value))} placeholder="0" style={{ flex: 1, textAlign: 'center' }} />
          <span className="caption">h</span>
          <input className="field num" inputMode="numeric" aria-label="Minutes" value={m} onChange={(e) => setM(digits(e.target.value))} placeholder="28" style={{ flex: 1, textAlign: 'center' }} />
          <span className="caption">m</span>
          <input className="field num" inputMode="numeric" aria-label="Seconds" value={sec} onChange={(e) => setSec(digits(e.target.value))} placeholder="00" style={{ flex: 1, textAlign: 'center' }} />
          <span className="caption">s</span>
        </div>
      </div>
      {mi > 0 && seconds > 0 && (
        <p className="caption num" aria-live="polite">
          Pace: <strong style={{ color: 'var(--text)' }}>{formatPace(seconds / mi)}</strong> /mi
        </p>
      )}
      <button className="btn btn--primary btn--block" type="submit" disabled={!valid || busy}>
        <Icon name="check" size={18} strokeWidth={2.6} /> Save run
      </button>
    </form>
  )
}
