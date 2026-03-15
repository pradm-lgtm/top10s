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
  list_format?: 'ranked' | 'tiered' | 'tier-ranked'
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
      { rank: 2,  title: 'Beef (Season 1)' },
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

  // ── 2021 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2021',
    year: 2021,
    category: 'tv',
    entries: [
      { rank: 1, title: 'Lupin (Season 1)' },
      { rank: 2, title: 'Dave (Season 2)' },
      { rank: 3, title: 'Loki (Season 1)' },
      { rank: 4, title: 'WandaVision' },
      { rank: 5, title: 'The Falcon and the Winter Soldier' },
    ],
    also_watched: ['Normal People', 'New Girl'],
  },

  // ── 2020 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2020',
    year: 2020,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'Soul' },
      { rank: 2,  title: 'Sound of Metal' },
      { rank: 3,  title: 'Boys State' },
      { rank: 4,  title: 'The Trial of the Chicago 7' },
      { rank: 5,  title: 'Portrait of a Lady on Fire' },
      { rank: 6,  title: 'Disclosure' },
      { rank: 7,  title: 'Palm Springs' },
      { rank: 8,  title: 'Borat Subsequent Moviefilm' },
      { rank: 9,  title: 'Run' },
      { rank: 10, title: 'Da 5 Bloods' },
    ],
    honorable_mentions: [
      'Saint Frances',
      'The Social Dilemma',
      'How to Build a Girl',
      'Blow the Man Down',
      'Hamilton',
      'The Invisible Man',
      'The Old Guard',
      'First Cow',
    ],
    also_watched: [
      'Onward',
      'Miss Americana',
      'Mulan',
      'Yes, God, Yes',
      'Enola Holmes',
      'An American Pickle',
      'Happiest Season',
      'Wonder Woman 1984',
      "Taylor Swift: folklore (the long pond studio sessions)",
      'Support the Girls',
    ],
  },

  // ── 2020 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2020',
    year: 2020,
    category: 'tv',
    entries: [
      { rank: 1,  title: 'I May Destroy You' },
      { rank: 2,  title: 'Ramy (Seasons 1–2)' },
      { rank: 3,  title: 'Ted Lasso (Season 1)' },
      { rank: 4,  title: 'Love on the Spectrum' },
      { rank: 5,  title: 'Big Mouth (Season 4)' },
      { rank: 6,  title: "The Queen's Gambit" },
      { rank: 7,  title: 'The Last Dance' },
      { rank: 8,  title: 'Sex Education (Season 2)' },
      { rank: 9,  title: 'Little America' },
      { rank: 10, title: 'The Mandalorian (Season 2)' },
    ],
    honorable_mentions: [
      'Selena + Chef',
      'The Flight Attendant',
      'Ugly Delicious (Season 2)',
      'Killing Eve (Season 3)',
      'Curb Your Enthusiasm (Season 10)',
    ],
    also_watched: [
      'Never Have I Ever',
      'Defending Jacob',
      'The Mandalorian (Season 1)',
      'Crashing',
      'The Chef Show (Season 2)',
    ],
  },

  // ── 2019 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2019',
    year: 2019,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'Parasite' },
      { rank: 2,  title: '1917' },
      { rank: 3,  title: 'The Last Black Man in San Francisco' },
      { rank: 4,  title: 'Us' },
      { rank: 5,  title: 'Knives Out' },
      { rank: 6,  title: 'Little Women' },
      { rank: 7,  title: 'The Irishman' },
      { rank: 8,  title: 'The Farewell' },
      { rank: 9,  title: 'Toy Story 4' },
      { rank: 10, title: 'Booksmart' },
    ],
    honorable_mentions: [
      'Once Upon a Time in Hollywood',
      'JoJo Rabbit',
      'Andhadhun',
      'Dolemite Is My Name',
      'Marriage Story',
      'The Lighthouse',
      'Avengers: Endgame',
      'Shazam!',
      'Oh Baby',
      'Klaus',
      'Two Cars One Night',
      'Ready or Not',
      'Uncut Gems',
    ],
    also_watched: ['Joker'],
  },

  // ── 2019 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2019',
    year: 2019,
    category: 'tv',
    entries: [
      { rank: 1,  title: 'Fleabag (Season 2)' },
      { rank: 2,  title: 'Succession (Season 2)' },
      { rank: 3,  title: 'Sex Education (Season 1)' },
      { rank: 4,  title: 'Mindhunter (Season 2)' },
      { rank: 5,  title: 'The Marvelous Mrs. Maisel (Season 2)' },
      { rank: 6,  title: 'The Good Place (Seasons 1–3)' },
      { rank: 7,  title: 'Stranger Things (Season 3)' },
      { rank: 8,  title: 'Killing Eve (Season 2)' },
      { rank: 9,  title: 'Veep (Season 7)' },
      { rank: 10, title: 'Big Mouth (Season 3)' },
    ],
    honorable_mentions: [
      'The Good Place (Season 4)',
      'Barry (Season 2)',
      'Russian Doll (Season 1)',
      'Right Now',
      'GLOW (Season 3)',
      'Breakfast, Lunch & Dinner',
      'The Shop (Season 2)',
      'Smithereens (Black Mirror)',
    ],
    also_watched: [
      'Game of Thrones (Season 8)',
      'Big Little Lies (Season 2)',
    ],
  },

  // ── 2018 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2018',
    year: 2018,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'First Reformed' },
      { rank: 2,  title: 'Roma' },
      { rank: 3,  title: 'Eighth Grade' },
      { rank: 4,  title: 'The Favourite' },
      { rank: 5,  title: 'A Star Is Born' },
      { rank: 6,  title: 'Paddington 2' },
      { rank: 7,  title: 'Burning' },
      { rank: 8,  title: 'The Old Man & the Gun' },
      { rank: 9,  title: 'The Ballad of Buster Scruggs' },
      { rank: 10, title: 'Annihilation' },
    ],
    honorable_mentions: [
      'Mission: Impossible – Fallout',
      'The Death of Stalin',
      'A Fantastic Woman',
      'A Quiet Place',
      'Black Panther',
      'Searching',
      'Avengers: Infinity War',
      'Isle of Dogs',
      'Incredibles 2',
      "Won't You Be My Neighbor?",
    ],
    also_watched: [
      "Ocean's 8",
      'First Man',
      'A Simple Favor',
      'Crazy Rich Asians',
      'BlacKkKlansman',
      'Sorry to Bother You',
      'Vice',
      'Ant-Man and the Wasp',
      'The Intern',
      'Mary Poppins Returns',
    ],
  },

  // ── 2018 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2018',
    year: 2018,
    category: 'tv',
    entries: [
      { rank: 1, title: 'Atlanta (Season 2)' },
      { rank: 2, title: 'Barry (Season 1)' },
      { rank: 3, title: 'Narcos: Mexico (Season 1)' },
      { rank: 4, title: 'Killing Eve (Season 1)' },
      { rank: 5, title: 'Big Mouth (Season 2)' },
      { rank: 6, title: 'GLOW (Season 2)' },
      { rank: 7, title: 'The Marvelous Mrs. Maisel (Season 1)' },
      { rank: 8, title: 'Succession (Season 1)' },
    ],
    honorable_mentions: [
      'Bodyguard',
      'American Vandal (Season 2)',
      'Sacred Games',
      'The Shop',
      'Patriot Act with Hasan Minhaj',
    ],
    also_watched: ['Westworld (Season 2)', 'Veep'],
  },

  // ── 2017 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2017',
    year: 2017,
    category: 'movies',
    entries: [
      { rank: 1,  title: 'Three Billboards Outside Ebbing, Missouri' },
      { rank: 2,  title: 'The Shape of Water' },
      { rank: 3,  title: 'Coco' },
      { rank: 4,  title: 'Phantom Thread' },
      { rank: 5,  title: 'Lady Bird' },
      { rank: 6,  title: 'mother!' },
      { rank: 7,  title: 'The Killing of a Sacred Deer' },
      { rank: 8,  title: 'Dunkirk' },
      { rank: 9,  title: 'Get Out' },
      { rank: 10, title: 'The Florida Project' },
    ],
    honorable_mentions: [
      'It',
      'Wonder Woman',
      'Spider-Man: Homecoming',
      'Thor: Ragnarok',
      'Logan',
      'Pellichoopulu',
      'Guardians of the Galaxy Vol. 2',
      'Queen',
      "Molly's Game",
      'The Big Sick',
    ],
    also_watched: [
      'Baahubali 2: The Conclusion',
      'Dawn of the Planet of the Apes',
      'Blade Runner 2049',
      'The Disaster Artist',
      'Star Wars: The Last Jedi',
      'The Room',
      'The Incredible Jessica James',
      'Call Me by Your Name',
      "Don't Think Twice",
      'Win It All',
      'Cars 3',
    ],
  },

  // ── 2017 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2017',
    year: 2017,
    category: 'tv',
    entries: [
      { rank: 1, title: 'Big Little Lies (Season 1)' },
      { rank: 2, title: 'Narcos (Season 3)' },
      { rank: 3, title: 'American Vandal (Season 1)' },
      { rank: 4, title: 'The Deuce (Season 1)' },
      { rank: 5, title: 'Mindhunter (Season 1)' },
    ],
    honorable_mentions: [
      'Homecoming King',
      'Insecure (Season 2)',
      'The Defiant Ones',
      'Love (Season 3)',
      'Hard Knocks',
      'Game of Thrones (Season 7)',
      'Master of None (Season 2)',
      'Curb Your Enthusiasm (Season 9)',
      'GLOW (Season 1)',
    ],
    also_watched: [
      '30 Rock',
      'House of Cards (Season 5)',
      'Sherlock (Season 4)',
      'Silicon Valley',
      'Curb Your Enthusiasm (Season 8)',
      'Seinfeld in Your 30s',
      'Stranger Things (Season 2)',
      'Dave Chappelle: 4 Specials',
      "Joe Mande's Award Winning Comedy Special",
      'Anthony Bourdain: Parts Unknown',
    ],
  },

  // ── 2016 MOVIES ──────────────────────────────
  {
    title: 'Best Movies of 2016',
    year: 2016,
    category: 'movies',
    entries: [
      { rank: 1, title: 'La La Land' },
      { rank: 2, title: 'Eye in the Sky' },
      { rank: 3, title: '13th' },
      { rank: 4, title: 'The Nice Guys' },
      { rank: 5, title: 'The Lobster' },
    ],
    honorable_mentions: [
      'Arrival',
      'Zootopia',
      'Moonlight',
      'Sully',
      'Lion',
      'Manchester by the Sea',
      'The Edge of Seventeen',
    ],
    also_watched: [
      'Dope',
      'Rogue One: A Star Wars Story',
      'Captain America: Civil War',
      'Deadpool',
      'Finding Dory',
      'Everybody Wants Some!!',
      'Star Trek Beyond',
      'Fantastic Beasts and Where to Find Them',
      'The Big Short',
      'V for Vendetta',
    ],
  },

  // ── 2016 TV ───────────────────────────────────
  {
    title: 'Best TV Shows of 2016',
    year: 2016,
    category: 'tv',
    entries: [
      { rank: 1, title: 'Atlanta (Season 1)' },
      { rank: 2, title: 'Westworld (Season 1)' },
      { rank: 3, title: 'Insecure (Season 1)' },
      { rank: 4, title: 'Game of Thrones (Season 6)' },
      { rank: 5, title: 'Stranger Things (Season 1)' },
    ],
    honorable_mentions: [
      'O.J.: Made in America',
      'The Night Of',
      'Love (Season 1)',
      'Narcos (Season 2)',
    ],
    also_watched: [
      'New Girl',
      'Easy',
      'Silicon Valley',
      'House of Cards',
      'The Wire',
      'Daredevil',
      'Vice Principals',
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
    honorable_mentions: [
      'Puss in Boots: The Last Wish',
    ],
    also_watched: [
      'Glass Onion: A Knives Out Mystery',
      'Black Panther: Wakanda Forever',
      'Bros',
      "Don't Worry Darling",
      'Vengeance',
      'Elvis',
      'Lightyear',
      'The Batman',
      'The Lost City',
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
    honorable_mentions: [
      'Ms. Marvel',
      'Obi-Wan Kenobi',
      'Barry (Season 3)',
      'Jeen-Yuhs',
      'Showtime',
      'Only Murders in the Building (Season 2)',
    ],
    also_watched: [
      'Abbott Elementary',
      'The Old Man',
      'She-Hulk: Attorney at Law',
      'Moon Knight',
      'Blackbird',
      'Hawkeye',
      'Human Resources',
      'Atlanta (Season 4)',
      'Ramy (Season 3)',
      'Big Mouth (Season 4)',
      'Reservation Dogs',
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

  // ── THEME: ALL-TIME TV ───────────────────────
  {
    title: 'All-Time TV Shows',
    list_type: 'theme',
    list_format: 'tier-ranked',
    category: 'tv',
    entries: [
      // Tier 1
      { rank: 1,  tier: 'The Mount Rushmore',                      title: 'The Sopranos' },
      { rank: 2,  tier: 'The Mount Rushmore',                      title: 'Mad Men' },
      { rank: 3,  tier: 'The Mount Rushmore',                      title: 'The Wire' },
      { rank: 4,  tier: 'The Mount Rushmore',                      title: 'Succession' },
      // Tier 2
      { rank: 5,  tier: 'The Greats with Caveats',                 title: 'Breaking Bad' },
      { rank: 6,  tier: 'The Greats with Caveats',                 title: 'Game of Thrones' },
      { rank: 7,  tier: 'The Greats with Caveats',                 title: 'Atlanta' },
      { rank: 8,  tier: 'The Greats with Caveats',                 title: 'Fleabag' },
      // Tier 3
      { rank: 9,  tier: 'The A+ Comedies',                         title: '30 Rock' },
      { rank: 10, tier: 'The A+ Comedies',                         title: 'Veep' },
      { rank: 11, tier: 'The A+ Comedies',                         title: 'Community' },
      { rank: 12, tier: 'The A+ Comedies',                         title: 'The Office (US)' },
      { rank: 13, tier: 'The A+ Comedies',                         title: 'Parks and Recreation' },
      // Tier 4
      { rank: 14, tier: 'The Series Specials',                     title: 'Band of Brothers' },
      // Tier 5
      { rank: 15, tier: 'Short But Great Runs',                    title: 'Andor' },
      { rank: 16, tier: 'Short But Great Runs',                    title: 'Sherlock' },
      { rank: 17, tier: 'Short But Great Runs',                    title: 'Mindhunter' },
      { rank: 18, tier: 'Short But Great Runs',                    title: 'Shōgun' },
      { rank: 19, tier: 'Short But Great Runs',                    title: 'A Knight of the Seven Kingdoms' },
      { rank: 20, tier: 'Short But Great Runs',                    title: 'The Pitt' },
      { rank: 21, tier: 'Short But Great Runs',                    title: 'Flight of the Conchords' },
      // Tier 6
      { rank: 22, tier: 'The High Peaks Before Low Valleys',       title: 'True Detective (Season 1)' },
      { rank: 23, tier: 'The High Peaks Before Low Valleys',       title: 'The Bear (Seasons 1 & 2)' },
      { rank: 24, tier: 'The High Peaks Before Low Valleys',       title: 'Ted Lasso (Season 1)' },
      { rank: 25, tier: 'The High Peaks Before Low Valleys',       title: 'House of Cards (Season 1)' },
      { rank: 26, tier: 'The High Peaks Before Low Valleys',       title: 'Severance (Season 1)' },
      { rank: 27, tier: 'The High Peaks Before Low Valleys',       title: 'Big Little Lies (Season 1)' },
      { rank: 28, tier: 'The High Peaks Before Low Valleys',       title: 'The Last of Us (Season 1)' },
      // Tier 7
      { rank: 29, tier: 'The A− Comedies',                         title: 'The Good Place' },
      { rank: 30, tier: 'The A− Comedies',                         title: 'Curb Your Enthusiasm' },
      { rank: 31, tier: 'The A− Comedies',                         title: 'Arrested Development' },
      // Tier 8
      { rank: 32, tier: 'Golden Globe Interpretation Comedies',    title: 'Slow Horses' },
      { rank: 33, tier: 'Golden Globe Interpretation Comedies',    title: 'The Rehearsal' },
      { rank: 34, tier: 'Golden Globe Interpretation Comedies',    title: 'Louie' },
      { rank: 35, tier: 'Golden Globe Interpretation Comedies',    title: 'Ramy' },
      { rank: 36, tier: 'Golden Globe Interpretation Comedies',    title: 'Master of None' },
      // Tier 9
      { rank: 37, tier: 'My Sole But Rewarding Foray into Reality TV', title: 'The Traitors (US)' },
      // Tier 10
      { rank: 38, tier: 'The B+ Comedies',                         title: 'Hacks' },
      { rank: 39, tier: 'The B+ Comedies',                         title: 'Friends' },
      { rank: 40, tier: 'The B+ Comedies',                         title: 'Everybody Loves Raymond' },
      { rank: 41, tier: 'The B+ Comedies',                         title: 'New Girl' },
      { rank: 42, tier: 'The B+ Comedies',                         title: 'The League' },
      // Tier 11
      { rank: 43, tier: 'The Consistently Good, Maybe Never Great', title: 'Narcos / Narcos: Mexico' },
      { rank: 44, tier: 'The Consistently Good, Maybe Never Great', title: 'Friday Night Lights' },
      { rank: 45, tier: 'The Consistently Good, Maybe Never Great', title: 'The White Lotus' },
      // Tier 12
      { rank: 46, tier: 'Too Early to Rank',                       title: 'The Studio (Season 1)' },
    ],
  },

  // ── THEME: MARVEL ────────────────────────────
  {
    title: 'Marvel Movies (Phases 1-4)',
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
    title: 'Rom-Coms',
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
    // Check if list already exists (null year needs .is() not .eq())
    let query = supabase.from('lists').select('id').eq('title', list.title)
    query = list.year != null
      ? query.eq('year', list.year)
      : query.is('year', null)
    const { data: existing } = await query.single()

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
