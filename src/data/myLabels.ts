// Exact label numbers for the specific products bought for the Athletic Strength profile.
// Applied per phone (Settings → "Use my label numbers"); everyone else keeps the generic values.
// Nutrition is per base unit, same as groceryItems: per gram for 'g' items, per piece for 'each'.
import { groceryItems, type GroceryItem } from './groceryItems'

type Label = Partial<GroceryItem> & { serving: string }

const perServing = (grams: number, cal: number, protein: number, carbs: number, fat: number) => ({
  cal: cal / grams,
  protein: protein / grams,
  carbs: carbs / grams,
  fat: fat / grams,
})

export const myLabels: Record<string, Label> = {
  'rice-cup': { name: 'Microwave rice cups (Riviana)', cal: 200, protein: 4, carbs: 39, fat: 2.5, serving: '1 cup (125 g): 200 cal, 4 g protein' },
  whey: { name: 'Super Isolate whey (1440 Foods)', cal: 140, protein: 30, carbs: 2, fat: 1, packSize: 18, packLabel: 'tub (~18 scoops)', serving: '1 scoop (38 g): 140 cal, 30 g protein' },
  casein: { name: 'Gold Standard casein', cal: 120, protein: 24, carbs: 4, fat: 1, packSize: 25, packLabel: 'tub (25 scoops)', serving: '1 scoop (34 g): 120 cal, 24 g protein' },
  'chicken-strips': { name: 'Tyson grilled chicken strips (frozen)', ...perServing(84, 120, 22, 2, 2.5), packSize: 588, packLabel: 'bag (~7 servings)', serving: '3 oz (84 g): 120 cal, 22 g protein' },
  'turkey-meatballs': { name: "Member's Mark Italian beef meatballs (frozen)", cal: 62.5, protein: 3, carbs: 1.5, fat: 5, packSize: 128, packLabel: 'bag (~128 meatballs)', serving: '4 meatballs (85 g): 250 cal, 12 g protein, 20 g fat' },
  'guac-cups': { name: 'Wholly guacamole mini cups', cal: 120, protein: 1, carbs: 5, fat: 10, packSize: 4, packLabel: '4-pack', serving: '1 mini cup (57 g): 120 cal, 10 g fat' },
  'greek-yogurt': { name: 'Chobani low-fat vanilla Greek yogurt', ...perServing(190, 140, 20, 9, 3), packSize: 950, packLabel: '32 oz tub', serving: '¾ cup (190 g): 140 cal, 20 g protein' },
  granola: { name: 'Kodiak honey oat granola', ...perServing(62, 260, 16, 30, 9), packSize: 310, packLabel: 'bag (~5 servings)', serving: '⅔ cup (62 g): 260 cal, 16 g protein' },
  marinara: { name: 'Classico four cheese marinara', ...perServing(125, 50, 2, 10, 0.5), packSize: 680, packLabel: '24 oz jar', serving: '½ cup (125 g): 50 cal, 2 g protein' },
  salsa: { name: 'Herdez salsa verde', ...perServing(31, 10, 0, 2, 0), packSize: 682, packLabel: '24 oz jar', serving: '2 tbsp (31 g): 10 cal' },
}

// Originals, so labels can be turned back off.
const originals: Record<string, GroceryItem> = {}
let appliedKey = ''

/**
 * Apply label numbers to the grocery catalog: built-in labels (if on), then labels you
 * scanned in the app (always win). Cheap to call every render.
 */
export function applyLabels(builtIn: boolean, scanned: Record<string, Partial<GroceryItem> & { serving?: string }> = {}, off: string[] = []) {
  const key = JSON.stringify([builtIn, scanned, off])
  if (key === appliedKey) return
  for (const id of new Set([...Object.keys(myLabels), ...Object.keys(scanned), ...off, ...Object.keys(originals)])) {
    if (!groceryItems[id] && !originals[id]) continue
    originals[id] ??= { ...groceryItems[id] }
    const pick = (l?: Partial<GroceryItem> & { serving?: string }) => {
      if (!l) return {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { serving, ...fields } = l as Label
      return fields
    }
    groceryItems[id] = off.includes(id) ? originals[id] : { ...originals[id], ...(builtIn ? pick(myLabels[id]) : {}), ...pick(scanned[id]) }
  }
  appliedKey = key
}

/** Back-compat helper used by tests. */
export const applyMyLabels = (on: boolean) => applyLabels(on)

/** On by default for the Athletic Strength profile; anyone can switch it in Settings. */
export const myLabelsOn = (program: string | undefined, setting: boolean | undefined) => setting ?? program === 'athletic'

/** The catalog value before any label numbers (for "what changed"). */
export const originalItem = (id: string) => originals[id] ?? groceryItems[id]
