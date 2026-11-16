// Client for /api/exercise: exercise name → muscles, log type, form cues.
import type { CustomExercise } from './db'

export type AIExercise = {
  name: string
  primary: string[]
  secondary: string[]
  logType: CustomExercise['logType']
  cues: [string, string, string]
  mistake: string
}

export async function autofillExercise(name: string, passcode: string): Promise<AIExercise> {
  let r: Response
  try {
    r = await fetch('/api/exercise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, passcode }) })
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.")
  }
  const body = await r.json().catch(() => ({}))
  if (r.status === 404) throw new Error('Auto-fill only works on the live site.')
  if (!r.ok) throw new Error(body.error ?? 'Something went wrong.')
  return body as AIExercise
}
