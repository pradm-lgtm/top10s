/**
 * Seed script — populate your Supabase database with lists.
 *
 * Usage:
 *   npx tsx src/lib/seed.ts
 *
 * To add more lists: copy a list block below and fill in your data.
 * Run as many times as you like — it skips lists that already exist (matched by title + year).
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────
// YOUR DATA — edit this section
// ─────────────────────────────────────────────

type Entry = {
  rank: number
  title: string
  notes?: string
  image_url?: string
}

type ListSeed = {
  title: string
  year: number
  category: 'movies' | 'tv'
  description?: string
  force?: boolean  // set to true to delete & re-insert if it already exists
  entries: Entry[]
}

const lists: ListSeed[] = [
  // ── 2023 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2023',
    year: 2023,
    category: 'movies',
    description: 'A standout year for cinema. From blockbusters to quiet masterpieces.',
    entries: [
      { rank: 1,  title: 'Past Lives' },
      { rank: 2,  title: 'Poor Things' },
      { rank: 3,  title: 'Killers of the Flower Moon' },
      { rank: 4,  title: 'Oppenheimer' },
      { rank: 5,  title: 'American Fiction' },
      { rank: 6,  title: 'Spider-Man: Across the Spider-Verse' },
      { rank: 7,  title: 'Anatomy of a Fall' },
      { rank: 8,  title: 'May December' },
      { rank: 9,  title: 'Godzilla Minus One' },
      { rank: 10, title: 'The Boy and the Heron' },
    ],
  },

  // ── 2023 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2023',
    year: 2023,
    category: 'tv',
    description: 'Peak TV is alive. These are the shows that consumed my evenings.',
    entries: [
      { rank: 1,  title: 'The Bear (Season 2)' },
      { rank: 2,  title: 'Beef' },
      { rank: 3,  title: 'Jury Duty' },
      { rank: 4,  title: 'Succession (Season 4)' },
      { rank: 5,  title: 'Dave (Season 3)' },
      { rank: 6,  title: 'The Last of Us (Season 1)' },
      { rank: 7,  title: 'This Fool (Season 2)' },
      { rank: 8,  title: 'Barry (Season 4)' },
      { rank: 9,  title: 'Monarch: Legacy of Monsters' },
      { rank: 10, title: 'Atlanta (Season 4)' },
    ],
  },

  // ── 2022 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2022',
    year: 2022,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'Everything Everywhere All at Once' },
      { rank: 2,  title: 'The Banshees of Inisherin' },
      { rank: 3,  title: 'RRR' },
      { rank: 4,  title: 'Barbarian' },
      { rank: 5,  title: 'Top Gun: Maverick' },
      { rank: 6,  title: 'Marcel the Shell with Shoes On' },
      { rank: 7,  title: 'The Fabelmans' },
      { rank: 8,  title: 'The Worst Person in the World' },
      { rank: 9,  title: 'The Northman' },
      { rank: 10, title: 'Decision to Leave' },
    ],
  },

  // ── 2022 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2022',
    year: 2022,
    category: 'tv',
    entries: [
      { rank: 1,  title: 'Severance (Season 1)' },
      { rank: 2,  title: 'Andor (Season 1)' },
      { rank: 3,  title: 'The Rehearsal (Season 1)' },
      { rank: 4,  title: 'Hacks (Season 2)' },
      { rank: 5,  title: 'The Bear (Season 1)' },
      { rank: 6,  title: 'House of the Dragon (Season 1)' },
      { rank: 7,  title: 'This Fool (Season 1)' },
      { rank: 8,  title: 'Stranger Things (Season 4)' },
      { rank: 9,  title: 'Our Flag Means Death (Season 1)' },
      { rank: 10, title: 'Atlanta (Season 3)' },
    ],
  },

  // ── 2024 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2024',
    year: 2024,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'Dune: Part Two' },
      { rank: 2,  title: 'Anora' },
      { rank: 3,  title: 'Juror #2' },
      { rank: 4,  title: 'Thelma' },
      { rank: 5,  title: 'Dìdi' },
      { rank: 6,  title: 'Challengers' },
      { rank: 7,  title: 'A Real Pain' },
      { rank: 8,  title: 'Conclave' },
      { rank: 9,  title: 'Laapataa Ladies' },
      { rank: 10, title: 'The Wild Robot' },
    ],
  },

  // ── 2024 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2024',
    year: 2024,
    category: 'tv',
    entries: [
      { rank: 1,  title: 'Shōgun (Season 1)' },
      { rank: 2,  title: 'Hacks (Season 3)' },
      { rank: 3,  title: 'Slow Horses (Season 4)' },
      { rank: 4,  title: 'One Day' },
      { rank: 5,  title: 'Mr. & Mrs. Smith (Season 1)' },
      { rank: 6,  title: 'The Penguin (Season 1)' },
      { rank: 7,  title: 'Man on the Inside (Season 1)' },
      { rank: 8,  title: 'Nobody Wants This (Season 1)' },
      { rank: 9,  title: 'Black Doves (Season 1)' },
      { rank: 10, title: 'Poker Face (Season 1)' },
    ],
  },

  // ── 2025 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2025',
    year: 2025,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'One Battle After Another' },
      { rank: 2,  title: 'No Other Choice' },
      { rank: 3,  title: '28 Years Later' },
      { rank: 4,  title: 'Wake Up Dead Man' },
      { rank: 5,  title: 'If I Had Legs I\'d Kick You' },
      { rank: 6,  title: 'Sorry Baby' },
      { rank: 7,  title: 'Sinners' },
      { rank: 8,  title: 'K-Pop Demon Hunters' },
      { rank: 9,  title: 'Eleanor the Great' },
      { rank: 10, title: 'Train Dreams' },
    ],
  },

  // ── 2025 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2025',
    year: 2025,
    category: 'tv',
    entries: [
      { rank: 1, title: 'The Pitt (Season 1)' },
      { rank: 2, title: 'The Studio (Season 1)' },
      { rank: 3, title: 'The Traitors (Season 3)' },
      { rank: 4, title: 'Andor (Season 2)' },
      { rank: 5, title: 'Pluribus (Season 1)' },
    ],
  },
]

// ─────────────────────────────────────────────
// Seed logic — no need to edit below this line
// ─────────────────────────────────────────────

async function seed() {
  console.log(`\nSeeding ${lists.length} list(s)...\n`)

  for (const list of lists) {
    // Check if list already exists
    const { data: existing } = await supabase
      .from('lists')
      .select('id')
      .eq('title', list.title)
      .eq('year', list.year)
      .single()

    if (existing) {
      if (!list.force) {
        console.log(`⏭  Skipped  "${list.title}" (${list.year}) — already exists`)
        continue
      }
      await supabase.from('lists').delete().eq('id', existing.id)
      console.log(`🗑  Deleted  "${list.title}" (${list.year}) — reinserting`)
    }

    // Insert list
    const { data: inserted, error: listError } = await supabase
      .from('lists')
      .insert({
        title: list.title,
        year: list.year,
        category: list.category,
        description: list.description ?? null,
      })
      .select('id')
      .single()

    if (listError || !inserted) {
      console.error(`✗  Failed   "${list.title}":`, listError?.message)
      continue
    }

    // Insert entries
    const { error: entriesError } = await supabase.from('list_entries').insert(
      list.entries.map((e) => ({
        list_id: inserted.id,
        rank: e.rank,
        title: e.title,
        notes: e.notes ?? null,
        image_url: e.image_url ?? null,
      }))
    )

    if (entriesError) {
      console.error(`✗  Entries failed for "${list.title}":`, entriesError.message)
    } else {
      console.log(`✓  Inserted  "${list.title}" (${list.year}) — ${list.entries.length} entries`)
    }
  }

  console.log('\nDone.\n')
}

seed()
