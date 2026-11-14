// Renders shareable images (workout summary, player card) on a canvas.
// The anatomy figure is drawn with Path2D straight from the body map paths.
import { bodyData } from '../anatomy/bodyData'
import type { MuscleSlug } from '../anatomy/muscles'
import type { RunPoint } from './runMath'
import { projectRoute } from '../components/RunRoute'

const W = 1080
const H = 1350
const ORANGE = '#ff6a1a'
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

function background(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0a0807'
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W * 0.7, H * 0.18, 0, W * 0.7, H * 0.18, W * 0.9)
  g.addColorStop(0, 'rgba(255,110,30,0.35)')
  g.addColorStop(0.45, 'rgba(122,52,16,0.35)')
  g.addColorStop(1, 'rgba(10,8,7,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: 'male' | 'female',
  side: 'front' | 'back',
  muscles: Partial<Record<MuscleSlug, number>>,
  x: number,
  y: number,
  h: number,
) {
  const view = bodyData[body][side]
  const [vx, vy, vw, vh] = view.viewBox.split(' ').map(Number)
  const s = h / vh
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.translate(-vx, -vy)
  ctx.lineWidth = 1.4 / s
  for (const d of view.outline) {
    const p = new Path2D(d)
    const grad = ctx.createLinearGradient(0, vy, 0, vy + vh)
    grad.addColorStop(0, 'rgba(255,236,222,0.26)')
    grad.addColorStop(1, 'rgba(255,236,222,0.06)')
    ctx.fillStyle = grad
    ctx.fill(p)
    ctx.strokeStyle = 'rgba(255,236,222,0.45)'
    ctx.stroke(p)
  }
  const parts = view.muscles as Record<string, string[]>
  for (const [slug, ds] of Object.entries(parts)) {
    if (slug === 'hair') continue
    for (const d of ds) {
      const p = new Path2D(d)
      ctx.fillStyle = 'rgba(255,236,222,0.05)'
      ctx.fill(p)
      ctx.strokeStyle = 'rgba(255,236,222,0.2)'
      ctx.lineWidth = 0.8 / s
      ctx.stroke(p)
    }
  }
  for (const [slug, v] of Object.entries(muscles) as [string, number][]) {
    if (!parts[slug] || !v) continue
    for (const d of parts[slug]) {
      const p = new Path2D(d)
      ctx.shadowColor = ORANGE
      ctx.shadowBlur = 40 * v
      ctx.fillStyle = `rgba(255,${Math.round(140 - 40 * v)},40,${0.45 + 0.55 * v})`
      ctx.fill(p)
      ctx.shadowBlur = 0
    }
  }
  ctx.restore()
  return (vw / vh) * h
}

function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, weight = 700, color = '#f7f3f0', align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(t, x, y)
}

export type WorkoutShare = {
  title: string
  date: string
  stats: { label: string; value: string }[]
  prs: string[]
  body: 'male' | 'female'
  muscles: Partial<Record<MuscleSlug, number>>
  footer: string
  /** GPS route for runs: drawn instead of the body figure. */
  route?: RunPoint[]
  splits?: string[]
}

