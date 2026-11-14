// Dinosaur roster for the training pet. Rarer eggs need longer streaks to capture.
export type DinoRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type DinoShape = 'trike' | 'stego' | 'ankylo' | 'para' | 'raptor' | 'pachy' | 'brachio' | 'spino' | 'ptera' | 'rex'

export type DinoSpecies = {
  id: string
  name: string
  shape: DinoShape
  rarity: DinoRarity
  colors: { body: string; belly: string; accent: string }
  blurb: string
}

export const rarityInfo: Record<DinoRarity, { label: string; daysToCapture: number; weight: number; color: string }> = {
  common: { label: 'Common', daysToCapture: 3, weight: 45, color: '#b98a5e' },
  rare: { label: 'Rare', daysToCapture: 7, weight: 30, color: '#8fb8ff' },
  epic: { label: 'Epic', daysToCapture: 14, weight: 18, color: '#ff6a1a' },
  legendary: { label: 'Legendary', daysToCapture: 21, weight: 7, color: '#ffd36b' },
}

export const dinoSpecies: DinoSpecies[] = [
  { id: 'triceratops', name: 'Triceratops', shape: 'trike', rarity: 'common', colors: { body: '#5aa36f', belly: '#cfe8b8', accent: '#e9d8a6' }, blurb: 'Three horns, zero quit.' },
  { id: 'stegosaurus', name: 'Stegosaurus', shape: 'stego', rarity: 'common', colors: { body: '#d08a3c', belly: '#f4d7a8', accent: '#9c4a2a' }, blurb: 'Back plates built from consistency.' },
  { id: 'ankylosaurus', name: 'Ankylosaurus', shape: 'ankylo', rarity: 'common', colors: { body: '#8a7f6b', belly: '#d9cfb8', accent: '#5b5245' }, blurb: 'Armored. Swings a club on leg day.' },
  { id: 'parasaurolophus', name: 'Parasaurolophus', shape: 'para', rarity: 'common', colors: { body: '#6f8fd0', belly: '#d6e2fb', accent: '#e57a5a' }, blurb: 'Honks its crest after every PR.' },
  { id: 'velociraptor', name: 'Velociraptor', shape: 'raptor', rarity: 'rare', colors: { body: '#b0703f', belly: '#efd2b0', accent: '#3d6b5e' }, blurb: 'Quick feet. Built for sprint day.' },
  { id: 'pachycephalosaurus', name: 'Pachycephalosaurus', shape: 'pachy', rarity: 'rare', colors: { body: '#9a6fc2', belly: '#e6d6f4', accent: '#f0c76a' }, blurb: 'Headstrong in the best way.' },
  { id: 'brachiosaurus', name: 'Brachiosaurus', shape: 'brachio', rarity: 'rare', colors: { body: '#4fa3a5', belly: '#cdeceb', accent: '#2f6f71' }, blurb: 'Gentle giant. Long-game energy.' },
  { id: 'spinosaurus', name: 'Spinosaurus', shape: 'spino', rarity: 'epic', colors: { body: '#3f7f6a', belly: '#c9e6c9', accent: '#ff6a1a' }, blurb: 'The sail glows when you’re locked in.' },
  { id: 'pteranodon', name: 'Pteranodon', shape: 'ptera', rarity: 'epic', colors: { body: '#c45a4a', belly: '#f6d1c6', accent: '#ffb067' }, blurb: 'Rides the thermals of a hot streak.' },
  { id: 'trex', name: 'Tyrannosaurus Rex', shape: 'rex', rarity: 'legendary', colors: { body: '#7a3b22', belly: '#e8b98f', accent: '#ffd36b' }, blurb: 'Tiny arms. Unmatched discipline.' },
  { id: 'sunfire-rex', name: 'Sunfire Rex', shape: 'rex', rarity: 'legendary', colors: { body: '#ff8a2a', belly: '#ffe3a8', accent: '#fff2c4' }, blurb: 'Forged in three straight weeks of work.' },
]

export const speciesById: Record<string, DinoSpecies> = Object.fromEntries(dinoSpecies.map((s) => [s.id, s]))
