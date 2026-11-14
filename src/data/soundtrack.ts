// Curated listening for training. Links open a search (Spotify / Apple / YouTube)
// rather than hard-coded IDs, so they never point at a dead page.
import type { SessionKind } from './programs'

export type ListenKind = 'playlist' | 'podcast' | 'audiobook'
export type ListenItem = { id: string; kind: ListenKind; title: string; by?: string; why: string; query: string; tags: ('lift' | 'cardio' | 'rest' | 'speed')[] }

export const soundtrack: ListenItem[] = [
  // Playlists: high energy for lifting and speed work
  { id: 'beast-mode', kind: 'playlist', title: 'Beast Mode', why: 'Hard-hitting hip-hop for heavy sets.', query: 'Beast Mode workout playlist', tags: ['lift', 'speed'] },
  { id: 'rock-lift', kind: 'playlist', title: 'Rock Workout', why: 'Big guitars for squat and deadlift days.', query: 'rock workout playlist', tags: ['lift'] },
  { id: 'throwback', kind: 'playlist', title: 'Throwback Workout', why: '2000s anthems you already know every word to.', query: '2000s throwback workout playlist', tags: ['lift', 'cardio'] },
  { id: 'edm-run', kind: 'playlist', title: 'EDM Running 170 BPM', why: 'Locks your cadence in on runs.', query: 'running 170 bpm EDM playlist', tags: ['cardio', 'speed'] },
  { id: 'hype-hiphop', kind: 'playlist', title: 'Hip-Hop Hype', why: 'Pre-PR energy. Save it for the top set.', query: 'hip hop workout hype playlist', tags: ['lift', 'speed'] },
  { id: 'country-workout', kind: 'playlist', title: 'Country Workout', why: 'Upbeat country for easy runs and accessories.', query: 'country workout playlist', tags: ['cardio', 'lift'] },
  { id: 'pop-cardio', kind: 'playlist', title: 'Pop Cardio', why: 'Feel-good pop that makes the minutes fly.', query: 'pop cardio workout playlist', tags: ['cardio'] },
  { id: 'lofi-mobility', kind: 'playlist', title: 'Lo-fi Stretch', why: 'Calm beats for mobility and cooldowns.', query: 'lofi stretching playlist', tags: ['rest'] },

  // Podcasts: educational and inspirational
  { id: 'huberman', kind: 'podcast', title: 'Huberman Lab', by: 'Andrew Huberman', why: 'Science of training, sleep and recovery.', query: 'Huberman Lab podcast', tags: ['cardio', 'rest'] },
  { id: 'attia', kind: 'podcast', title: 'The Peter Attia Drive', by: 'Peter Attia, MD', why: 'Longevity, strength and nutrition, deep dives.', query: 'The Peter Attia Drive podcast', tags: ['cardio', 'rest'] },
  { id: 'sbs', kind: 'podcast', title: 'Stronger By Science', by: 'Greg Nuckols & Eric Trexler', why: 'Evidence-based lifting and fat loss.', query: 'Stronger By Science podcast', tags: ['cardio', 'rest'] },
  { id: 'mindpump', kind: 'podcast', title: 'Mind Pump', by: 'Sal, Adam & Justin', why: 'Practical fitness talk with plenty of laughs.', query: 'Mind Pump podcast', tags: ['cardio', 'rest'] },
  { id: 'richroll', kind: 'podcast', title: 'The Rich Roll Podcast', by: 'Rich Roll', why: 'Endurance, mindset and comeback stories.', query: 'Rich Roll podcast', tags: ['cardio'] },
  { id: 'doac', kind: 'podcast', title: 'The Diary of a CEO', by: 'Steven Bartlett', why: 'Inspiring long-form conversations.', query: 'The Diary of a CEO podcast', tags: ['cardio', 'rest'] },
  { id: 'melrobbins', kind: 'podcast', title: 'The Mel Robbins Podcast', by: 'Mel Robbins', why: 'Motivation and habits, short and punchy.', query: 'The Mel Robbins Podcast', tags: ['cardio', 'rest'] },
  { id: 'hidden-brain', kind: 'podcast', title: 'Hidden Brain', by: 'Shankar Vedantam', why: 'Fascinating psychology to learn something new.', query: 'Hidden Brain podcast', tags: ['cardio', 'rest'] },
  { id: 'hibt', kind: 'podcast', title: 'How I Built This', by: 'Guy Raz', why: 'Founders on grit and getting through hard stretches.', query: 'How I Built This podcast', tags: ['cardio', 'rest'] },
  { id: 'foundmyfitness', kind: 'podcast', title: 'FoundMyFitness', by: 'Rhonda Patrick, PhD', why: 'Nutrition and health research explained.', query: 'FoundMyFitness podcast', tags: ['rest'] },

  // Audiobooks
  { id: 'cant-hurt-me', kind: 'audiobook', title: "Can't Hurt Me", by: 'David Goggins', why: 'Pure grit. Perfect for a long run.', query: "Can't Hurt Me David Goggins audiobook", tags: ['cardio'] },
  { id: 'atomic-habits', kind: 'audiobook', title: 'Atomic Habits', by: 'James Clear', why: 'Make the habit stick: exactly this season’s goal.', query: 'Atomic Habits James Clear audiobook', tags: ['cardio', 'rest'] },
  { id: 'relentless', kind: 'audiobook', title: 'Relentless', by: 'Tim Grover', why: 'Mindset from the trainer behind MJ and Kobe.', query: 'Relentless Tim Grover audiobook', tags: ['cardio'] },
  { id: 'born-to-run', kind: 'audiobook', title: 'Born to Run', by: 'Christopher McDougall', why: 'The book that makes people fall in love with running.', query: 'Born to Run Christopher McDougall audiobook', tags: ['cardio'] },
  { id: 'obstacle', kind: 'audiobook', title: 'The Obstacle Is the Way', by: 'Ryan Holiday', why: 'Stoic toughness in bite-size chapters.', query: 'The Obstacle Is the Way Ryan Holiday audiobook', tags: ['cardio', 'rest'] },
]

export function links(item: ListenItem) {
  const q = encodeURIComponent(item.query)
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    apple: item.kind === 'podcast' ? `https://podcasts.apple.com/us/search?term=${q}` : item.kind === 'audiobook' ? `https://books.apple.com/us/search?term=${q}` : `https://music.apple.com/us/search?term=${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

export function tagFor(kind: SessionKind): ListenItem['tags'][number] {
  return kind === 'lift' ? 'lift' : kind === 'sprint' ? 'speed' : kind === 'rest' ? 'rest' : 'cardio'
}

/** Today's pick for a session type; rotates daily (seed adds variety on shuffle). */
export function pickFor(kind: SessionKind, date: string, seed = 0) {
  const tag = tagFor(kind)
  const pool = soundtrack.filter((s) => s.tags.includes(tag))
  return pool[hash(`${date}:${tag}:${seed}`) % pool.length]
}
