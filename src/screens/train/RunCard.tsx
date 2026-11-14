// "Go for a run" card on Train: GPS tracker, or import a GPX file from Strava.
import { useRef, useState } from 'react'
import type { Profile } from '../../lib/profile'
import { db, uid, type RunRecord } from '../../lib/db'
import { elevationGain, mileSplits, parseGPX, totalDistance, type RunPoint } from '../../lib/runMath'
import { saveRunAsWorkout, useRunLive } from '../../lib/runTracker'
import { openRun, showRecap } from '../../lib/ui'
import { haptic } from '../../lib/haptics'
import { Icon } from '../../components/Icon'

export function RunCard({ profile, suggestedType }: { profile: Profile; suggestedType?: string }) {
  const live = useRunLive()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

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
    </section>
  )
}
