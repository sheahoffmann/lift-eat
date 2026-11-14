// Pixel-art dinosaurs. Each sprite is drawn on a tiny 48×48 canvas, snapped to a
// palette with a crisp dark outline, then scaled up with hard edges.
import { useEffect, useMemo, useRef, useState } from 'react'
import { rarityInfo, type DinoSpecies } from '../data/dinos'
import type { Stage } from '../lib/pet'

const N = 48
const OUTLINE = '#2a1d16'
const EYE = '#1d1a17'
const WHITE = '#fffaf0'
const CHEEK = '#f2a3a0'
const SHELL = '#f3ead2'

type Ctx = CanvasRenderingContext2D

const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, color: string) => {
  c.fillStyle = color
  c.beginPath()
  c.ellipse(x, y, Math.max(0.6, rx), Math.max(0.6, ry), 0, 0, Math.PI * 2)
  c.fill()
}
const poly = (c: Ctx, pts: [number, number][], color: string) => {
  c.fillStyle = color
  c.beginPath()
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
  c.closePath()
  c.fill()
}
const rect = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}
const line = (c: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) => {
  c.strokeStyle = color
  c.lineWidth = w
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(x1, y1)
  c.lineTo(x2, y2)
  c.stroke()
}

function eggSpots(c: Ctx, cx: number, cy: number, rx: number, ry: number, color: string, clipTop?: number) {
  const spots: [number, number, number][] = [
    [-0.45, -0.35, 0.18],
    [0.35, -0.5, 0.14],
    [0.5, 0.1, 0.16],
    [-0.2, 0.25, 0.2],
    [0.1, 0.65, 0.13],
    [-0.6, 0.55, 0.12],
  ]
  for (const [dx, dy, r] of spots) {
    const y = cy + dy * ry
    if (clipTop != null && y < clipTop + 1) continue
    ell(c, cx + dx * rx, y, r * rx, r * rx * 0.9, color)
  }
}

/** Head + face, positioned by head center. */
function head(c: Ctx, sp: DinoSpecies, hx: number, hy: number, hs: number, blink = false) {
  const { body, belly } = sp.colors
  const long = sp.shape === 'spino' ? 1.5 : sp.shape === 'raptor' ? 1.2 : 1
  ell(c, hx, hy, 7.5 * hs, 6.5 * hs, body)
  ell(c, hx + 5.5 * hs * long, hy + 2 * hs, 4.5 * hs * long, 3.4 * hs, body)
  ell(c, hx + 4 * hs, hy + 3.8 * hs, 4.5 * hs, 1.6 * hs, belly)
  // eye (closed = a short line)
  if (blink) line(c, hx - 1 * hs, hy - 1.2 * hs, hx + 3 * hs, hy - 1.2 * hs, 1.1, EYE)
  else {
    ell(c, hx + 1 * hs, hy - 1.6 * hs, 2.5 * hs, 2.7 * hs, WHITE)
    ell(c, hx + 1.7 * hs, hy - 1.2 * hs, 1.5 * hs, 1.7 * hs, EYE)
    ell(c, hx + 1.1 * hs, hy - 2.2 * hs, 0.6, 0.6, WHITE)
  }
  ell(c, hx + 3.6 * hs, hy + 2.6 * hs, 1.3, 0.9, CHEEK)
  line(c, hx + 4.5 * hs, hy + 4.4 * hs, hx + (9.5 * long) * hs, hy + 3.4 * hs, 0.9, EYE)
}

