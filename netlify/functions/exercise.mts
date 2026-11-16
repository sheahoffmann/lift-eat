// Fills in an exercise you typed in: main + supporting muscles, how it's logged,
// three form cues and the common mistake, using Claude.
// POST /api/exercise  { passcode, name }
// Env vars (set in Netlify): ANTHROPIC_API_KEY, APP_PASSCODE.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

export const config = { path: '/api/exercise' }

// Must match src/anatomy/muscles.ts
const MUSCLES = ['chest', 'abs', 'obliques', 'biceps', 'triceps', 'deltoids', 'trapezius', 'upper-back', 'lower-back', 'forearm', 'gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves', 'tibialis'] as const
const Muscle = z.enum(MUSCLES)

const Info = z.object({
  found: z.boolean().describe('false if this is not a recognizable exercise'),
  name: z.string().describe('Clean, standard name for the exercise, e.g. "Hack Squat"'),
  primary: z.array(Muscle).describe('1–3 main muscles doing most of the work'),
  secondary: z.array(Muscle).describe('0–4 supporting muscles (not repeated from primary)'),
  logType: z.enum(['weighted', 'bodyweight', 'timed', 'distance']).describe('weighted = weight × reps; bodyweight = reps; timed = holds in seconds; distance = carries/sleds in yards'),
  cues: z.array(z.string()).describe('Exactly 3 short form cues, imperative, under 9 words each'),
  mistake: z.string().describe('The most common form mistake, one short sentence'),
})

const SYSTEM = `You are a strength coach filling in exercise details for a workout app.
Muscle names must come from the allowed list: deltoids = shoulders, trapezius = traps, gluteal = glutes, quadriceps = quads, hamstring = hamstrings, forearm = forearms, tibialis = shins.
Keep cues practical and short. If the name is ambiguous, pick the most common gym version.`

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!process.env.ANTHROPIC_API_KEY || !process.env.APP_PASSCODE) return json({ error: 'Auto-fill is not set up yet (missing API key or passcode on Netlify).' }, 503)
  let body: { passcode?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  if (body.passcode !== process.env.APP_PASSCODE) return json({ error: 'Wrong passcode. Check Settings → Photo & link reader.' }, 401)
  const name = (body.name ?? '').trim().slice(0, 120)
  if (name.length < 2) return json({ error: 'Type the exercise name first.' }, 400)

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: betaZodOutputFormat(Info) },
      messages: [{ role: 'user', content: `Exercise: ${name}` }],
    })
    if (response.stop_reason === 'refusal') return json({ error: "Couldn't fill that one in. Pick the muscles yourself." }, 422)
    const out = response.parsed_output
    if (!out || !out.found) return json({ error: "That doesn't look like an exercise I know. Pick the muscles yourself." }, 422)
    const primary = [...new Set(out.primary)].slice(0, 3)
    const secondary = [...new Set(out.secondary)].filter((m) => !primary.includes(m)).slice(0, 4)
    const cues = [...out.cues, '', '', ''].slice(0, 3)
    return json({ ...out, primary, secondary, cues })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key on Netlify is invalid.' }, 502)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests. Try again in a minute.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status}). Try again.` }, 502)
    return json({ error: 'Something went wrong. Try again.' }, 500)
  }
}
