// Grocery catalog: every ingredient used by the meal options.
// Nutrition is per base unit: per gram for 'g' items, per piece for 'each' items.
// Values are typical label numbers for common US grocery products.

export type StoreSection = 'Produce' | 'Meat & Seafood' | 'Dairy & Eggs' | 'Frozen' | 'Bakery' | 'Pantry' | 'Drinks'

export type GroceryItem = {
  id: string
  name: string
  section: StoreSection
  unit: 'g' | 'each'
  /** Nutrition per base unit. */
  cal: number
  protein: number
  carbs: number
  fat: number
  /** How it's sold. packSize is in base units. */
  packSize: number
  packLabel: string
  /** Days it keeps after shopping (opened/fresh). Under 7 = perishable → mid-week top-up. */
  shelfDays: number
  frozen?: boolean
  /** Long-life staples worth asking "still have it?" about. */
  staple?: boolean
}

const per100 = (cal: number, protein: number, carbs: number, fat: number) => ({
  cal: cal / 100,
  protein: protein / 100,
  carbs: carbs / 100,
  fat: fat / 100,
})

const items: GroceryItem[] = [
  // Dairy & Eggs
  { id: 'greek-yogurt', name: 'Nonfat Greek yogurt', section: 'Dairy & Eggs', unit: 'g', ...per100(59, 10.3, 3.6, 0.4), packSize: 907, packLabel: '32 oz tub', shelfDays: 14 },
  { id: 'eggs', name: 'Eggs', section: 'Dairy & Eggs', unit: 'each', cal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, packSize: 12, packLabel: 'dozen', shelfDays: 28 },
  { id: 'egg-whites', name: 'Liquid egg whites', section: 'Dairy & Eggs', unit: 'g', ...per100(52, 11, 0.7, 0.2), packSize: 907, packLabel: '32 oz carton', shelfDays: 10 },
  { id: 'cheese-slices', name: 'Cheddar cheese slices', section: 'Dairy & Eggs', unit: 'each', cal: 70, protein: 5, carbs: 1, fat: 5, packSize: 12, packLabel: '12-slice pack', shelfDays: 21 },
  { id: 'cottage-cheese', name: 'Low-fat cottage cheese', section: 'Dairy & Eggs', unit: 'g', ...per100(84, 11, 4.3, 2.3), packSize: 680, packLabel: '24 oz tub', shelfDays: 10 },
  { id: 'cottage-cup', name: 'Cottage cheese single cups', section: 'Dairy & Eggs', unit: 'each', cal: 140, protein: 19, carbs: 5, fat: 4.5, packSize: 4, packLabel: '4-pack', shelfDays: 21 },
  { id: 'string-cheese', name: 'String cheese', section: 'Dairy & Eggs', unit: 'each', cal: 80, protein: 7, carbs: 1, fat: 5, packSize: 12, packLabel: '12-pack', shelfDays: 30 },
  { id: 'guac-cups', name: 'Guacamole single cups', section: 'Dairy & Eggs', unit: 'each', cal: 100, protein: 1, carbs: 5, fat: 9, packSize: 6, packLabel: '6-pack', shelfDays: 21 },

  // Frozen (proteins + veg default to frozen so nothing goes bad)
  { id: 'chicken-strips', name: 'Grilled chicken strips, fully cooked (frozen)', section: 'Frozen', unit: 'g', ...per100(131, 24, 1, 3), packSize: 680, packLabel: '24 oz bag', shelfDays: 90, frozen: true },
  { id: 'chicken-breast', name: 'Chicken breasts, individually frozen', section: 'Frozen', unit: 'g', ...per100(120, 22.5, 0, 2.6), packSize: 1361, packLabel: '3 lb bag', shelfDays: 90, frozen: true },
  { id: 'salmon', name: 'Salmon fillets (frozen)', section: 'Frozen', unit: 'g', ...per100(200, 20, 0, 13), packSize: 907, packLabel: '2 lb bag', shelfDays: 90, frozen: true },
  { id: 'turkey-meatballs', name: 'Turkey meatballs, fully cooked (frozen)', section: 'Frozen', unit: 'each', cal: 50, protein: 4.5, carbs: 1, fat: 3.3, packSize: 32, packLabel: '32 oz bag', shelfDays: 90, frozen: true },
  { id: 'berries', name: 'Mixed berries (frozen)', section: 'Frozen', unit: 'g', ...per100(50, 0.7, 12, 0.3), packSize: 1361, packLabel: '3 lb bag', shelfDays: 90, frozen: true },
  { id: 'broccoli', name: 'Broccoli steam-in bags (frozen)', section: 'Frozen', unit: 'g', ...per100(35, 2.8, 7, 0.4), packSize: 340, packLabel: '12 oz bag', shelfDays: 90, frozen: true },
  { id: 'green-beans', name: 'Green bean steam-in bags (frozen)', section: 'Frozen', unit: 'g', ...per100(31, 1.8, 7, 0.1), packSize: 340, packLabel: '12 oz bag', shelfDays: 90, frozen: true },

  // Produce
  { id: 'banana', name: 'Bananas', section: 'Produce', unit: 'each', cal: 105, protein: 1.3, carbs: 27, fat: 0.4, packSize: 1, packLabel: 'banana', shelfDays: 5 },
  { id: 'apple', name: 'Apples', section: 'Produce', unit: 'each', cal: 95, protein: 0.5, carbs: 25, fat: 0.3, packSize: 1, packLabel: 'apple', shelfDays: 21 },
  { id: 'potato', name: 'Russet potatoes', section: 'Produce', unit: 'g', ...per100(79, 2, 18, 0.1), packSize: 2268, packLabel: '5 lb bag', shelfDays: 21 },
  { id: 'lettuce', name: 'Shredded lettuce', section: 'Produce', unit: 'g', ...per100(15, 1, 3, 0.2), packSize: 227, packLabel: '8 oz bag', shelfDays: 5 },
  { id: 'salad-kit', name: 'Bagged salad kit', section: 'Produce', unit: 'g', ...per100(150, 3, 8, 12), packSize: 300, packLabel: '10.5 oz kit', shelfDays: 5 },

  // Bakery
  { id: 'english-muffin', name: 'Whole wheat English muffins', section: 'Bakery', unit: 'each', cal: 130, protein: 5, carbs: 25, fat: 1, packSize: 6, packLabel: '6-pack', shelfDays: 10 },
  { id: 'tortilla', name: 'Large flour tortillas', section: 'Bakery', unit: 'each', cal: 210, protein: 6, carbs: 36, fat: 5, packSize: 8, packLabel: '8-pack', shelfDays: 14 },

  // Pantry
  { id: 'whey', name: 'Whey protein powder', section: 'Pantry', unit: 'each', cal: 120, protein: 24, carbs: 3, fat: 1.5, packSize: 30, packLabel: '2 lb tub (~30 scoops)', shelfDays: 365, staple: true },
  { id: 'casein', name: 'Casein protein powder', section: 'Pantry', unit: 'each', cal: 120, protein: 24, carbs: 3, fat: 1, packSize: 25, packLabel: '1.8 lb tub (~25 scoops)', shelfDays: 365, staple: true },
  { id: 'granola', name: 'Granola', section: 'Pantry', unit: 'g', ...per100(450, 10, 65, 16), packSize: 340, packLabel: '12 oz bag', shelfDays: 60, staple: true },
  { id: 'honey', name: 'Honey', section: 'Pantry', unit: 'g', ...per100(304, 0.3, 82, 0), packSize: 340, packLabel: '12 oz bottle', shelfDays: 365, staple: true },
  { id: 'rice-cup', name: 'Microwave rice cups', section: 'Pantry', unit: 'each', cal: 210, protein: 4, carbs: 45, fat: 1.5, packSize: 2, packLabel: '2-cup pack', shelfDays: 180, staple: true },
  { id: 'salsa', name: 'Salsa', section: 'Pantry', unit: 'g', ...per100(30, 1.5, 6, 0), packSize: 454, packLabel: '16 oz jar', shelfDays: 14, staple: true },
  { id: 'tuna-pouch', name: 'Tuna pouches (2.6 oz)', section: 'Pantry', unit: 'each', cal: 70, protein: 16, carbs: 0, fat: 0.5, packSize: 1, packLabel: 'pouch', shelfDays: 365, staple: true },
  { id: 'light-mayo', name: 'Light mayo', section: 'Pantry', unit: 'g', ...per100(233, 0, 7, 23), packSize: 887, packLabel: '30 oz jar', shelfDays: 60, staple: true },
  { id: 'marinara', name: 'Marinara sauce', section: 'Pantry', unit: 'g', ...per100(50, 1.5, 8, 1.5), packSize: 680, packLabel: '24 oz jar', shelfDays: 10, staple: true },
  { id: 'olive-oil', name: 'Olive oil', section: 'Pantry', unit: 'g', ...per100(884, 0, 0, 100), packSize: 500, packLabel: '17 oz bottle', shelfDays: 365, staple: true },
  { id: 'jerky', name: 'Beef jerky', section: 'Pantry', unit: 'g', ...per100(285, 32, 21, 3.6), packSize: 92, packLabel: '3.25 oz bag', shelfDays: 60, staple: true },

  // Drinks
  { id: 'core-power', name: 'Core Power Elite shakes (42 g protein)', section: 'Drinks', unit: 'each', cal: 230, protein: 42, carbs: 8, fat: 3.5, packSize: 4, packLabel: '4-pack', shelfDays: 90, staple: true },
]

export const groceryItems: Record<string, GroceryItem> = Object.fromEntries(items.map((i) => [i.id, i]))

export const sectionOrder: StoreSection[] = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Frozen', 'Pantry', 'Drinks']