/** Full creature (adult proportions at hs=1, f=1). Facing right, feet near y=44. */
function creature(c: Ctx, sp: DinoSpecies, hs: number, f: number, step = 0, blink = false) {
  const { body, belly, accent } = sp.colors
  switch (sp.shape) {
    case 'ptera': {
      const flap = step ? 4 : 0
      poly(c, [[22, 25], [1, 17 + flap + 4 * (1 - f)], [12, 34]], body)
      poly(c, [[26, 25], [47, 17 + flap + 4 * (1 - f)], [36, 34]], body)
      line(c, 2, 18, 12, 33, 1.2, accent)
      line(c, 46, 18, 36, 33, 1.2, accent)
      ell(c, 24, 31, 6, 7.5, body)
      ell(c, 24, 33, 3.8, 5, belly)
      rect(c, 21, 37, 2, 5, body)
      rect(c, 26, 37, 2, 5, body)
      poly(c, [[24, 15], [15, 10 + 2 * (1 - f)], [25, 19]], accent)
      ell(c, 28, 19, 6 * hs, 5.5 * hs, body)
      poly(c, [[31, 18], [31 + 13 * f + 2, 21], [31, 23]], accent)
      if (blink) line(c, 27, 17.8, 31, 17.8, 1.1, EYE)
      else {
        ell(c, 28.8, 17.4, 2.2 * hs, 2.4 * hs, WHITE)
        ell(c, 29.4, 17.8, 1.3 * hs, 1.5 * hs, EYE)
      }
      ell(c, 31, 21.5, 1.1, 0.8, CHEEK)
      return
    }
    case 'brachio': {
      poly(c, [[6, 28], [18, 27], [18, 35]], body)
      ell(c, 22, 31, 11, 8, body)
      ell(c, 23, 34, 7, 4.5, belly)
      rect(c, 14, 35, 5, step ? 8 : 9, body)
      rect(c, 26, 35, 5, step ? 9 : 8, body)
      line(c, 28, 28, 34, 12 + 3 * (1 - f), 6.5, body)
      head(c, sp, 36, 10 + 3 * (1 - f), hs * 0.85, blink)
      return
    }
    default:
  }

  const isRex = sp.shape === 'rex'
  const isAnk = sp.shape === 'ankylo'
  const isRap = sp.shape === 'raptor'

  // Things behind the body
  if (sp.shape === 'spino') {
    ell(c, 21, 26, 11 * f, 9 * f, accent)
    for (let x = 14; x <= 28; x += 4) line(c, x, 30, x + 1, 30 - 8 * f, 1, sp.colors.body)
  }
  if (sp.shape === 'stego') {
    for (const x of [12, 17, 22, 27]) poly(c, [[x - 3, 28], [x + 3, 28], [x, 28 - 7 * f]], accent)
  }

  // Tail
  if (isRap) poly(c, [[0, 27], [16, 27], [16, 34]], body)
  else if (isAnk) {
    poly(c, [[6, 31], [16, 30], [16, 36]], body)
    ell(c, 5, 32, 2.5 + 2 * f, 2.5 + 2 * f, accent)
  } else poly(c, [[5, 32], [18, 27], [18, 38]], body)
  if (sp.shape === 'stego') {
    poly(c, [[7, 31], [9, 31], [6, 26 + 2 * (1 - f)]], accent)
    poly(c, [[10, 30], [12, 30], [10, 25 + 2 * (1 - f)]], accent)
  }

  // Body
  const bcy = isAnk ? 34 : isRap ? 31 : 33
  ell(c, 22, bcy, isAnk ? 13 : isRap ? 9 : isRex ? 10.5 : 11, isAnk ? 7 : isRap ? 6.5 : isRex ? 9 : 8, body)
  ell(c, 24, bcy + 2, isAnk ? 9 : 6.5, isAnk ? 3.5 : 5, belly)
  if (isAnk) for (const x of [14, 19, 24, 29]) ell(c, x, 28, 1.6 * f + 0.6, 1.4 * f + 0.6, accent)

  // Legs
  const legW = isRap ? 3 : 5
  // Two-frame walk: one leg lifts a pixel on alternate frames.
  rect(c, 15, bcy + 3, legW, 44 - (bcy + 3) - (step ? 1 : 0), body)
  rect(c, 25, bcy + 3, legW, 44 - (bcy + 3) - (step ? 0 : 1), body)
  if (isRap) {
    poly(c, [[27, 43], [30, 41], [29, 44]], WHITE)
  }

  // Neck
  ell(c, 29, isAnk ? 31 : 28, 5, 5, body)

  // Head features behind the head
  const hx = isAnk ? 33 : isRex ? 33 : 33
  const hy = isAnk ? 27 : isRex ? 19 : 21
  if (sp.shape === 'trike') ell(c, hx - 4, hy - 4, 5 * f + 1.5, 7 * f + 1.5, accent)
  if (sp.shape === 'para') line(c, hx - 1, hy - 5, hx - 10 * f - 1, hy - 11 * f, 2.5 * f + 1, accent)

  head(c, sp, hx, hy + (step ? 0.6 : 0), isRex ? hs * 1.2 : hs, blink)

  // Head features in front
  if (sp.shape === 'trike') {
    poly(c, [[hx - 2, hy - 5], [hx, hy - 5], [hx - 1, hy - 5 - 6 * f]], '#f5ecd7')
    poly(c, [[hx + 2, hy - 6], [hx + 4, hy - 6], [hx + 3, hy - 6 - 6 * f]], '#f5ecd7')
    poly(c, [[hx + 8, hy - 1], [hx + 10, hy - 1], [hx + 9, hy - 1 - 3.5 * f]], '#f5ecd7')
  }
  if (sp.shape === 'pachy') {
    ell(c, hx, hy - 4 * hs, 6.5 * hs, 4.5 * hs, accent)
    for (const dx of [-4, 0, 4]) ell(c, hx + dx * hs, hy - 7.5 * hs, 0.9, 0.9, accent)
  }
  if (isRap) poly(c, [[hx - 5, hy - 4], [hx - 2, hy - 6], [hx - 9, hy - 9 * f - 1]], accent)
  if (isRex) {
    rect(c, 30, 31, 3, 2, body) // tiny arm
    for (let x = hx + 6; x < hx + 11; x += 2) rect(c, x, hy + 5, 1, 1, WHITE) // teeth
  }
}

