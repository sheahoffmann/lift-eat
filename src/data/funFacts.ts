// Real-world weights (lb, approximate) for "you lifted N giraffes" recap facts.
export type FunObject = { id: string; one: string; many: string; lb: number }

export const funObjects: FunObject[] = [
  { id: 'cat', one: 'house cat', many: 'house cats', lb: 10 },
  { id: 'turkey', one: 'Thanksgiving turkey', many: 'Thanksgiving turkeys', lb: 15 },
  { id: 'golden', one: 'golden retriever', many: 'golden retrievers', lb: 70 },
  { id: 'kangaroo', one: 'red kangaroo', many: 'red kangaroos', lb: 140 },
  { id: 'washer', one: 'washing machine', many: 'washing machines', lb: 170 },
  { id: 'fridge', one: 'refrigerator', many: 'refrigerators', lb: 250 },
  { id: 'lineman', one: 'NFL lineman', many: 'NFL linemen', lb: 315 },
  { id: 'sumo', one: 'sumo wrestler', many: 'sumo wrestlers', lb: 330 },
  { id: 'gorilla', one: 'silverback gorilla', many: 'silverback gorillas', lb: 400 },
  { id: 'motorcycle', one: 'motorcycle', many: 'motorcycles', lb: 500 },
  { id: 'vending', one: 'vending machine', many: 'vending machines', lb: 600 },
  { id: 'grizzly', one: 'grizzly bear', many: 'grizzly bears', lb: 600 },
  { id: 'piano', one: 'grand piano', many: 'grand pianos', lb: 1000 },
  { id: 'polar', one: 'polar bear', many: 'polar bears', lb: 1000 },
  { id: 'moose', one: 'moose', many: 'moose', lb: 1000 },
  { id: 'horse', one: 'horse', many: 'horses', lb: 1100 },
  { id: 'cow', one: 'dairy cow', many: 'dairy cows', lb: 1500 },
  { id: 'smartcar', one: 'Smart car', many: 'Smart cars', lb: 1800 },
  { id: 'bison', one: 'bison', many: 'bison', lb: 2000 },
  { id: 'shark', one: 'great white shark', many: 'great white sharks', lb: 2400 },
  { id: 'giraffe', one: 'giraffe', many: 'giraffes', lb: 2600 },
  { id: 'mini', one: 'Mini Cooper', many: 'Mini Coopers', lb: 2700 },
  { id: 'hippo', one: 'hippo', many: 'hippos', lb: 3300 },
  { id: 'sedan', one: 'midsize car', many: 'midsize cars', lb: 3300 },
  { id: 'tesla', one: 'Tesla Model 3', many: 'Tesla Model 3s', lb: 4000 },
  { id: 'pickup', one: 'pickup truck', many: 'pickup trucks', lb: 5000 },
  { id: 'rhino', one: 'white rhino', many: 'white rhinos', lb: 5000 },
  { id: 'zamboni', one: 'Zamboni', many: 'Zambonis', lb: 8000 },
  { id: 'stego', one: 'Stegosaurus', many: 'Stegosauruses', lb: 11000 },
  { id: 'orca', one: 'orca', many: 'orcas', lb: 12000 },
  { id: 'elephant', one: 'African elephant', many: 'African elephants', lb: 13000 },
  { id: 'trex', one: 'T. rex', many: 'T. rexes', lb: 15000 },
  { id: 'schoolbus', one: 'school bus', many: 'school buses', lb: 25000 },
  { id: 'doubledecker', one: 'double-decker bus', many: 'double-decker buses', lb: 27000 },
  { id: 'semi', one: 'semi truck', many: 'semi trucks', lb: 35000 },
  { id: 'firetruck', one: 'fire truck', many: 'fire trucks', lb: 40000 },
  { id: 'graywhale', one: 'gray whale', many: 'gray whales', lb: 60000 },
  { id: 'boeing', one: 'Boeing 737 (empty)', many: 'Boeing 737s', lb: 91000 },
  { id: 'tank', one: 'M1 Abrams tank', many: 'M1 Abrams tanks', lb: 130000 },
  { id: 'bluewhale', one: 'blue whale', many: 'blue whales', lb: 300000 },
]

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

/** Pick an object that gives a satisfying count (ideally 2–12), rotating by seed. */
export function funFact(volumeLb: number, seed: string, avoid: string[] = []) {
  if (volumeLb <= 0) return null
  const score = (o: FunObject) => {
    const n = volumeLb / o.lb
    return n >= 2 && n <= 12 ? 0 : n >= 1 && n <= 20 ? 1 : 2
  }
  const pool = funObjects.filter((o) => !avoid.includes(o.id))
  const bestScore = Math.min(...pool.map(score))
  const candidates = pool.filter((o) => score(o) === bestScore)
  const pick = candidates[hash(seed) % candidates.length]
  const count = volumeLb / pick.lb
  const rounded = count >= 10 ? Math.round(count) : Math.round(count * 10) / 10
  return { object: pick, count: rounded, text: `about the weight of ${rounded} ${rounded === 1 ? pick.one : pick.many}` }
}
