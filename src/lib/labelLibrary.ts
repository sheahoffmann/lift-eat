// Label library: every nutrition label ever scanned on this phone, kept forever per
// grocery item. One label per item is "active" (used for meals); pick another any time.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid, type LibraryLabel } from './db'
import { settingsOf, updateSettings, type Profile, type ScannedLabel } from './profile'
import { myLabels, myLabelsOn } from '../data/myLabels'

const same = (a: Pick<LibraryLabel, 'name' | 'cal' | 'protein' | 'carbs' | 'fat'>, b: typeof a) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && [a.cal - b.cal, a.protein - b.protein, a.carbs - b.carbs, a.fat - b.fat].every((d) => Math.abs(d) < 1e-3)

/** Add a scanned label to the library (re-scanning the same product just refreshes its date). */
export async function addToLibrary(itemId: string, l: ScannedLabel) {
  const existing = (await db.labelLibrary.where('itemId').equals(itemId).toArray()).find((x) => same(x, l))
  const entry: LibraryLabel = { id: existing?.id ?? uid(), itemId, name: l.name, cal: l.cal, protein: l.protein, carbs: l.carbs, fat: l.fat, serving: l.serving, scannedAt: l.scannedAt }
  await db.labelLibrary.put(entry)
  return entry
}

export function useLabelLibrary() {
  return useLiveQuery(() => db.labelLibrary.orderBy('scannedAt').reverse().toArray(), [], [] as LibraryLabel[])
}

export type ActiveLabel = { kind: 'scanned' | 'builtin' | 'standard'; name: string; serving?: string }

/** Which numbers an item is using right now. */
export function activeLabel(itemId: string, profile: Profile): ActiveLabel {
  const s = settingsOf(profile)
  if (s.labelOff?.includes(itemId)) return { kind: 'standard', name: 'Standard values' }
  const scanned = s.scannedLabels?.[itemId]
  if (scanned) return { kind: 'scanned', name: scanned.name, serving: scanned.serving }
  const b = myLabelsOn(profile.program, s.myLabels) ? myLabels[itemId] : undefined
  if (b?.name) return { kind: 'builtin', name: b.name, serving: b.serving }
  return { kind: 'standard', name: 'Standard values' }
}

/** Make a library label, the built-in label, or standard values the active one for an item. */
export function chooseLabel(profile: Profile, itemId: string, choice: LibraryLabel | 'builtin' | 'standard') {
  const s = settingsOf(profile)
  const scanned = { ...(s.scannedLabels ?? {}) }
  const off = (s.labelOff ?? []).filter((x) => x !== itemId)
  if (choice === 'standard') {
    delete scanned[itemId]
    off.push(itemId)
  } else if (choice === 'builtin') {
    delete scanned[itemId]
  } else {
    scanned[itemId] = { name: choice.name, cal: choice.cal, protein: choice.protein, carbs: choice.carbs, fat: choice.fat, serving: choice.serving, scannedAt: choice.scannedAt }
  }
  updateSettings(profile, { scannedLabels: scanned, labelOff: off })
}

export async function deleteFromLibrary(profile: Profile, l: LibraryLabel) {
  await db.labelLibrary.delete(l.id)
  // If it was the active one, fall back to the built-in label or standard values.
  const active = settingsOf(profile).scannedLabels?.[l.itemId]
  if (active && same(active, l)) chooseLabel(profile, l.itemId, 'builtin')
}

/** One-time: labels scanned before the library existed go into it. */
export async function backfillLibrary(profile: Profile) {
  for (const [itemId, l] of Object.entries(settingsOf(profile).scannedLabels ?? {})) await addToLibrary(itemId, l)
}