function drawEggBottom(c: Ctx, color: string) {
  // Lower shell with a zigzag top edge (y ≈ 30).
  c.save()
  c.beginPath()
  const top = 30
  c.moveTo(10, top)
  for (let x = 10, up = true; x <= 38; x += 3, up = !up) c.lineTo(x, up ? top - 2.5 : top + 1)
  c.lineTo(38, 48)
  c.lineTo(10, 48)
  c.closePath()
  c.clip()
  ell(c, 24, 34, 13, 11, SHELL)
  eggSpots(c, 24, 34, 13, 11, color, top)
  c.restore()
}

function drawEggCap(c: Ctx, color: string, x: number, y: number) {
  c.save()
  c.beginPath()
  c.moveTo(x - 9, y)
  for (let i = 0, up = true; i <= 6; i++, up = !up) c.lineTo(x - 9 + i * 3, up ? y + 2 : y - 0.5)
  c.lineTo(x + 9, y - 12)
  c.lineTo(x - 9, y - 12)
  c.closePath()
  c.clip()
  ell(c, x, y, 9, 7, SHELL)
  ell(c, x - 3, y - 3, 1.6, 1.4, color)
  ell(c, x + 3, y - 4.5, 1.3, 1.2, color)
  c.restore()
}

export function renderSprite(sp: DinoSpecies, stage: Stage, silhouette = false, frame: 0 | 1 | 2 = 0): string {
  const step = frame === 1 ? 1 : 0
  const blink = frame === 2
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const c = canvas.getContext('2d', { willReadFrequently: true })
  if (!c) return ''
  const spot = rarityInfo[sp.rarity].color

  if (stage === 'Egg') {
    ell(c, 24, 28, 13, 16, SHELL)
    eggSpots(c, 24, 28, 13, 16, spot)
    if (frame === 1) {
      // A little crack appears on the wobble frame.
      line(c, 19, 22, 22, 25, 1, OUTLINE)
      line(c, 22, 25, 20, 28, 1, OUTLINE)
      line(c, 20, 28, 24, 30, 1, OUTLINE)
    }
  } else {
    const cfg =
      stage === 'Hatchling' ? { s: 0.72, hs: 1.3, f: 0.45 } : stage === 'Baby' ? { s: 0.7, hs: 1.22, f: 0.6 } : stage === 'Juvenile' ? { s: 0.86, hs: 1.08, f: 0.82 } : { s: 1, hs: 1, f: 1 }
    c.save()
    c.translate(24, stage === 'Hatchling' ? 40 : 44)
    c.scale(cfg.s, cfg.s)
    c.translate(-24, -44)
    creature(c, sp, cfg.hs, cfg.f, step, blink)
    c.restore()
    if (stage === 'Hatchling') {
      drawEggBottom(c, spot)
      drawEggCap(c, spot, 27, 15)
    }
    if (stage === 'Baby') {
      // Shell fragments at its feet
      poly(c, [[8, 44], [12, 40], [15, 44]], SHELL)
      poly(c, [[34, 44], [37, 41], [40, 44]], SHELL)
    }
  }

  // Pixelate: hard alpha, snap colors, add outline.
  const img = c.getImageData(0, 0, N, N)
  const d = img.data
  const palette = (stage === 'Egg' ? [SHELL, spot, EYE] : [sp.colors.body, sp.colors.belly, sp.colors.accent, EYE, WHITE, CHEEK, SHELL, spot, '#f5ecd7']).map((h) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  })
  const solid = new Uint8Array(N * N)
  for (let i = 0; i < N * N; i++) {
    const a = d[i * 4 + 3]
    if (a < 110) {
      d[i * 4 + 3] = 0
      continue
    }
    solid[i] = 1
    let best = palette[0]
    let bd = Infinity
    for (const p of palette) {
      const dist = (p[0] - d[i * 4]) ** 2 + (p[1] - d[i * 4 + 1]) ** 2 + (p[2] - d[i * 4 + 2]) ** 2
      if (dist < bd) {
        bd = dist
        best = p
      }
    }
    ;[d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]] = silhouette ? [60, 52, 48, 255] : [best[0], best[1], best[2], 255]
  }
  const o = parseInt(OUTLINE.slice(1), 16)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      if (solid[i]) continue
      const near = (x > 0 && solid[i - 1]) || (x < N - 1 && solid[i + 1]) || (y > 0 && solid[i - N]) || (y < N - 1 && solid[i + N])
      if (near) {
        d[i * 4] = silhouette ? 30 : (o >> 16) & 255
        d[i * 4 + 1] = silhouette ? 26 : (o >> 8) & 255
        d[i * 4 + 2] = silhouette ? 24 : o & 255
        d[i * 4 + 3] = 255
      }
    }
  c.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Tamagotchi-style animation: 2-frame walk, blinks, turns, and happy hops at a chunky
 * ~4 fps. `roam` lets it wander back and forth across its container (habitat view).
 */
