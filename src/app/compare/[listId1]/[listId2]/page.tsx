'use client'

import { useState, useEffect, useCallback } from 'react'
import posthog from 'posthog-js'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import { fetchPosters } from '@/lib/tmdb'
import { notesToPlainText } from '@/lib/notes'
import type { List, ListEntry, Tier } from '@/types'

type ListWithOwner = List & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

type SearchResult = {
  id: string
  title: string
  year: number | null
  category: string
  owner_id: string | null
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

type TableRow = {
  section: 'common' | 'only1' | 'only2'
  entry1: ListEntry | null
  entry2: ListEntry | null
}

type TierGroup = { tierLabel: string | null; rows: TableRow[] }

// ── Title normalisation ──────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the |a |an )/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// ── Display name: falls back to source_label for featured lists ──────────────

function getDisplayName(list: ListWithOwner): string {
  if (!list.owner_id && list.source_label) return list.source_label
  return list.profiles?.display_name ?? list.profiles?.username ?? 'Unknown'
}

// ── Swap / search picker ─────────────────────────────────────────────────────

function SwapPicker({
  category,
  excludeIds,
  onPick,
  onClose,
}: {
  category: 'movies' | 'tv'
  excludeIds: string[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/lists/search?category=${category}&q=${encodeURIComponent(query)}`)
      const data: SearchResult[] = await res.json()
      setResults(data.filter(l => !excludeIds.includes(l.id)))
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, category, excludeIds])

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '80vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
        <div className="px-5 pb-3 shrink-0">
          <h3 className="font-bold text-base mb-3">Choose a list…</h3>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${category} lists…`}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
              {query ? 'No lists found.' : 'Start typing to search lists…'}
            </p>
          ) : (
            <div className="space-y-1">
              {results.map(list => {
                const owner = list.profiles
                const label = owner?.display_name ?? owner?.username ?? 'Unknown'
                const initial = label[0]?.toUpperCase() ?? '?'
                return (
                  <button
                    key={list.id}
                    onClick={() => onPick(list.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    {owner?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={owner.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{list.title}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                        {label}{list.year ? ` · ${list.year}` : ''}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Owner chip ───────────────────────────────────────────────────────────────

function OwnerChip({ list }: { list: ListWithOwner }) {
  const label = getDisplayName(list)
  const owner = list.profiles
  const initial = label[0]?.toUpperCase() ?? '?'
  return (
    <Link href={owner ? `/${owner.username}` : '#'} className="flex items-center gap-1.5">
      {owner?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>
          {initial}
        </div>
      )}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}

// ── Entry row (side-by-side fallback for purely tiered lists) ─────────────────

function EntryRow({
  entry,
  matched,
  poster,
  tierLabel,
}: {
  entry: ListEntry
  matched: boolean
  poster: string | null
  tierLabel: string | null
}) {
  const hasRank = entry.rank != null && entry.rank > 0
  const accentColor = 'var(--accent)'

  return (
    <div
      className="flex items-center gap-2.5 py-2 px-3 rounded-lg"
      style={{ background: 'transparent', opacity: matched ? 1 : 0.55 }}
    >
      <div className="shrink-0 w-14 flex justify-end">
        {tierLabel ? (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[56px]"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            {tierLabel}
          </span>
        ) : hasRank ? (
          <span
            className="text-xs tabular-nums"
            style={{ color: (entry.rank ?? 0) <= 3 ? accentColor : 'var(--muted)', fontWeight: (entry.rank ?? 0) <= 3 ? 700 : 500 }}
          >
            {entry.rank}
          </span>
        ) : null}
      </div>
      <div className="shrink-0 rounded overflow-hidden" style={{ width: 28, height: 42, background: 'var(--surface-2)' }}>
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <span className="text-sm leading-snug min-w-0 flex-1 truncate" style={{ color: 'var(--foreground)' }}>
        {entry.title}
      </span>
      {matched && <span className="text-xs shrink-0" style={{ color: accentColor }}>✓</span>}
    </div>
  )
}

// ── Tier pill components ─────────────────────────────────────────────────────

function TierPill1({ label }: { label: string }) {
  return (
    <span style={{
      background: 'rgba(245,158,11,0.15)',
      color: 'rgba(245,158,11,0.8)',
      border: '0.5px solid rgba(245,158,11,0.3)',
      borderRadius: 4,
      fontSize: 10,
      padding: '2px 6px',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function TierPill2({ label }: { label: string }) {
  return (
    <span style={{
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.5)',
      border: '0.5px solid rgba(255,255,255,0.15)',
      borderRadius: 4,
      fontSize: 10,
      padding: '2px 6px',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const params = useParams<{ listId1: string; listId2: string }>()
  const router = useRouter()

  const [id1, setId1] = useState(params.listId1)
  const [id2, setId2] = useState(params.listId2)
  const [swapSlot, setSwapSlot] = useState<1 | 2 | null>(null)

  const [list1, setList1] = useState<ListWithOwner | null>(null)
  const [list2, setList2] = useState<ListWithOwner | null>(null)
  const [entries1, setEntries1] = useState<ListEntry[]>([])
  const [entries2, setEntries2] = useState<ListEntry[]>([])
  const [tiers1, setTiers1] = useState<Tier[]>([])
  const [tiers2, setTiers2] = useState<Tier[]>([])
  const [posters1, setPosters1] = useState<Record<string, string | null>>({})
  const [posters2, setPosters2] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<1 | 2>(1)

  const load = useCallback(async (lid1: string, lid2: string) => {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase
        .from('lists')
        .select('id, title, year, category, list_type, list_format, genre, description, owner_id, featured, source_label, source_url, created_at, profiles(username, display_name, avatar_url)')
        .eq('id', lid1)
        .single(),
      supabase
        .from('lists')
        .select('id, title, year, category, list_type, list_format, genre, description, owner_id, featured, source_label, source_url, created_at, profiles(username, display_name, avatar_url)')
        .eq('id', lid2)
        .single(),
    ])

    if (!r1.data || !r2.data) { setLoading(false); return }

    setList1(r1.data as unknown as ListWithOwner)
    setList2(r2.data as unknown as ListWithOwner)

    const [e1, e2, t1, t2] = await Promise.all([
      supabase.from('list_entries').select('id, list_id, rank, tier_id, tier, title, notes, image_url, created_at').eq('list_id', lid1).order('rank', { ascending: true }),
      supabase.from('list_entries').select('id, list_id, rank, tier_id, tier, title, notes, image_url, created_at').eq('list_id', lid2).order('rank', { ascending: true }),
      supabase.from('tiers').select('id, list_id, label, color, position, created_at').eq('list_id', lid1).order('position'),
      supabase.from('tiers').select('id, list_id, label, color, position, created_at').eq('list_id', lid2).order('position'),
    ])

    const ee1 = (e1.data ?? []) as ListEntry[]
    const ee2 = (e2.data ?? []) as ListEntry[]
    setEntries1(ee1)
    setEntries2(ee2)
    setTiers1((t1.data ?? []) as Tier[])
    setTiers2((t2.data ?? []) as Tier[])

    const cat = r1.data.category as 'movies' | 'tv'
    const yr = r1.data.year ?? null
    Promise.all([
      fetchPosters(ee1.map(e => ({ id: e.id, title: e.title })), cat, yr),
      fetchPosters(ee2.map(e => ({ id: e.id, title: e.title })), cat, yr),
    ]).then(([p1, p2]) => {
      setPosters1(Object.fromEntries(Object.entries(p1).map(([k, v]) => [k, v.poster])))
      setPosters2(Object.fromEntries(Object.entries(p2).map(([k, v]) => [k, v.poster])))
    })

    posthog.capture('comparison_viewed', { list1_id: lid1, list2_id: lid2 })
    setLoading(false)
  }, [])

  useEffect(() => { load(id1, id2) }, [id1, id2, load])

  useEffect(() => {
    router.replace(`/compare/${id1}/${id2}`, { scroll: false })
  }, [id1, id2, router])

  function handleSwapPick(newId: string) {
    setSwapSlot(null)
    if (swapSlot === 1) setId1(newId)
    else if (swapSlot === 2) setId2(newId)
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <AppHeader />
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    )
  }

  if (!list1 || !list2) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <AppHeader />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p style={{ color: 'var(--muted)' }}>One or both lists could not be found.</p>
          <button onClick={() => router.back()} className="mt-4 text-sm underline" style={{ color: 'var(--accent)' }}>Go back</button>
        </div>
      </div>
    )
  }

  // Tier lookup maps
  const tierMap1 = new Map(tiers1.map(t => [t.id, t.label]))
  const tierPos1 = new Map(tiers1.map(t => [t.id, t.position]))
  const tierByLabel1 = new Map(tiers1.map(t => [t.label, t]))
  const tierMap2 = new Map(tiers2.map(t => [t.id, t.label]))
  const tierPos2 = new Map(tiers2.map(t => [t.id, t.position]))
  const tierByLabel2 = new Map(tiers2.map(t => [t.label, t]))

  function getTierLabel(entry: ListEntry, tMap: Map<string, string>, tByLabel: Map<string, Tier>): string | null {
    if (entry.tier_id) return tMap.get(entry.tier_id) ?? entry.tier ?? null
    if (entry.tier && tByLabel.has(entry.tier)) return entry.tier
    if (entry.tier) return entry.tier
    return null
  }

  function sortByTierThenRank(entries: ListEntry[], tPos: Map<string, number>, tByLabel: Map<string, Tier>): ListEntry[] {
    const hasRanks = entries.some(e => e.rank && e.rank > 0)
    if (hasRanks) {
      // Tier-ranked list: sort purely by rank — most reliable, avoids DB position issues
      return [...entries].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    }
    // Purely tiered list: sort by tier DB position
    return [...entries].sort((a, b) => {
      const posA = a.tier_id ? (tPos.get(a.tier_id) ?? 999) : (a.tier ? (tByLabel.get(a.tier)?.position ?? 999) : 999)
      const posB = b.tier_id ? (tPos.get(b.tier_id) ?? 999) : (b.tier ? (tByLabel.get(b.tier)?.position ?? 999) : 999)
      if (posA !== posB) return posA - posB
      return (a.rank ?? 9999) - (b.rank ?? 9999)
    })
  }

  const hasTiers1 = tiers1.length > 0
  const hasTiers2 = tiers2.length > 0
  const sorted1 = hasTiers1 ? sortByTierThenRank(entries1, tierPos1, tierByLabel1) : entries1
  const sorted2 = hasTiers2 ? sortByTierThenRank(entries2, tierPos2, tierByLabel2) : entries2

  // Compute matches
  const norm1 = new Map(entries1.map(e => [normalizeTitle(e.title), e]))
  const norm2 = new Map(entries2.map(e => [normalizeTitle(e.title), e]))
  const matchedKeys = new Set([...norm1.keys()].filter(t => norm2.has(t)))
  const matchCount = matchedKeys.size
  const totalUnique = new Set([...norm1.keys(), ...norm2.keys()]).size

  const matchedEntries1 = entries1.filter(e => matchedKeys.has(normalizeTitle(e.title)))

  const owner1Label = getDisplayName(list1)
  const owner2Label = getDisplayName(list2)
  // When comparing two lists from the same person, use list titles as section labels
  // so "Only on Prad's list" doesn't appear twice
  const sameOwner = !!(list1.owner_id && list2.owner_id && list1.owner_id === list2.owner_id)
  const section1Label = sameOwner ? list1.title : owner1Label
  const section2Label = sameOwner ? list2.title : owner2Label
  const owner1Short = sameOwner ? list1.title.split(' ').slice(0, 2).join(' ') : owner1Label.split(' ')[0]
  const owner2Short = sameOwner ? list2.title.split(' ').slice(0, 2).join(' ') : owner2Label.split(' ')[0]
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/compare/${id1}/${id2}` : ''

  // Table view: use when neither list is purely tiered
  const list1IsPurelyTiered = entries1.length > 0 && entries1.every(e => !e.rank || e.rank === 0)
  const list2IsPurelyTiered = entries2.length > 0 && entries2.every(e => !e.rank || e.rank === 0)
  const useTableView = !list1IsPurelyTiered && !list2IsPurelyTiered

  // Build table rows from sorted order
  const inCommonRows: TableRow[] = []
  const only1Rows: TableRow[] = []
  const only2Rows: TableRow[] = []

  if (useTableView) {
    for (const e1 of sorted1) {
      const key = normalizeTitle(e1.title)
      if (matchedKeys.has(key)) {
        inCommonRows.push({ section: 'common', entry1: e1, entry2: norm2.get(key) ?? null })
      } else {
        only1Rows.push({ section: 'only1', entry1: e1, entry2: null })
      }
    }
    for (const e2 of sorted2) {
      if (!matchedKeys.has(normalizeTitle(e2.title))) {
        only2Rows.push({ section: 'only2', entry1: null, entry2: e2 })
      }
    }
  }

  // Build tier groups for only1 and only2 sections.
  // tiersArray is already in position order from DB — use its index to sort groups
  // so the tier order in compare always matches the list detail page.
  function buildTierGroups(rows: TableRow[], hasTiers: boolean, getLabel: (e: ListEntry) => string | null, tiersArray: Tier[]): TierGroup[] {
    if (!hasTiers) return [{ tierLabel: null, rows }]
    const tierOrderIdx = new Map(tiersArray.map((t, i) => [t.label, i]))
    const groups: TierGroup[] = []
    const seen = new Map<string, TierGroup>()
    for (const row of rows) {
      const e = row.entry1 ?? row.entry2!
      const key = getLabel(e) ?? '__none__'
      if (!seen.has(key)) {
        const g: TierGroup = { tierLabel: key === '__none__' ? null : key, rows: [] }
        seen.set(key, g)
        groups.push(g)
      }
      seen.get(key)!.rows.push(row)
    }
    return groups.sort((a, b) => {
      // For tier-ranked lists: sort groups by the minimum rank of their entries.
      // This is robust against DB position values being out of order.
      // For purely tiered lists (all ranks null/0) fall back to DB position index.
      const minRank = (g: TierGroup) => Math.min(...g.rows.map(r => (r.entry1 ?? r.entry2!)?.rank ?? 9999))
      const rA = minRank(a), rB = minRank(b)
      if (rA !== 9999 || rB !== 9999) return rA - rB
      const idxA = a.tierLabel != null ? (tierOrderIdx.get(a.tierLabel) ?? 9999) : 9999
      const idxB = b.tierLabel != null ? (tierOrderIdx.get(b.tierLabel) ?? 9999) : 9999
      return idxA - idxB
    })
  }

  const only1Groups = buildTierGroups(only1Rows, hasTiers1, e => getTierLabel(e, tierMap1, tierByLabel1), tiers1)
  const only2Groups = buildTierGroups(only2Rows, hasTiers2, e => getTierLabel(e, tierMap2, tierByLabel2), tiers2)

  // ── Row renderers ────────────────────────────────────────────────────────

  const rowStyle = { borderBottom: '0.5px solid rgba(255,255,255,0.05)' }

  function renderCommonRow(row: TableRow) {
    const e1 = row.entry1!
    const e2 = row.entry2
    const poster = e1.image_url ?? posters1[e1.id] ?? null
    const t1 = getTierLabel(e1, tierMap1, tierByLabel1)
    const t2 = e2 ? getTierLabel(e2, tierMap2, tierByLabel2) : null
    const hasRank1 = (e1.rank ?? 0) > 0
    const hasRank2 = (e2?.rank ?? 0) > 0
    const notes1 = notesToPlainText(e1.notes)
    const notes2 = notesToPlainText(e2?.notes)
    const hasBothNotes = !!notes1 && !!notes2

    return (
      <div key={e1.id} className="flex items-start px-3 py-2.5" style={{ ...rowStyle, background: 'rgba(245,158,11,0.04)' }}>
        {/* Poster */}
        <div className="shrink-0 rounded overflow-hidden mr-2 mt-0.5" style={{ width: 28, height: 40, background: 'var(--surface-2)' }}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        {/* Title + tier pills + descriptions */}
        <div className="flex-1 min-w-0 mr-2">
          <span className="text-[12px] leading-snug block truncate" style={{ color: 'var(--foreground)' }}>
            {e1.title}
          </span>
          {(t1 || t2) && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {t1 && <TierPill1 label={t1} />}
              {t2 && <TierPill2 label={t2} />}
            </div>
          )}
          {(notes1 || notes2) && (
            <div className="mt-1.5 space-y-1">
              {hasBothNotes ? (
                <>
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(245,158,11,0.6)' }}>{owner1Short}: </span>
                    <span className="text-[11px] italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{notes1}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>{owner2Short}: </span>
                    <span className="text-[11px] italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{notes2}</span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {notes1 || notes2}
                </p>
              )}
            </div>
          )}
        </div>
        {/* Rank 1 */}
        <div className="w-11 shrink-0 flex justify-center pt-0.5">
          {hasRank1 ? (
            <span className="text-xs tabular-nums font-semibold" style={{ color: (e1.rank ?? 0) <= 3 ? 'var(--accent)' : 'rgba(255,255,255,0.75)' }}>
              {e1.rank}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
          )}
        </div>
        {/* Rank 2 */}
        <div className="w-11 shrink-0 flex justify-center pt-0.5">
          {hasRank2 ? (
            <span className="text-xs tabular-nums font-semibold" style={{ color: (e2?.rank ?? 0) <= 3 ? 'var(--accent)' : 'rgba(255,255,255,0.75)' }}>
              {e2!.rank}
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
          )}
        </div>
      </div>
    )
  }

  function renderOnly1Row(row: TableRow) {
    const e1 = row.entry1!
    const poster = e1.image_url ?? posters1[e1.id] ?? null
    const t1 = getTierLabel(e1, tierMap1, tierByLabel1)
    const hasRank1 = (e1.rank ?? 0) > 0
    const notes1 = notesToPlainText(e1.notes)

    return (
      <div key={e1.id} className="flex items-start px-3 py-2.5" style={rowStyle}>
        <div className="shrink-0 rounded overflow-hidden mr-2 mt-0.5" style={{ width: 28, height: 40, background: 'var(--surface-2)' }}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 mr-2">
          <span className="text-[12px] leading-snug block truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {e1.title}
          </span>
          {t1 && (
            <div className="flex gap-1 mt-1">
              <TierPill1 label={t1} />
            </div>
          )}
          {notes1 && (
            <p className="text-[11px] italic mt-1.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {notes1}
            </p>
          )}
        </div>
        <div className="w-11 shrink-0 flex justify-center pt-0.5">
          {hasRank1 ? (
            <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>{e1.rank}</span>
          ) : (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
          )}
        </div>
        <div className="w-11 shrink-0" />
      </div>
    )
  }

  function renderOnly2Row(row: TableRow) {
    const e2 = row.entry2!
    const poster = e2.image_url ?? posters2[e2.id] ?? null
    const t2 = getTierLabel(e2, tierMap2, tierByLabel2)
    const hasRank2 = (e2.rank ?? 0) > 0
    const notes2 = notesToPlainText(e2.notes)

    return (
      <div key={e2.id} className="flex items-start px-3 py-2.5" style={rowStyle}>
        <div className="shrink-0 rounded overflow-hidden mr-2 mt-0.5" style={{ width: 28, height: 40, background: 'var(--surface-2)' }}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 mr-2">
          <span className="text-[12px] leading-snug block truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {e2.title}
          </span>
          {t2 && (
            <div className="flex gap-1 mt-1">
              <TierPill2 label={t2} />
            </div>
          )}
          {notes2 && (
            <p className="text-[11px] italic mt-1.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {notes2}
            </p>
          )}
        </div>
        <div className="w-11 shrink-0" />
        <div className="w-11 shrink-0 flex justify-center pt-0.5">
          {hasRank2 ? (
            <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>{e2.rank}</span>
          ) : (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-[760px] mx-auto px-4 py-8">

        {/* Back link */}
        <Link href={`/list/${id1}`} className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          ← Back to list
        </Link>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-xl font-bold leading-snug">
            {list1.title} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>vs.</span> {list2.title}
          </h1>
        </div>

        {/* Overlap score card */}
        <div className="rounded-xl p-5 mb-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-baseline justify-center gap-3 mb-1">
            <span className="text-5xl font-bold" style={{ color: 'var(--accent)' }}>{matchCount}</span>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {matchCount === 1 ? 'title' : 'titles'} in common
              {totalUnique > 0 && <span className="ml-1">/ {totalUnique} unique</span>}
            </span>
          </div>

          {matchCount > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {matchedEntries1.map(e => {
                const poster = e.image_url ?? posters1[e.id] ?? null
                return (
                  <div key={e.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.25)' }}>
                    {poster && (
                      <div className="shrink-0 rounded overflow-hidden" style={{ width: 20, height: 30 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={poster} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{e.title}</span>
                  </div>
                )
              })}
            </div>
          )}

          {matchCount === 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>No titles in common.</p>
          )}

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ url: shareUrl, title: `${owner1Label} vs ${owner2Label} — ${matchCount} titles in common` })
              } else {
                navigator.clipboard.writeText(shareUrl)
              }
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 4l3-3 3 3M2 10v2.5h10V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Share comparison
          </button>
        </div>

        {useTableView ? (
          /* ── Unified table view ──────────────────────────────────────────── */
          <div>
            {/* List headers with swap controls */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <OwnerChip list={list1} />
                <Link href={`/list/${id1}?from=/compare/${id1}/${id2}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                <button
                  onClick={() => setSwapSlot(1)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  ⇄ Swap
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSwapSlot(2)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  ⇄ Swap
                </button>
                <Link href={`/list/${id2}?from=/compare/${id1}/${id2}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                <OwnerChip list={list2} />
              </div>
            </div>

            {/* Column headers */}
            <div className="flex items-center px-3 pb-2">
              <div className="shrink-0 mr-2" style={{ width: 28 }} />
              <div className="flex-1 min-w-0 mr-2" />
              <div className="w-11 shrink-0 text-center text-[10px] font-medium truncate" style={{ color: 'var(--muted)' }}>
                {owner1Short}
              </div>
              <div className="w-11 shrink-0 text-center text-[10px] font-medium truncate" style={{ color: 'var(--muted)' }}>
                {owner2Short}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>

              {/* In common section */}
              {inCommonRows.length > 0 && (
                <>
                  <div className="px-3 py-2" style={{ background: 'rgba(245,158,11,0.12)', borderBottom: '0.5px solid rgba(245,158,11,0.2)' }}>
                    <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: '#f59e0b' }}>
                      In common · {inCommonRows.length}
                    </span>
                  </div>
                  {inCommonRows.map(row => renderCommonRow(row))}
                </>
              )}

              {/* Only on list 1 section */}
              {only1Rows.length > 0 && (
                <>
                  <div className="px-3 py-2" style={{ background: 'var(--surface-2)', borderTop: inCommonRows.length > 0 ? '0.5px solid var(--border)' : undefined, borderBottom: '0.5px solid var(--border)' }}>
                    <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--muted)' }}>
                      {sameOwner ? `Only on "${section1Label}" · ${only1Rows.length}` : `Only on ${section1Label}'s list · ${only1Rows.length}`}
                    </span>
                  </div>
                  {only1Groups.map((group, gi) => (
                    <div key={gi}>
                      {group.tierLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>{group.tierLabel}</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                      )}
                      {group.rows.map(row => renderOnly1Row(row))}
                    </div>
                  ))}
                </>
              )}

              {/* Only on list 2 section */}
              {only2Rows.length > 0 && (
                <>
                  <div className="px-3 py-2" style={{ background: 'var(--surface-2)', borderTop: (inCommonRows.length > 0 || only1Rows.length > 0) ? '0.5px solid var(--border)' : undefined, borderBottom: '0.5px solid var(--border)' }}>
                    <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: 'var(--muted)' }}>
                      {sameOwner ? `Only on "${section2Label}" · ${only2Rows.length}` : `Only on ${section2Label}'s list · ${only2Rows.length}`}
                    </span>
                  </div>
                  {only2Groups.map((group, gi) => (
                    <div key={gi}>
                      {group.tierLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>{group.tierLabel}</span>
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        </div>
                      )}
                      {group.rows.map(row => renderOnly2Row(row))}
                    </div>
                  ))}
                </>
              )}

            </div>
          </div>
        ) : (
          /* ── Side-by-side fallback for purely tiered lists ───────────────── */
          <>
            {/* Mobile tab toggle */}
            <div className="flex lg:hidden mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {([1, 2] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-2 text-sm font-medium transition-colors truncate px-3"
                  style={{ background: activeTab === tab ? 'var(--accent)' : 'var(--surface)', color: activeTab === tab ? '#0a0a0f' : 'var(--muted)' }}
                >
                  {tab === 1 ? owner1Label : owner2Label}
                </button>
              ))}
            </div>

            <div className="lg:grid lg:grid-cols-2 lg:gap-6">
              <div className={activeTab !== 1 ? 'hidden lg:block' : ''}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <OwnerChip list={list1} />
                    <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted)' }}>· {list1.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/list/${id1}?from=/compare/${id1}/${id2}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                    <button onClick={() => setSwapSlot(1)} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>⇄ Swap</button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {sorted1.map(entry => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      matched={matchedKeys.has(normalizeTitle(entry.title))}
                      poster={entry.image_url ?? posters1[entry.id] ?? null}
                      tierLabel={getTierLabel(entry, tierMap1, tierByLabel1)}
                    />
                  ))}
                </div>
              </div>

              <div className={activeTab !== 2 ? 'hidden lg:block' : ''}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <OwnerChip list={list2} />
                    <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted)' }}>· {list2.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/list/${id2}?from=/compare/${id1}/${id2}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                    <button onClick={() => setSwapSlot(2)} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>⇄ Swap</button>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {sorted2.map(entry => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      matched={matchedKeys.has(normalizeTitle(entry.title))}
                      poster={entry.image_url ?? posters2[entry.id] ?? null}
                      tierLabel={getTierLabel(entry, tierMap2, tierByLabel2)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {swapSlot !== null && (
        <SwapPicker
          category={list1.category as 'movies' | 'tv'}
          excludeIds={swapSlot === 1 ? [id2] : [id1]}
          onPick={handleSwapPick}
          onClose={() => setSwapSlot(null)}
        />
      )}
    </div>
  )
}
