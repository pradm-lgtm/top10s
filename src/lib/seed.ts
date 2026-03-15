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
  rank: number   // for tiered lists: use tier number (1, 2, 3...) so entries sort correctly
  tier?: string  // tier label e.g. 'The Best', 'The Very, Very Good'
  title: string
  notes?: string
  image_url?: string
}

type ListSeed = {
  title: string
  year?: number           // omit for theme lists
  list_type?: 'annual' | 'theme'
  list_format?: 'ranked' | 'tiered'
  genre?: string          // e.g. 'rom-com', 'horror', 'action', 'marvel'
  category: 'movies' | 'tv'
  description?: string
  force?: boolean         // set to true to delete & re-insert if it already exists
  entries: Entry[]
  honorable_mentions?: string[]
  also_watched?: string[]
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
    honorable_mentions: [
      'Rye Lane',
      'Dungeons & Dragons: Honor Among Thieves',
      'Are You There God? It\'s Me, Margaret',
      'Teenage Mutant Ninja Turtles: Mutant Mayhem',
      'Barbie',
      'Air',
      'Bottoms',
      'John Wick: Chapter 4',
      'No Hard Feelings',
      'Dream Scenario',
      'The Killer',
      'The Zone of Interest',
    ],
    also_watched: [
      'Polite Society',
      'Mission: Impossible – Dead Reckoning Part One',
      'You Are So Not Invited to My Bat Mitzvah',
      'Tár',
      'Hustle',
      'The Redeem Team',
      'Guardians of the Galaxy Vol. 3',
      'Creed III',
      'M3GAN',
      'Joy Ride',
      'A Haunting in Venice',
      'You Hurt My Feelings',
      'Asteroid City',
      'Elemental',
      'Cocaine Bear',
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
    honorable_mentions: ['Shrinking (Season 1)'],
    also_watched: [
      'Ted Lasso (Season 3)',
      'Only Murders in the Building (Season 3)',
      'Sex Education (Season 4)',
      'Rothaniel',
      'Neal Brennan: Blocks',
      'Tennessee Kid',
      'The Curse',
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
    honorable_mentions: [
      'The Substance',
      'Hit Man',
      'Monkey Man',
      'Will & Harper',
      'The Last Stop in Yuma County',
      'Rebel Ridge',
      '12th Fail',
      'Twisters',
    ],
    also_watched: [
      'Problemista',
      'Three Daughters',
      'Kalki 2898 AD',
      'Babes',
      'Lucky Baskhar',
      'Gladiator II',
      'The Fall Guy',
      'Saturday Night',
      'Srikanth',
      'Love Lies Bleeding',
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
    honorable_mentions: [
      'House of the Dragon (Season 2)',
      'English Teacher',
      'The Traitors (Season 2)',
    ],
    also_watched: [
      'Drops of God',
      'Bad Monkey',
      'The Bear (Season 3)',
      "X-Men '97",
      'Starting 5',
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
    honorable_mentions: [
      'Bugonia',
      'Good Fortune',
      'Black Bag',
      'Marty Supreme',
      'Friendship',
      'Superman',
      'House of Dynamite',
      'The Mastermind',
      'F1',
      'Warfare',
      'Weapons',
    ],
    also_watched: [
      'Babes',
      'Pushpa 2: The Rule',
      'Lucky Baskhar',
      'Thunderbolts*',
      'Mickey 17',
      'Wicked: For Good',
      'Paddington in Peru',
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
    honorable_mentions: [
      'Mo (Season 2)',
      'Court of Gold',
      'Pop Culture Jeopardy!',
      'Adolescence',
    ],
    also_watched: [
      'Severance (Season 2)',
      'Slow Horses (Season 5)',
      'Hacks (Season 4)',
      'The White Lotus (Season 3)',
      'Drops of God',
      'Man on the Inside (Season 2)',
      'The Last of Us (Season 2)',
      'The Four Seasons',
      'A Swim Lesson',
      'Black Doves',
      'Dad Man Walking',
      'Running Point',
    ],
  },

  // ── THEME: MARVEL ────────────────────────────
  {
    title: 'Marvel Movies Ranked (Phases 1–4)',
    list_type: 'theme',
    list_format: 'tiered',
    genre: 'marvel',
    category: 'movies',
    entries: [
      { rank: 1, tier: 'The Best',               title: 'Thor: Ragnarok' },
      { rank: 2, tier: 'The Very, Very Good',     title: 'Avengers: Endgame' },
      { rank: 2, tier: 'The Very, Very Good',     title: 'Avengers: Infinity War' },
      { rank: 2, tier: 'The Very, Very Good',     title: 'Black Panther' },
      { rank: 2, tier: 'The Very, Very Good',     title: 'Shang-Chi and the Legend of the Ten Rings' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Spider-Man: Homecoming' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Spider-Man: Far From Home' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Guardians of the Galaxy' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Guardians of the Galaxy Vol. 2' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Captain America: Civil War' },
      { rank: 3, tier: 'The Super Enjoyable',     title: 'Ant-Man' },
      { rank: 4, tier: 'The Solid',               title: 'Captain Marvel' },
      { rank: 4, tier: 'The Solid',               title: 'Ant-Man and the Wasp' },
      { rank: 4, tier: 'The Solid',               title: 'Doctor Strange' },
      { rank: 4, tier: 'The Solid',               title: 'The Avengers' },
      { rank: 4, tier: 'The Solid',               title: 'Iron Man 3' },
      { rank: 4, tier: 'The Solid',               title: 'Captain America: The Winter Soldier' },
      { rank: 5, tier: 'The Eh',                  title: 'Iron Man' },
      { rank: 5, tier: 'The Eh',                  title: 'Avengers: Age of Ultron' },
      { rank: 5, tier: 'The Eh',                  title: 'Thor' },
      { rank: 5, tier: 'The Eh',                  title: 'Black Widow' },
      { rank: 6, tier: 'The Chores',              title: 'Thor: The Dark World' },
      { rank: 6, tier: 'The Chores',              title: 'Iron Man 2' },
      { rank: 6, tier: 'The Chores',              title: 'Captain America: The First Avenger' },
      { rank: 7, tier: 'The Actively Bad',        title: 'The Incredible Hulk' },
    ],
  },

  // ── THEME: ROM-COMS ──────────────────────────
  {
    title: 'All-Time Rom-Com Rankings',
    list_type: 'theme',
    genre: 'rom-com',
    category: 'movies',
    entries: [
      { rank: 1,  title: 'When Harry Met Sally' },
      { rank: 2,  title: 'Crazy, Stupid, Love.' },
      { rank: 3,  title: "You've Got Mail" },
      { rank: 4,  title: 'Pretty Woman' },
      { rank: 5,  title: 'The 40-Year-Old Virgin' },
      { rank: 6,  title: 'Long Shot' },
      { rank: 7,  title: 'Forgetting Sarah Marshall' },
      { rank: 8,  title: 'Sleepless in Seattle' },
      { rank: 9,  title: "Something's Gotta Give" },
      { rank: 10, title: 'Love Actually' },
    ],
    honorable_mentions: [
      '10 Things I Hate About You',
      'Set It Up',
      'Runaway Bride',
      'Clueless',
      'My Big Fat Greek Wedding',
      'Palm Springs',
      'The Apartment',
      'Notting Hill',
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
        year: list.year ?? null,
        list_type: list.list_type ?? 'annual',
        list_format: list.list_format ?? 'ranked',
        genre: list.genre ?? null,
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
        tier: e.tier ?? null,
        title: e.title,
        notes: e.notes ?? null,
        image_url: e.image_url ?? null,
      }))
    )

    if (entriesError) {
      console.error(`✗  Entries failed for "${list.title}":`, entriesError.message)
      continue
    }

    if (list.honorable_mentions?.length) {
      const { error: hmError } = await supabase.from('honorable_mentions').insert(
        list.honorable_mentions.map((title) => ({ list_id: inserted.id, title }))
      )
      if (hmError) console.error(`✗  Honorable mentions failed for "${list.title}":`, hmError.message)
    }

    if (list.also_watched?.length) {
      const { error: awError } = await supabase.from('also_watched').insert(
        list.also_watched.map((title) => ({ list_id: inserted.id, title }))
      )
      if (awError) console.error(`✗  Also watched failed for "${list.title}":`, awError.message)
    }

    const extras = [
      list.honorable_mentions?.length ? `${list.honorable_mentions.length} honorable mentions` : '',
      list.also_watched?.length ? `${list.also_watched.length} also watched` : '',
    ].filter(Boolean).join(', ')

    console.log(`✓  Inserted  "${list.title}" (${list.year}) — ${list.entries.length} entries${extras ? `, ${extras}` : ''}`)
  }

  console.log('\nDone.\n')
}

seed()