export function PixelDino({
  species,
  stage,
  size = 160,
  silhouette = false,
  animate = true,
  mood = 'happy',
  roam = false,
}: {
  species: DinoSpecies
  stage: Stage
  size?: number
  silhouette?: boolean
  animate?: boolean
  mood?: 'happy' | 'hungry' | 'sad'
  roam?: boolean
}) {
  const frames = useMemo(
    () => [0, 1, 2].map((f) => renderSprite(species, stage, silhouette, f as 0 | 1 | 2)),
    [species, stage, silhouette],
  )
  const live = animate && !silhouette && !reducedMotion()
  const [frame, setFrame] = useState(0)
  const [dir, setDir] = useState(1)
  const [x, setX] = useState(0) // 0..1 across the habitat
  const [hop, setHop] = useState(0)
  const state = useRef({ tick: 0, pause: 0, hopLeft: 0, dir: 1, x: 0.3, blinkAt: 8 })

  useEffect(() => {
    if (!live) return
    const isEgg = stage === 'Egg'
    const happy = mood === 'happy'
    const id = setInterval(
      () => {
        const s = state.current
        s.tick++
        if (isEgg) {
          // Crack shows briefly during each wobble.
          setFrame(s.tick % 10 === 7 || s.tick % 10 === 8 ? 1 : 0)
          return
        }
        // Blink every few seconds.
        if (s.tick >= s.blinkAt) {
          setFrame(2)
          s.blinkAt = s.tick + 10 + Math.floor(Math.random() * 14)
          return
        }
        // Happy hop now and then.
        if (s.hopLeft > 0) {
          s.hopLeft--
          setHop(s.hopLeft > 0 ? 1 : 0)
        } else if (happy && Math.random() < 0.05) {
          s.hopLeft = 2
          setHop(1)
        }
        // Idle pauses.
        if (s.pause > 0) {
          s.pause--
          setFrame(0)
          return
        }
        if (Math.random() < (happy ? 0.06 : 0.14)) {
          s.pause = 4 + Math.floor(Math.random() * 8)
          return
        }
        // Walk: alternate legs; roamers move across, others turn around now and then.
        setFrame((f) => (f === 1 ? 0 : 1))
        if (roam) {
          s.x += s.dir * 0.035
          if (s.x > 1 || s.x < 0) {
            s.dir *= -1
            s.x = Math.min(1, Math.max(0, s.x))
          }
          setX(s.x)
        } else if (Math.random() < 0.05) s.dir *= -1
        setDir(s.dir)
      },
      mood === 'happy' ? 260 : 480,
    )
    return () => clearInterval(id)
  }, [live, stage, mood, roam])

  const legendary = species.rarity === 'legendary' && !silhouette
  const label = silhouette ? `Locked ${species.rarity} dinosaur` : stage === 'Egg' ? `${rarityInfo[species.rarity].label} egg` : `${species.name}, ${stage.toLowerCase()}`
  const src = frames[live ? frame : 0]
  const sprite = (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{
        imageRendering: 'pixelated',
        position: 'relative',
        transform: `translateY(${hop ? -Math.round(size / 14) : 0}px) scaleX(${stage === 'Egg' ? 1 : dir})`,
      }}
    />
  )

  if (roam) {
    return (
      <div className={`pixel-habitat ${legendary ? 'pixel-dino--legendary' : ''}`} style={{ height: size }} role="img" aria-label={label}>
        <div className="pixel-habitat__ground" aria-hidden />
        <div style={{ position: 'absolute', bottom: 0, left: `calc((100% - ${size}px) * ${x})`, width: size, height: size }}>
          <span className="pixel-dino__shadow" aria-hidden />
          {src && sprite}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`pixel-dino ${live && stage === 'Egg' ? 'pixel-dino--wobble' : ''} ${legendary ? 'pixel-dino--legendary' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <span className="pixel-dino__shadow" aria-hidden />
      {src && sprite}
    </div>
  )
}
