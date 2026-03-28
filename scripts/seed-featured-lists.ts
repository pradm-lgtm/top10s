#!/usr/bin/env node
/**
 * scripts/seed-featured-lists.ts
 *
 * Seeds featured editorial lists into Supabase via the admin client.
 * Uses Claude to generate accurate list data, and TMDB to resolve poster URLs.
 *
 * Run (dry run — prints what will be inserted, no DB writes):
 *   DRY_RUN=true npx tsx --env-file=.env.local scripts/seed-featured-lists.ts
 *
 * Run (live — inserts into Supabase):
 *   npx tsx --env-file=.env.local scripts/seed-featured-lists.ts
 *
 * Run only specific lists (comma-separated keys):
 *   LISTS_TO_RUN=afi,obama_movies npx tsx --env-file=.env.local scripts/seed-featured-lists.ts
 *
 * Available keys: imdb, afi, academy, obama_movies, obama_tv
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === 'true'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'
const TMDB_DELAY_MS = 200 // stay under TMDB rate limit

// Control which lists run. Defaults to all if unset.
// Set LISTS_TO_RUN=afi,obama_movies to run only those two.
const ALL_KEYS = ['imdb', 'afi', 'academy', 'obama_movies', 'obama_tv'] as const
type ListKey = typeof ALL_KEYS[number]
const LISTS_TO_RUN: Set<ListKey> = process.env.LISTS_TO_RUN
  ? new Set(process.env.LISTS_TO_RUN.split(',').map((s) => s.trim()) as ListKey[])
  : new Set(ALL_KEYS)
const shouldRun = (key: ListKey) => LISTS_TO_RUN.has(key)

// ─── Types ────────────────────────────────────────────────────────────────────

interface RankedEntry {
  rank: number
  title: string
  year?: number
}

interface TieredEntry {
  title: string
  year?: number
  tier: string // must match a label in the tierDefs for this list
}

interface TierDef {
  label: string
  color: string
  position: number
}

interface ListMeta {
  title: string
  category: 'movies' | 'tv'
  list_type: 'annual' | 'theme'
  list_format: 'ranked' | 'tiered' | 'tier-ranked'
  featured: true
  owner_id: null
  year: null
  genre: null
  description: string | null
  source_label: string
  source_url: string
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function bootstrap() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const tmdbKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  const missing = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    !tmdbKey && 'NEXT_PUBLIC_TMDB_API_KEY',
    !anthropicKey && 'ANTHROPIC_API_KEY',
  ].filter(Boolean)

  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '))
    process.exit(1)
  }

  return {
    supabase: createClient(supabaseUrl!, serviceKey!),
    anthropic: new Anthropic({ apiKey: anthropicKey! }),
    tmdbKey: tmdbKey!,
  }
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function tmdbPoster(
  title: string,
  year: number | undefined,
  category: 'movies' | 'tv',
  tmdbKey: string
): Promise<string | null> {
  try {
    const type = category === 'tv' ? 'tv' : 'movie'
    const q = encodeURIComponent(title)
    const yearParam = year && category === 'movies' ? `&year=${year}` : ''
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?query=${q}${yearParam}&api_key=${tmdbKey}&page=1`
    )
    if (!res.ok) return null
    const data = await res.json()
    // If year-specific search returned nothing, retry without year
    let results = data.results ?? []
    if (!results.length && year) {
      const res2 = await fetch(
        `${TMDB_BASE}/search/${type}?query=${q}&api_key=${tmdbKey}&page=1`
      )
      const data2 = await res2.json()
      results = data2.results ?? []
    }
    const hit = results.find((r: { poster_path?: string }) => r.poster_path)
    return hit?.poster_path ? `${TMDB_IMG}${hit.poster_path}` : null
  } catch {
    return null
  }
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function askClaude<T>(anthropic: Anthropic, prompt: string): Promise<T> {
  console.log('  → Asking Claude...')
  const msg = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8096,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  // Extract JSON from markdown code block or raw JSON
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  const raw = block ? block[1].trim() : text.trim()
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    console.error('❌ Failed to parse Claude response as JSON. Raw output:')
    console.error(text.slice(0, 500))
    throw e
  }
}

// ─── Inserters ────────────────────────────────────────────────────────────────

async function insertRankedList(
  supabase: SupabaseClient,
  tmdbKey: string,
  meta: ListMeta,
  entries: RankedEntry[]
) {
  console.log(`\n📋 ${meta.title}`)
  console.log(`   ${entries.length} entries | ranked | ${meta.category}`)

  if (DRY_RUN) {
    console.log('   [DRY RUN] Entries:')
    entries.forEach((e) => console.log(`     ${String(e.rank).padStart(3)}. ${e.title}${e.year ? ` (${e.year})` : ''}`))
    return
  }

  const { data: list, error: listErr } = await supabase
    .from('lists')
    .insert(meta)
    .select('id')
    .single()
  if (listErr) throw new Error(`List insert failed: ${listErr.message}`)
  console.log(`   ✓ List created: ${list.id}`)

  let hits = 0
  for (const entry of entries) {
    const poster = await tmdbPoster(entry.title, entry.year, meta.category, tmdbKey)
    const { error } = await supabase.from('list_entries').insert({
      list_id: list.id,
      rank: entry.rank,
      tier_id: null,
      tier: null,
      title: entry.title,
      notes: null,
      image_url: poster ?? null,
    })
    if (error) console.warn(`     ⚠ Entry "${entry.title}": ${error.message}`)
    if (poster) hits++
    process.stdout.write(poster ? '▪' : '·')
    await sleep(TMDB_DELAY_MS)
  }
  console.log(`\n   ✓ ${entries.length} entries | ${hits} posters found`)
}

async function insertTieredList(
  supabase: SupabaseClient,
  tmdbKey: string,
  meta: ListMeta,
  tierDefs: TierDef[],
  entries: TieredEntry[]
) {
  console.log(`\n📋 ${meta.title}`)
  console.log(`   ${entries.length} entries | tiered (${tierDefs.map((t) => t.label).join(', ')}) | ${meta.category}`)

  if (DRY_RUN) {
    console.log('   [DRY RUN] Tiers:')
    for (const td of tierDefs) {
      const te = entries.filter((e) => e.tier === td.label)
      console.log(`\n     Tier: ${td.label} (${te.length})`)
      te.forEach((e) => console.log(`       - ${e.title}${e.year ? ` (${e.year})` : ''}`))
    }
    return
  }

  const { data: list, error: listErr } = await supabase
    .from('lists')
    .insert(meta)
    .select('id')
    .single()
  if (listErr) throw new Error(`List insert failed: ${listErr.message}`)
  console.log(`   ✓ List created: ${list.id}`)

  // Insert tiers and build label→id map
  const tierMap: Record<string, string> = {}
  for (const td of tierDefs) {
    const { data: tier, error: tierErr } = await supabase
      .from('tiers')
      .insert({ list_id: list.id, label: td.label, color: td.color, position: td.position })
      .select('id')
      .single()
    if (tierErr) throw new Error(`Tier "${td.label}" insert failed: ${tierErr.message}`)
    tierMap[td.label] = tier.id
  }
  console.log(`   ✓ ${tierDefs.length} tiers created`)

  // Track insertion rank per tier (1-based, resets per tier)
  const tierRankCounters: Record<string, number> = {}
  for (const td of tierDefs) tierRankCounters[td.label] = 0

  let hits = 0
  for (const entry of entries) {
    const tierId = tierMap[entry.tier]
    if (!tierId) {
      console.warn(`   ⚠ Unknown tier "${entry.tier}" for "${entry.title}" — skipping`)
      continue
    }
    tierRankCounters[entry.tier] = (tierRankCounters[entry.tier] ?? 0) + 1
    const rank = tierRankCounters[entry.tier]

    const poster = await tmdbPoster(entry.title, entry.year, meta.category, tmdbKey)
    const { error } = await supabase.from('list_entries').insert({
      list_id: list.id,
      rank,           // insertion order within tier — satisfies not-null if constraint exists
      tier_id: tierId,
      tier: entry.tier, // keep legacy string too
      title: entry.title,
      notes: null,
      image_url: poster ?? null,
    })
    if (error) console.warn(`     ⚠ Entry "${entry.title}": ${error.message}`)
    if (poster) hits++
    process.stdout.write(poster ? '▪' : '·')
    await sleep(TMDB_DELAY_MS)
  }
  console.log(`\n   ✓ ${entries.length} entries | ${hits} posters found`)
}

// ─── List generators (call Claude, return structured data) ────────────────────

async function generateImdbTop25(anthropic: Anthropic): Promise<RankedEntry[]> {
  return askClaude<RankedEntry[]>(
    anthropic,
    `Return a JSON array of the current IMDB Top 250's top 25 films, in ranked order (rank 1 = highest rated).
Use the IMDB Top 250 list as it currently stands. Include well-known titles like The Shawshank Redemption, The Godfather, The Dark Knight, etc.

Return ONLY a raw JSON array (no markdown, no explanation) with this exact shape:
[{"rank":1,"title":"The Shawshank Redemption","year":1994}, ...]

Rules:
- Exactly 25 items, rank 1–25
- "year" is the film's release year (integer)
- Use the full canonical IMDB title (e.g. "The Lord of the Rings: The Return of the King")
- No trailing commas, valid JSON only`
  )
}

async function generateAfi100(anthropic: Anthropic): Promise<TieredEntry[]> {
  return askClaude<TieredEntry[]>(
    anthropic,
    `Return a JSON array of all 100 films from the AFI 100 Greatest American Films list (2007 edition — the definitive revision).

Assign each film to the tier that matches its release decade:
  - "2000s"   → released 2000–2009
  - "1990s"   → released 1990–1999
  - "1980s"   → released 1980–1989
  - "1970s"   → released 1970–1979
  - "1960s"   → released 1960–1969
  - "Pre-1960s" → released before 1960

Return ONLY a raw JSON array (no markdown, no explanation) with this exact shape:
[{"title":"Citizen Kane","year":1941,"tier":"Pre-1960s"}, ...]

Rules:
- Exactly 100 items
- "year" is the film's release year (integer)
- "tier" must be exactly one of: "2000s", "1990s", "1980s", "1970s", "1960s", "Pre-1960s"
- Use canonical AFI titles
- No trailing commas, valid JSON only`
  )
}

async function generateAcademyAwards(anthropic: Anthropic): Promise<RankedEntry[]> {
  return askClaude<RankedEntry[]>(
    anthropic,
    `Return a JSON array of Academy Award Best Picture winners from the 2025 ceremony (97th) back to the 2000 ceremony (72nd), most recent first.

Return ONLY a raw JSON array (no markdown, no explanation) with this exact shape:
[{"rank":1,"title":"Anora","year":2024}, ...]

Rules:
- rank 1 = most recent winner (2025 ceremony / 2024 film year)
- "year" is the film's release year (not ceremony year)
- Use the full canonical title (e.g. "The Lord of the Rings: The Return of the King")
- Include winners only (not nominees)
- No trailing commas, valid JSON only

Known recent winners for reference: Anora (2024 film), Oppenheimer (2023 film), Everything Everywhere All at Once (2022 film), CODA (2021 film), Nomadland (2020 film), Parasite (2019 film)...`
  )
}

async function generateObamaMovies(anthropic: Anthropic): Promise<TieredEntry[]> {
  return askClaude<TieredEntry[]>(
    anthropic,
    `Barack Obama has published annual lists of his favorite movies every year from 2017 to 2024 on his website and social media.

Return a JSON array of all films he mentioned across those lists. Assign each to the tier matching the year he shared it.

Return ONLY a raw JSON array (no markdown, no explanation) with this exact shape:
[{"title":"Get Out","year":2017,"tier":"2017"}, ...]

Rules:
- "tier" must be exactly one of: "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"
- "year" is the film's release year (integer)
- If a film appeared in multiple years, include it once under the earliest year
- Include every film he publicly mentioned in those 8 annual lists
- Use canonical English titles
- No trailing commas, valid JSON only

Known examples by year:
2017: Get Out, Lady Bird, I, Tonya, Mudbound, Strong Island
2018: Capernaum, Eighth Grade, If Beale Street Could Talk, Leave No Trace, Roma, Burning
2019: Marriage Story, Parasite, Clemency, Just Mercy, American Factory
2020: Lovers Rock, Minari, Bad Hair, One Night in Miami, Wolfwalkers
2021: The Power of the Dog, Summer of Soul, Passing, Drive My Car, Parallel Mothers
2022: Everything Everywhere All at Once, The Banshees of Inisherin, Women Talking, Tár, Corsage
2023: Past Lives, Showing Up, Killers of the Flower Moon, American Fiction, May December, Bottoms
2024: Anora, Nickel Boys, A Real Pain, Conclave, Sing Sing, Hard Truths, Didi`
  )
}

async function generateObamaTv(anthropic: Anthropic): Promise<RankedEntry[]> {
  return askClaude<RankedEntry[]>(
    anthropic,
    `Barack Obama has included TV shows in his annual media lists from 2017 to 2024.

Return a JSON array of all TV shows he publicly mentioned across those annual lists, ranked from most notable/widely praised to least (use your best judgment on ordering — shows mentioned in multiple years or that he highlighted prominently should rank higher).

Return ONLY a raw JSON array (no markdown, no explanation) with this exact shape:
[{"rank":1,"title":"Succession","year":2018}, ...]

Rules:
- "year" is the show's premiere year (integer)
- rank starts at 1 (most notable) and increments
- Use the canonical English title
- Include every TV show he publicly listed across 2017–2024
- No trailing commas, valid JSON only

Known examples: Succession, The Bear, Fleabag, The Wire, Lovecraft Country, Atlanta, Dark, Watchmen, Better Call Saul, Reservation Dogs, Station Eleven, Halt and Catch Fire, The Americans, We Are Who We Are, Servant, Schitt's Creek, Mrs. America, Random Acts of Flyness, Euphoria, The Rehearsal, Abbott Elementary, Jury Duty, The Last of Us`
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { supabase, anthropic, tmdbKey } = bootstrap()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  RANKED — Featured List Seeder`)
  console.log(`  Model: ${CLAUDE_MODEL}`)
  console.log(`  Mode:  ${DRY_RUN ? '🔍 DRY RUN (no DB writes)' : '🚀 LIVE (writing to Supabase)'}`)
  console.log(`${'═'.repeat(60)}\n`)

  console.log(`  Lists to run: ${[...LISTS_TO_RUN].join(', ')}\n`)

  // ── 1. IMDB Top 25 ──────────────────────────────────────────────────────────
  if (shouldRun('imdb')) {
  console.log('▶ Generating IMDB Top 25...')
  const imdbEntries = await generateImdbTop25(anthropic)
  await insertRankedList(supabase, tmdbKey, {
    title: 'IMDB Top 250',
    category: 'movies',
    list_type: 'theme',
    list_format: 'ranked',
    featured: true,
    owner_id: null,
    year: null,
    genre: null,
    description: 'The top 25 films from IMDB\'s iconic crowd-sourced Top 250 — ranked by weighted average of ratings from millions of voters.',
    source_label: 'IMDB Top 250',
    source_url: 'https://www.imdb.com/chart/top/',
  }, imdbEntries)
  } // end imdb

  // ── 2. AFI 100 ──────────────────────────────────────────────────────────────
  if (shouldRun('afi')) {
  console.log('\n▶ Generating AFI 100...')
  const afiEntries = await generateAfi100(anthropic)
  await insertTieredList(supabase, tmdbKey, {
    title: 'AFI 100 Greatest American Films',
    category: 'movies',
    list_type: 'theme',
    list_format: 'tiered',
    featured: true,
    owner_id: null,
    year: null,
    genre: null,
    description: 'The American Film Institute\'s definitive list of the 100 greatest American motion pictures, as voted by 1,500 film artists, critics, and leaders. 2007 edition.',
    source_label: 'AFI 100',
    source_url: 'https://www.afi.com/afis-10-top-10/',
  }, [
    { label: '2000s',    color: '#d97706', position: 1 },
    { label: '1990s',    color: '#2563eb', position: 2 },
    { label: '1980s',    color: '#7c3aed', position: 3 },
    { label: '1970s',    color: '#dc2626', position: 4 },
    { label: '1960s',    color: '#059669', position: 5 },
    { label: 'Pre-1960s', color: '#6b7280', position: 6 },
  ], afiEntries)
  } // end afi

  // ── 3. Academy Awards Best Picture ──────────────────────────────────────────
  if (shouldRun('academy')) {
  console.log('\n▶ Generating Academy Awards Best Picture winners...')
  const academyEntries = await generateAcademyAwards(anthropic)
  await insertRankedList(supabase, tmdbKey, {
    title: 'Academy Award Best Picture Winners',
    category: 'movies',
    list_type: 'theme',
    list_format: 'ranked',
    featured: true,
    owner_id: null,
    year: null,
    genre: null,
    description: 'Every Academy Award Best Picture winner from 2000 to present, most recent first. The highest honour in American cinema.',
    source_label: 'Academy Awards',
    source_url: 'https://www.oscars.org/',
  }, academyEntries)
  } // end academy

  // ── 4. Obama's Favourite Movies ─────────────────────────────────────────────
  if (shouldRun('obama_movies')) {
  console.log('\n▶ Generating Obama\'s favourite movies...')
  const obamaMovieEntries = await generateObamaMovies(anthropic)
  await insertTieredList(supabase, tmdbKey, {
    title: 'Barack Obama\'s Favourite Movies',
    category: 'movies',
    list_type: 'theme',
    list_format: 'tiered',
    featured: true,
    owner_id: null,
    year: null,
    genre: null,
    description: 'Every film from Barack Obama\'s annual favourite movies lists, published on his website from 2017 to 2024. Organised by the year he shared them.',
    source_label: 'Barack Obama',
    source_url: 'https://barackobama.com/',
  }, [ // obama_movies tiers
    { label: '2024', color: '#e8c547', position: 1 },
    { label: '2023', color: '#d97706', position: 2 },
    { label: '2022', color: '#2563eb', position: 3 },
    { label: '2021', color: '#7c3aed', position: 4 },
    { label: '2020', color: '#dc2626', position: 5 },
    { label: '2019', color: '#059669', position: 6 },
    { label: '2018', color: '#0891b2', position: 7 },
    { label: '2017', color: '#6b7280', position: 8 },
  ], obamaMovieEntries)
  } // end obama_movies

  // ── 5. Obama's Favourite TV Shows ───────────────────────────────────────────
  if (shouldRun('obama_tv')) {
  console.log('\n▶ Generating Obama\'s favourite TV shows...')
  const obamaTvEntries = await generateObamaTv(anthropic)
  await insertRankedList(supabase, tmdbKey, {
    title: 'Barack Obama\'s Favourite TV Shows',
    category: 'tv',
    list_type: 'theme',
    list_format: 'ranked',
    featured: true,
    owner_id: null,
    year: null,
    genre: null,
    description: 'Every TV show from Barack Obama\'s annual media lists, published from 2017 to 2024. Ordered by prominence across his lists.',
    source_label: 'Barack Obama',
    source_url: 'https://barackobama.com/',
  }, obamaTvEntries)
  } // end obama_tv

  // ── Done ────────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(DRY_RUN
    ? '  ✅ Dry run complete — no changes made to the database.'
    : '  ✅ All lists seeded successfully!')
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
