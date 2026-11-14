// Reads nutrition facts from a label photo or a web page, using Claude.
// POST /api/nutrition  { passcode, image?: { data, mediaType }, url?: string }
// Env vars (set in Netlify): ANTHROPIC_API_KEY, APP_PASSCODE.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

export const config = { path: '/api/nutrition' }

const Nutrition = z.object({
  found: z.boolean().describe('false if no nutrition information could be read'),
  name: z.string().describe('Product or dish name, brand first if known'),
  servingLabel: z.string().describe('Serving size as printed, e.g. "1 bar (60 g)"'),
  servingGrams: z.number().nullable().describe('Serving size in grams, or null if unknown'),
  calories: z.number(),
  protein: z.number().describe('grams per serving'),
  carbs: z.number().describe('grams per serving'),
  fat: z.number().describe('grams per serving'),
  note: z.string().describe('One short sentence about anything uncertain, or empty string'),
})

const SYSTEM = `You extract nutrition facts for a food-logging app.
Return values for ONE serving as defined by the label or page. If a page lists several items or sizes, pick the one the page is about (or the most standard size) and say which in "note".
Use the numbers printed on the label or page; only estimate when they are missing, and say so in "note".
If the image or page has no nutrition information, set found=false and use 0 for the numbers.`

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type Media = (typeof MEDIA)[number]

/** Basic SSRF guard: only public http(s) hosts. */
function safeUrl(raw: string) {
  const u = new URL(raw)
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) links are supported.')
  const h = u.hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) {
    throw new Error('That link is not supported.')
  }
  return u
}

/** Fetch a page and reduce it to readable text. */
async function pageText(url: URL) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; LiftEatNutrition/1.0)' }, redirect: 'follow' })
  if (!r.ok) throw new Error(`The page returned ${r.status}.`)
  const html = await r.text()
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!process.env.ANTHROPIC_API_KEY || !process.env.APP_PASSCODE) {
    return json({ error: 'Photo and link reading are not set up yet (missing API key or passcode on Netlify).' }, 503)
  }

  let body: { passcode?: string; image?: { data?: string; mediaType?: string }; url?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }
  if (body.passcode !== process.env.APP_PASSCODE) return json({ error: 'Wrong passcode. Check Settings → Photo & link reader.' }, 401)

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  try {
    if (body.image?.data) {
      const mediaType = (MEDIA as readonly string[]).includes(body.image.mediaType ?? '') ? (body.image.mediaType as Media) : 'image/jpeg'
      if (body.image.data.length > 7_000_000) return json({ error: 'Photo is too large.' }, 413)
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: body.image.data } })
      content.push({ type: 'text', text: 'Read the nutrition facts from this photo.' })
    } else if (body.url) {
      const url = safeUrl(body.url)
      const text = await pageText(url)
      if (text.length < 40) return json({ error: "Couldn't read that page. Try a photo of the label instead." }, 422)
      content.push({
        type: 'text',
        text: `Nutrition information from this web page (${url.hostname}). Page text:\n\n<page>\n${text}\n</page>`,
      })
    } else {
      return json({ error: 'Send a photo or a link.' }, 400)
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 400)
  }

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'low', format: betaZodOutputFormat(Nutrition) },
      messages: [{ role: 'user', content }],
    })
    if (response.stop_reason === 'refusal') return json({ error: "Couldn't read that one. Try Quick add." }, 422)
    const out = response.parsed_output
    if (!out || !out.found) return json({ error: 'No nutrition facts found. Try a clearer photo or a different link.' }, 422)
    return json(out)
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key on Netlify is invalid.' }, 502)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many requests. Try again in a minute.' }, 429)
    if (e instanceof Anthropic.BadRequestError) return json({ error: `Request rejected: ${e.message}` }, 502)
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error (${e.status}). Try again.` }, 502)
    return json({ error: 'Something went wrong. Try again.' }, 500)
  }
}