function drawRoute(ctx: CanvasRenderingContext2D, route: RunPoint[], x: number, y: number, w: number, h: number) {
  const { paths, start, end } = projectRoute(route, w, h, 30)
  ctx.save()
  ctx.translate(x, y)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of paths) {
    const p = new Path2D(d)
    ctx.shadowColor = ORANGE
    ctx.shadowBlur = 40
    ctx.strokeStyle = 'rgba(255,106,26,0.6)'
    ctx.lineWidth = 16
    ctx.stroke(p)
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#ffa865'
    ctx.lineWidth = 8
    ctx.stroke(p)
  }
  if (start) {
    ctx.fillStyle = '#f7f3f0'
    ctx.beginPath()
    ctx.arc(start[0], start[1], 12, 0, Math.PI * 2)
    ctx.fill()
  }
  if (end) {
    ctx.fillStyle = ORANGE
    ctx.beginPath()
    ctx.arc(end[0], end[1], 14, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export async function renderWorkoutImage(d: WorkoutShare): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  background(ctx)
  text(ctx, 'LIFT & EAT', 80, 120, 34, 800, ORANGE)
  text(ctx, d.date, W - 80, 120, 30, 500, 'rgba(247,243,240,0.6)', 'right')
  text(ctx, d.title, 80, 210, 76, 800)

  // Stats row
  const colW = (W - 160) / d.stats.length
  d.stats.forEach((s, i) => {
    text(ctx, s.value, 80 + i * colW, 340, 72, 800)
    text(ctx, s.label, 80 + i * colW, 385, 28, 500, 'rgba(247,243,240,0.6)')
  })

  let px = 640
  if (d.route && d.route.length > 1) {
    // Run line takes the left side.
    drawRoute(ctx, d.route, 60, 430, 560, 600)
    px = 680
  } else {
    // Anatomy, front + back
    const fh = 560
    const w1 = drawBody(ctx, d.body, 'front', d.muscles, 120, 440, fh)
    drawBody(ctx, d.body, 'back', d.muscles, 120 + w1 + 40, 440, fh)
  }

  // PRs / splits
  let y = 470
  const heading = d.splits?.length ? 'SPLITS' : d.prs.length ? 'NEW PRs' : 'SESSION'
  text(ctx, heading, px, y, 28, 800, ORANGE)
  y += 50
  const lines = d.splits?.length ? d.splits.slice(0, 8) : d.prs.length ? d.prs.slice(0, 6) : ['Logged and done.', 'Consistency is the PR.']
  for (const l of lines) {
    text(ctx, l.length > 26 ? l.slice(0, 25) + '…' : l, px, y, 32, 600)
    y += 52
  }

  text(ctx, d.footer, 80, H - 80, 30, 600, 'rgba(247,243,240,0.6)')
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
}

export type CardShare = { name: string; ovr: number; tier: string; level: string; attrs: [string, number][]; body: 'male' | 'female' }

export async function renderCardImage(d: CardShare): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  background(ctx)
  const tierColors: Record<string, [string, string]> = {
    bronze: ['#3a2417', '#8a5634'],
    silver: ['#2b2d31', '#a7acb4'],
    gold: ['#3b2a0c', '#e0b04c'],
    elite: ['#1b0d06', '#ff6a1a'],
    legend: ['#ff6a1a', '#8ef0ff'],
  }
  const [c1, c2] = tierColors[d.tier] ?? tierColors.bronze
  const cx = 140
  const cy = 120
  const cw = W - 280
  const ch = H - 240
  const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch)
  g.addColorStop(0, c1)
  g.addColorStop(0.5, c2)
  g.addColorStop(1, c1)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(cx, cy, cw, ch, 48)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.roundRect(cx + 24, cy + 24, cw - 48, ch - 48, 32)
  ctx.fill()
  text(ctx, String(d.ovr), cx + 70, cy + 190, 150, 800)
  text(ctx, 'OVR', cx + 76, cy + 240, 34, 800, 'rgba(255,255,255,0.85)')
  text(ctx, d.tier.toUpperCase(), cx + cw - 70, cy + 110, 32, 800, 'rgba(255,255,255,0.85)', 'right')
  drawBody(ctx, d.body, 'front', { chest: 0.7, quadriceps: 0.8, gluteal: 0.8, deltoids: 0.7, abs: 0.6 }, cx + cw / 2 - 40, cy + 120, 520)
  text(ctx, d.name, W / 2, cy + 760, 72, 800, '#fff', 'center')
  text(ctx, d.level, W / 2, cy + 812, 32, 600, 'rgba(255,255,255,0.8)', 'center')
  const aw = (cw - 120) / d.attrs.length
  d.attrs.forEach(([k, v], i) => {
    const x = cx + 60 + aw * i + aw / 2
    text(ctx, String(v), x, cy + 940, 72, 800, '#fff', 'center')
    text(ctx, k, x, cy + 985, 28, 800, 'rgba(255,255,255,0.8)', 'center')
  })
  text(ctx, 'LIFT & EAT', W / 2, H - 60, 30, 800, ORANGE, 'center')
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
}

/** Share via the system sheet, or download when sharing files isn't supported. */
export async function shareBlob(blob: Blob, filename: string, title: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title })
      return
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
