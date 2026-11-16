// Exercise detail: glowing anatomy, stat row, form cues, video, and history.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { exercises } from '../../data/exercises'
import { muscleNames } from '../../anatomy/muscles'
import { AnatomyFigure } from '../../anatomy/AnatomyFigure'
import { bestSide } from '../../anatomy/muscles'
import { db } from '../../lib/db'
import { e1rm, effectiveLoad, formatSeconds } from '../../lib/training'
import { Icon } from '../../components/Icon'
import { haptic } from '../../lib/haptics'
import { settingsOf, useProfile } from '../../lib/profile'
import { updateCustomExercise } from '../../lib/customExercises'
import { ExerciseFields, draftFrom, draftToFields, type ExerciseDraft } from './ExerciseFields'

export function parseYouTube(url: string): { id: string; start: number } | null {
  try {
    const u = new URL(url.trim())
    let id = ''
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1)
    else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2]
    else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2]
    else id = u.searchParams.get('v') ?? ''
    if (!/^[\w-]{6,15}$/.test(id)) return null
    const t = u.searchParams.get('t') ?? u.searchParams.get('start') ?? ''
    const m = t.match(/(?:(\d+)m)?(\d+)s?$/)
    const start = m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : 0
    return { id, start }
  } catch {
    return null
  }
}

function parseTime(s: string) {
  const parts = s.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0]
}

