// Meal options for the weekly planner. Air fryer + microwave only, or no cook.
// Quantities are the standard portion (2,250 cal plan). Other targets scale
// weighed ingredients (g); counted items (eggs, shakes, cups) stay whole.

export type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening'
export type Prep = 'No cook' | 'Microwave' | 'Air fryer' | 'Restaurant'

export type Ingredient = { item: string; amount: number; note?: string }

export type MealOption = {
  id: string
  slot: Slot | 'extra'
  name: string
  desc: string
  prep: Prep
  minutes: number
  steps: string[]
  ingredients: Ingredient[]
  /** Restaurant meals carry fixed macros and never go on the grocery list. */
  restaurant?: { cal: number; protein: number; carbs: number; fat: number; order: string }
  /** User-added option: fixed macros per serving + free-text grocery lines. */
  custom?: { cal: number; protein: number; carbs: number; fat: number; groceries: CustomGrocery[] }
}

export type CustomGrocery = { name: string; amount: number; unit: string }

export const slotMeta: Record<Slot, { label: string; time: string; startHour: number; required: boolean }> = {
  breakfast: { label: 'Breakfast', time: '7–8 am', startHour: 7, required: true },
  lunch: { label: 'Lunch', time: '12–1 pm', startHour: 12, required: true },
  snack: { label: 'Snack', time: '3–4 pm', startHour: 15, required: true },
  dinner: { label: 'Dinner', time: '6–7 pm', startHour: 18, required: true },
  evening: { label: 'Evening', time: '8–9 pm', startHour: 20, required: false },
}

export const slots: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'evening']

