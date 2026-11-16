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
  salsa: { name: 'Herdez salsa verde', ...perServing(31, 10, 0, 2, 0), packSize: 682, packLabel: '24 oz jar', serving: '2 tbsp (31 g): 10 cal' },
}

// Originals, so the switch can turn the label numbers back off.
const originals: Record<string, GroceryItem> = Object.fromEntries(Object.keys(myLabels).filter((id) => groceryItems[id]).map((id) => [id, { ...groceryItems[id] }]))
let applied = false

/** Swap the grocery catalog to (or back from) the label numbers. Cheap to call every render. */
export function applyMyLabels(on: boolean) {
  if (on === applied) return
  for (const [id, label] of Object.entries(myLabels)) {
    const base = originals[id]
    if (!base) continue
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { serving, ...fields } = label
    groceryItems[id] = on ? { ...base, ...fields } : base
  }
  applied = on
}

/** On by default for the Athletic Strength profile; anyone can switch it in Settings. */
export const myLabelsOn = (program: string | undefined, setting: boolean | undefined) => setting ?? program === 'athletic'