export function ExerciseDetail({
  exerciseId,
  body,
  target,
}: {
  exerciseId: string
  body: 'male' | 'female'
  target?: { sets: number; reps: [number, number]; rest: number; perSide?: boolean; seconds?: number; yards?: number }
}) {
  const ex = exercises[exerciseId]
  const settings = useLiveQuery(() => db.exerciseSettings.get(exerciseId), [exerciseId])
  const history = useLiveQuery(() => db.sets.where('exerciseId').equals(exerciseId).toArray(), [exerciseId], [])
  const [playing, setPlaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [start, setStart] = useState('')

  const custom = useLiveQuery(() => (exerciseId.startsWith('custom-') ? db.customExercises.get(exerciseId) : undefined), [exerciseId])
  const [profile] = useProfile()
  const [draft, setDraft] = useState<ExerciseDraft | null>(null)
  const [saving, setSaving] = useState(false)

  if (!ex) return <p className="sub">Exercise not found.</p>

  if (draft && custom) {
    return (
      <form
        className="stack gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!draft.name.trim() || saving) return
          setSaving(true)
          await updateCustomExercise(custom.id, draftToFields(draft))
          haptic.success()
          setSaving(false)
          setDraft(null)
        }}
      >
        <span className="title3">Edit exercise</span>
        <ExerciseFields draft={draft} setDraft={setDraft} passcode={profile ? settingsOf(profile).aiPasscode : undefined} body={body} />
        <button className="btn btn--primary btn--block" type="submit" disabled={!draft.name.trim() || saving}>
          <Icon name="check" size={18} strokeWidth={2.6} /> Save changes
        </button>
        <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setDraft(null)}>
          Cancel
        </button>
        <p className="caption">Changes apply everywhere this exercise is used, including its history, and sync to everyone sharing the library.</p>
      </form>
    )
  }
  const muscles = Object.fromEntries([...ex.primary.map((m) => [m, 1]), ...ex.secondary.map((m) => [m, 0.45])])
  const video = settings?.videoUrl ? parseYouTube(settings.videoUrl) : null
  const startAt = settings?.videoStart ?? video?.start ?? 0

  // History grouped by workout, newest first.
  const byWorkout = new Map<string, typeof history>()
  for (const s of history) byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), s])
  const sessions = [...byWorkout.values()]
    .map((sets) => sets.sort((a, b) => a.setIndex - b.setIndex))
    .sort((a, b) => b[0].completedAt.localeCompare(a[0].completedAt))
  const best = Math.max(0, ...history.map((s) => e1rm(effectiveLoad(ex, s.weight, s.bodyweight ?? 180), s.reps)))

  function watch() {
    haptic.light()
    if (video) setPlaying(true)
    else window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} proper form`)}`, '_blank', 'noopener')
  }

  async function saveVideo() {
    const parsed = parseYouTube(url)
    if (!parsed) return
    await db.exerciseSettings.put({ ...(settings ?? { exerciseId }), exerciseId, videoUrl: url.trim(), videoStart: start ? parseTime(start) : parsed.start })
    haptic.success()
    setEditing(false)
    setUrl('')
    setStart('')
  }

  return (
    <div className="stack gap-4">
      <div className="card card--glow" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--s-4)', padding: 'var(--s-4)' }}>
        <AnatomyFigure body={body} side={bestSide(muscles)} muscles={muscles} height={220} />
      </div>

      <div>
        <h2 className="title1">{ex.name}</h2>
        <p className="sub" style={{ marginTop: 4 }}>
          {ex.primary.map((m) => muscleNames[m]).join(', ')}
          {ex.secondary.length > 0 && <span className="muted"> · also {ex.secondary.map((m) => muscleNames[m]).join(', ')}</span>}
        </p>
        {custom && (
          <div className="row" style={{ gap: 'var(--s-3)', marginTop: 'var(--s-2)', alignItems: 'center' }}>
            <button className="btn btn--secondary btn--sm" onClick={() => setDraft(draftFrom(custom))}>
              <Icon name="pencil" size={14} /> Edit exercise
            </button>
            <span className="caption">{custom.addedBy && profile && custom.addedBy !== profile.name ? `Added by ${custom.addedBy}` : 'Your exercise'}</span>
          </div>
        )}
      </div>

      {target && (
        <div className="card stats">
          <div className="stat">
            <span className="stat__value num">{target.sets}</span>
            <span className="stat__label">sets</span>
          </div>
          <div className="stat">
            <span className="stat__value num">
              {target.seconds ? `${target.seconds}` : target.yards ? `${target.yards}` : target.reps[0] === target.reps[1] ? target.reps[0] : `${target.reps[0]}–${target.reps[1]}`}
              <span className="stat__unit">{target.seconds ? 's' : target.yards ? 'yd' : target.perSide ? '/side' : ''}</span>
            </span>
            <span className="stat__label">{target.seconds ? 'hold' : target.yards ? 'distance' : 'reps'}</span>
          </div>
          <div className="stat">
            <span className="stat__value num">{formatSeconds(target.rest)}</span>
            <span className="stat__label">rest</span>
          </div>
        </div>
      )}

      <section className="card stack gap-3">
        <h3 className="eyebrow">Form cues</h3>
        <ol className="stack gap-2" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {ex.cues.map((c, i) => (
            <li key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className="pill-sm pill-sm--accent" style={{ minWidth: 24, justifyContent: 'center' }}>
                {i + 1}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
        <div className="row" style={{ alignItems: 'flex-start', gap: 10, paddingTop: 'var(--s-2)', borderTop: '1px solid var(--hairline)' }}>
          <Icon name="close" size={18} className="muted" />
          <span className="sub">
            <strong style={{ color: 'var(--text)' }}>Common mistake:</strong> {ex.mistake}
          </span>
        </div>
      </section>

      <section className="stack gap-2">
        {playing && video ? (
          <div className="card" style={{ padding: 0, aspectRatio: '16 / 9' }}>
            <iframe
              title={`${ex.name} video`}
              src={`https://www.youtube-nocookie.com/embed/${video.id}?start=${startAt}&autoplay=1&playsinline=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>
        ) : (
          <button className="btn btn--primary btn--block" onClick={watch}>
            <Icon name="play" size={18} /> {video ? 'Watch my video' : 'Watch how (YouTube search)'}
          </button>
        )}
        {editing ? (
          <div className="card stack gap-2">
            <input className="field" placeholder="Paste a YouTube link" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
            <input className="field" placeholder="Start at (m:ss), optional" value={start} onChange={(e) => setStart(e.target.value)} />
            {url && !parseYouTube(url) && <span className="caption">That doesn't look like a YouTube link.</span>}
            <div className="row">
              <button className="btn btn--secondary btn--sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <span className="spacer" />
              {video && (
                <button
                  className="link-btn"
                  onClick={async () => {
                    await db.exerciseSettings.put({ ...(settings ?? { exerciseId }), exerciseId, videoUrl: undefined, videoStart: undefined })
                    setEditing(false)
                  }}
                >
                  Remove
                </button>
              )}
              <button className="btn btn--primary btn--sm" disabled={!parseYouTube(url)} onClick={saveVideo}>
                Save video
              </button>
            </div>
          </div>
        ) : (
          <button className="link-btn" style={{ alignSelf: 'center' }} onClick={() => setEditing(true)}>
            {video ? 'Change my video' : 'Save a video for this exercise'}
          </button>
        )}
      </section>

      <section className="card stack gap-2">
        <div className="card-row">
          <h3 className="eyebrow">Your history</h3>
          {best > 0 && ex.logType !== 'timed' && <span className="caption num">Best est. 1RM {Math.round(best)} lb</span>}
        </div>
        {sessions.length === 0 ? (
          <p className="sub">No sets logged yet. Your first session sets the baseline.</p>
        ) : (
          sessions.slice(0, 8).map((sets) => (
            <div key={sets[0].workoutId} className="g-row" style={{ minHeight: 44 }}>
              <span className="caption num" style={{ width: 64 }}>
                {new Date(sets[0].date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
              <span className="num" style={{ flex: 1, fontWeight: 600 }}>
                {sets
                  .map((s) => (ex.logType === 'timed' ? `${s.seconds}s` : ex.logType === 'distance' ? `${s.weight}×${s.yards}yd` : s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`))
                  .join('  ')}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