export const mealOptions: MealOption[] = [
  // Breakfast
  {
    id: 'yogurt-bowl',
    slot: 'breakfast',
    name: 'Greek yogurt bowl',
    desc: 'Protein yogurt with berries and a little granola. 2 minutes, no cooking.',
    prep: 'No cook',
    minutes: 2,
    steps: ['Stir the whey into the yogurt.', 'Top with frozen berries (they thaw in minutes), granola and honey.'],
    ingredients: [
      { item: 'greek-yogurt', amount: 250 },
      { item: 'whey', amount: 1, note: '1 scoop' },
      { item: 'berries', amount: 75 },
      { item: 'granola', amount: 40 },
      { item: 'honey', amount: 7, note: '1 tsp' },
    ],
  },
  {
    id: 'egg-mug',
    slot: 'breakfast',
    name: 'Microwave egg mug',
    desc: 'Eggs and egg whites scrambled in a mug, on an English muffin.',
    prep: 'Microwave',
    minutes: 4,
    steps: [
      'Whisk eggs and egg whites in a large mug.',
      'Microwave 60 s, stir, then 45–60 s more until set.',
      'Toast the muffin, add the cheese and eggs.',
    ],
    ingredients: [
      { item: 'eggs', amount: 2 },
      { item: 'egg-whites', amount: 150, note: '⅔ cup' },
      { item: 'cheese-slices', amount: 1 },
      { item: 'english-muffin', amount: 1 },
    ],
  },
  {
    id: 'shake-banana',
    slot: 'breakfast',
    name: 'Core Power shake + banana',
    desc: 'Grab and go. Zero prep.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Grab a shake and a banana.'],
    ingredients: [
      { item: 'core-power', amount: 1 },
      { item: 'banana', amount: 1 },
    ],
  },

  {
    id: 'whey-milk-breakfast',
    slot: 'breakfast',
    name: 'Whey shake + whole milk',
    desc: 'Your own shake: a scoop of whey blended or shaken with whole milk.',
    prep: 'No cook',
    minutes: 1,
    steps: ['Shake or blend 1 scoop whey with the milk.'],
    ingredients: [
      { item: 'whey', amount: 1, note: '1 scoop' },
      { item: 'whole-milk', amount: 340, note: '12 oz' },
    ],
  },

  // Lunch
  {
    id: 'chicken-rice-bowl',
    slot: 'lunch',
    name: 'Chicken rice bowl',
    desc: 'Pre-cooked chicken strips, microwave rice, salsa and guac.',
    prep: 'Microwave',
    minutes: 4,
    steps: ['Microwave rice cup 90 s.', 'Microwave chicken strips 2 min.', 'Top with salsa and a guac cup.'],
    ingredients: [
      { item: 'chicken-strips', amount: 200 },
      { item: 'rice-cup', amount: 1 },
      { item: 'salsa', amount: 60, note: '¼ cup' },
      { item: 'guac-cups', amount: 1 },
    ],
  },
  {
    id: 'chipotle-bowl',
    slot: 'lunch',
    name: 'Chipotle bowl',
    desc: 'Order out: double chicken, light rice, fajita veggies, salsa.',
    prep: 'Restaurant',
    minutes: 0,
    steps: ['Order: double chicken, light white rice, fajita veggies, fresh tomato salsa, lettuce.'],
    ingredients: [],
    restaurant: {
      cal: 560,
      protein: 66,
      carbs: 40,
      fat: 17,
      order: 'Double chicken, light white rice, fajita veggies, fresh tomato salsa, lettuce',
    },
  },
  {
    id: 'tuna-wrap',
    slot: 'lunch',
    name: 'Tuna wrap',
    desc: 'Two tuna pouches, cheese and lettuce in a big tortilla. Swap in chicken strips anytime.',
    prep: 'No cook',
    minutes: 3,
    steps: ['Mix tuna with mayo.', 'Layer cheese, tuna and lettuce on the tortilla and roll.'],
    ingredients: [
      { item: 'tortilla', amount: 1 },
      { item: 'tuna-pouch', amount: 2 },
      { item: 'cheese-slices', amount: 1 },
      { item: 'light-mayo', amount: 15, note: '1 tbsp' },
      { item: 'lettuce', amount: 30 },
    ],
  },

  // Snack
  {
    id: 'snack-shake',
    slot: 'snack',
    name: 'Core Power shake',
    desc: '42 g of protein in a bottle.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Drink it.'],
    ingredients: [{ item: 'core-power', amount: 1 }],
  },
  {
    id: 'whey-milk-snack',
    slot: 'snack',
    name: 'Whey shake + whole milk',
    desc: 'A scoop of whey shaken with whole milk.',
    prep: 'No cook',
    minutes: 1,
    steps: ['Shake or blend 1 scoop whey with the milk.'],
    ingredients: [
      { item: 'whey', amount: 1, note: '1 scoop' },
      { item: 'whole-milk', amount: 340, note: '12 oz' },
    ],
  },
  {
    id: 'jerky-apple',
    slot: 'snack',
    name: 'Jerky + apple',
    desc: 'Beef jerky and a crisp apple.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Pack and go.'],
    ingredients: [
      { item: 'jerky', amount: 56, note: '2 oz' },
      { item: 'apple', amount: 1 },
    ],
  },
  {
    id: 'cottage-fruit',
    slot: 'snack',
    name: 'Cottage cheese + fruit',
    desc: 'Cottage cheese topped with berries.',
    prep: 'No cook',
    minutes: 1,
    steps: ['Scoop cottage cheese, top with frozen berries.'],
    ingredients: [
      { item: 'cottage-cheese', amount: 170, note: '¾ cup' },
      { item: 'berries', amount: 75 },
    ],
  },

  // Dinner
  {
    id: 'chicken-rice-veg',
    slot: 'dinner',
    name: 'Chicken, rice + veg',
    desc: 'Air-fried chicken breast, microwave rice, steamed broccoli.',
    prep: 'Air fryer',
    minutes: 20,
    steps: [
      'Air fry frozen chicken breast at 380°F for 18–22 min (to 165°F inside). Season however you like.',
      'Microwave broccoli bag and rice cup.',
      'Drizzle oil over the veg.',
    ],
    ingredients: [
      { item: 'chicken-breast', amount: 220 },
      { item: 'rice-cup', amount: 1 },
      { item: 'broccoli', amount: 170, note: '½ bag' },
      { item: 'olive-oil', amount: 9, note: '2 tsp' },
    ],
  },
  {
    id: 'salmon-potato',
    slot: 'dinner',
    name: 'Salmon, potato + salad',
    desc: 'Air-fried salmon, a microwave baked potato, bagged salad.',
    prep: 'Air fryer',
    minutes: 15,
    steps: [
      'Air fry frozen salmon at 390°F for 12–14 min.',
      'Poke the potato, microwave 6–8 min, flipping once.',
      'Toss about a third of the salad kit.',
    ],
    ingredients: [
      { item: 'salmon', amount: 170, note: '6 oz' },
      { item: 'potato', amount: 213, note: '1 medium' },
      { item: 'salad-kit', amount: 100 },
    ],
  },
  {
    id: 'meatballs-potato',
    slot: 'dinner',
    name: 'Meatballs + potato',
    desc: 'Frozen meatballs in marinara, potato, green beans.',
    prep: 'Microwave',
    minutes: 10,
    steps: [
      'Microwave meatballs with marinara 2–3 min (or air fry at 380°F for 10 min).',
      'Microwave the potato 6–8 min and the green beans bag.',
    ],
    ingredients: [
      { item: 'turkey-meatballs', amount: 6 },
      { item: 'potato', amount: 213, note: '1 medium' },
      { item: 'marinara', amount: 120, note: '½ cup' },
      { item: 'green-beans', amount: 150 },
    ],
  },

  // Evening (optional)
  {
    id: 'cottage-cup',
    slot: 'evening',
    name: 'Cottage cheese cup',
    desc: 'One single-serve cup.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Peel and eat.'],
    ingredients: [{ item: 'cottage-cup', amount: 1 }],
  },
  {
    id: 'casein-shake',
    slot: 'evening',
    name: 'Casein shake',
    desc: 'Slow-digesting protein shaken with water.',
    prep: 'No cook',
    minutes: 1,
    steps: ['1 scoop casein + 10 oz cold water, shake.'],
    ingredients: [{ item: 'casein', amount: 1 }],
  },

  // Extras: small add-ons the fix-it suggestions can use to close a gap.
  {
    id: 'extra-string-cheese',
    slot: 'extra',
    name: '2 string cheese',
    desc: 'Easy protein top-up.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Eat anytime.'],
    ingredients: [{ item: 'string-cheese', amount: 2 }],
  },
  {
    id: 'extra-whey',
    slot: 'extra',
    name: 'Whey shake',
    desc: '1 scoop whey with water.',
    prep: 'No cook',
    minutes: 1,
    steps: ['1 scoop whey + 10 oz water, shake.'],
    ingredients: [{ item: 'whey', amount: 1 }],
  },
  {
    id: 'extra-rice',
    slot: 'extra',
    name: 'Extra rice cup',
    desc: 'Add to lunch or dinner on training days.',
    prep: 'Microwave',
    minutes: 2,
    steps: ['Microwave 90 s.'],
    ingredients: [{ item: 'rice-cup', amount: 1 }],
  },
  {
    id: 'extra-banana',
    slot: 'extra',
    name: 'Banana',
    desc: 'Quick carbs before training.',
    prep: 'No cook',
    minutes: 0,
    steps: ['Eat anytime.'],
    ingredients: [{ item: 'banana', amount: 1 }],
  },
]

export const mealsById: Record<string, MealOption> = Object.fromEntries(mealOptions.map((m) => [m.id, m]))

// User-added options live in IndexedDB; the app registers them here on load.
let customMeals: MealOption[] = []

export function setCustomMeals(list: MealOption[]) {
  for (const m of customMeals) delete mealsById[m.id]
  customMeals = list
  for (const m of list) mealsById[m.id] = m
}

export function optionsFor(slot: Slot | 'extra') {
  return [...mealOptions, ...customMeals].filter((m) => m.slot === slot)
}
