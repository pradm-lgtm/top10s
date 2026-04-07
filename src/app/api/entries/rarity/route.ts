import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// ── Key extraction ────────────────────────────────────────────────────────────
// Use the TMDB poster path as a stable TMDB-ID proxy (e.g. "/abc123.jpg").
// Fall back to lowercased title for entries with no image_url.

export function entryRarityKey(entry: { image_url?: string | null; title: string }): string {
  if (entry.image_url?.includes('image.tmdb.org')) {
    const match = entry.image_url.match(/\/t\/p\/\w+(\/.+)$/)
    if (match) return match[1] // e.g. "/abc123.jpg"
  }
  return entry.title.toLowerCase().trim()
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RarityResponse = {
  /** rare entry keys → appearance fraction (0–1). Empty if minListsMet is false. */
  rare: Record<string, number>
  totalLists: number
  minListsMet: boolean
}

// ── In-memory 1-hour cache ────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000
const cache = new Map<string, { data: RarityResponse; expiry: number }>()

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? 'movies'
  if (category !== 'movies' && category !== 'tv') {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const cached = cache.get(category)
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data)
  }

  const supabase = getAdminSupabase()

  // 1. All qualifying lists: user-created, non-featured, in this category
  const { data: listRows } = await supabase
    .from('lists')
    .select('id')
    .eq('category', category)
    .eq('featured', false)
    .not('owner_id', 'is', null)

  const allListIds = (listRows ?? []).map((l) => l.id)

  if (allListIds.length === 0) {
    const result: RarityResponse = { rare: {}, totalLists: 0, minListsMet: false }
    cache.set(category, { data: result, expiry: Date.now() + CACHE_TTL })
    return NextResponse.json(result)
  }

  // 2. Fetch all entries for those lists (in chunks to avoid URL limits)
  type EntryRow = { list_id: string; image_url: string | null; title: string }
  const CHUNK = 200
  const PAGE = 1000
  let allEntries: EntryRow[] = []

  for (let i = 0; i < allListIds.length; i += CHUNK) {
    const chunk = allListIds.slice(i, i + CHUNK)
    let offset = 0
    while (true) {
      const { data } = await supabase
        .from('list_entries')
        .select('list_id, image_url, title')
        .in('list_id', chunk)
        .range(offset, offset + PAGE - 1)
      if (!data || data.length === 0) break
      allEntries = allEntries.concat(data as EntryRow[])
      if (data.length < PAGE) break
      offset += PAGE
    }
  }

  // 3. Count entries per list → keep only lists with >= 5 entries
  const entriesPerList = new Map<string, EntryRow[]>()
  for (const entry of allEntries) {
    if (!entriesPerList.has(entry.list_id)) entriesPerList.set(entry.list_id, [])
    entriesPerList.get(entry.list_id)!.push(entry)
  }

  const qualifyingListIds = new Set<string>()
  for (const [listId, entries] of entriesPerList) {
    if (entries.length >= 5) qualifyingListIds.add(listId)
  }

  const totalLists = qualifyingListIds.size
  const MIN_LISTS = 10
  const RARE_THRESHOLD = 0.15

  if (totalLists < MIN_LISTS) {
    const result: RarityResponse = { rare: {}, totalLists, minListsMet: false }
    cache.set(category, { data: result, expiry: Date.now() + CACHE_TTL })
    return NextResponse.json(result)
  }

  // 4. Count how many qualifying lists each entry key appears in
  const keyListSets = new Map<string, Set<string>>()

  for (const [listId, entries] of entriesPerList) {
    if (!qualifyingListIds.has(listId)) continue
    // Use a set per list to deduplicate (a film can appear twice in the same list)
    const keysInThisList = new Set<string>()
    for (const entry of entries) {
      keysInThisList.add(entryRarityKey(entry))
    }
    for (const key of keysInThisList) {
      if (!keyListSets.has(key)) keyListSets.set(key, new Set())
      keyListSets.get(key)!.add(listId)
    }
  }

  // 5. Collect rare keys (fraction < 15%)
  const rare: Record<string, number> = {}
  for (const [key, listSet] of keyListSets) {
    const fraction = listSet.size / totalLists
    if (fraction < RARE_THRESHOLD) {
      rare[key] = fraction
    }
  }

  const result: RarityResponse = { rare, totalLists, minListsMet: true }
  cache.set(category, { data: result, expiry: Date.now() + CACHE_TTL })
  return NextResponse.json(result)
}
