'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import { fetchPosters } from '@/lib/tmdb'
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

// ── Title normalisation ──────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the |a |an )/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
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
  const owner = list.profiles
  if (!owner) return null
  const label = owner.display_name ?? owner.username
  const initial = label[0].toUpperCase()
  return (
    <Link href={`/${owner.username}`} className="flex items-center gap-1.5">
      {owner.avatar_url ? (
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

// ── Entry row ────────────────────────────────────────────────────────────────

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
      style={{
        background: matched ? 'rgba(232,197,71,0.08)' : 'transparent',
        border: `1px solid ${matched ? 'rgba(232,197,71,0.3)' : 'transparent'}`,
        opacity: matched ? 1 : 0.4,
      }}
    >
      {/* Rank or tier badge */}
      <div className="shrink-0 w-14 flex justify-end">
        {hasRank ? (
          <span
            className="text-xs tabular-nums"
            style={{ color: (entry.rank ?? 0) <= 3 ? accentColor : 'var(--muted)', fontWeight: (entry.rank ?? 0) <= 3 ? 700 : 500 }}
          >
            {entry.rank}
          </span>
        ) : tierLabel ? (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[56px]"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            {tierLabel}
          </span>
        ) : null}
      </div>

      {/* Poster */}
      <div className="shrink-0 rounded overflow-hidden" style={{ width: 28, height: 42, background: 'var(--surface-2)' }}>
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Title */}
      <span className="text-sm leading-snug min-w-0 flex-1 truncate" style={{ color: matched ? 'var(--foreground)' : 'var(--muted)' }}>
        {entry.title}
      </span>

      {matched && <span className="text-xs shrink-0" style={{ color: accentColor }}>✓</span>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const params = useParams<{ listId1: string; listId2: string }>()
  const router = useRouter()

  // Use local state so swapping a slot updates everything reactively
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

    setLoading(false)
  }, [])

  useEffect(() => { load(id1, id2) }, [id1, id2, load])

  // Keep URL in sync when slots are swapped
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

  // Tier label lookups
  const tierMap1 = new Map(tiers1.map(t => [t.id, t.label]))
  const tierByLabel1 = new Map(tiers1.map(t => [t.label, t.id]))
  const tierMap2 = new Map(tiers2.map(t => [t.id, t.label]))
  const tierByLabel2 = new Map(tiers2.map(t => [t.label, t.id]))

  function getTierLabel1(entry: ListEntry): string | null {
    if (entry.tier_id) return tierMap1.get(entry.tier_id) ?? entry.tier ?? null
    if (entry.tier) return tierByLabel1.has(entry.tier) ? entry.tier : entry.tier
    return null
  }
  function getTierLabel2(entry: ListEntry): string | null {
    if (entry.tier_id) return tierMap2.get(entry.tier_id) ?? entry.tier ?? null
    if (entry.tier) return tierByLabel2.has(entry.tier) ? entry.tier : entry.tier
    return null
  }

  // Compute matches
  const norm1 = new Map(entries1.map(e => [normalizeTitle(e.title), e]))
  const norm2 = new Map(entries2.map(e => [normalizeTitle(e.title), e]))
  const matchedKeys = new Set([...norm1.keys()].filter(t => norm2.has(t)))
  const matchCount = matchedKeys.size
  const totalUnique = new Set([...norm1.keys(), ...norm2.keys()]).size

  const matchedEntries1 = entries1.filter(e => matchedKeys.has(normalizeTitle(e.title)))

  const owner1Label = list1.profiles?.display_name ?? list1.profiles?.username ?? 'List 1'
  const owner2Label = list2.profiles?.display_name ?? list2.profiles?.username ?? 'List 2'
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/compare/${id1}/${id2}` : ''

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link href={`/list/${id1}`} className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          ← Back to list
        </Link>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-xl font-bold leading-snug">
            {owner1Label} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>vs.</span> {owner2Label}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {list1.title} · {list2.title}
          </p>
        </div>

        {/* Overlap score card */}
        <div className="rounded-xl p-5 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-4xl font-bold" style={{ color: 'var(--accent)' }}>{matchCount}</span>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              {matchCount === 1 ? 'title' : 'titles'} in common
              {totalUnique > 0 && <span className="ml-1 opacity-50">/ {totalUnique} unique</span>}
            </span>
          </div>

          {/* Matched title thumbnails */}
          {matchCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
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

        {/* Side-by-side columns */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">

          {/* List 1 */}
          <div className={activeTab !== 1 ? 'hidden lg:block' : ''}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <OwnerChip list={list1} />
                <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted)' }}>· {list1.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/list/${id1}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                <button
                  onClick={() => setSwapSlot(1)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  ⇄ Swap
                </button>
              </div>
            </div>
            <div className="space-y-0.5">
              {entries1.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  matched={matchedKeys.has(normalizeTitle(entry.title))}
                  poster={entry.image_url ?? posters1[entry.id] ?? null}
                  tierLabel={getTierLabel1(entry)}
                />
              ))}
            </div>
          </div>

          {/* List 2 */}
          <div className={activeTab !== 2 ? 'hidden lg:block' : ''}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <OwnerChip list={list2} />
                <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted)' }}>· {list2.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/list/${id2}`} className="text-xs" style={{ color: 'var(--muted)' }}>View →</Link>
                <button
                  onClick={() => setSwapSlot(2)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  ⇄ Swap
                </button>
              </div>
            </div>
            <div className="space-y-0.5">
              {entries2.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  matched={matchedKeys.has(normalizeTitle(entry.title))}
                  poster={entry.image_url ?? posters2[entry.id] ?? null}
                  tierLabel={getTierLabel2(entry)}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Swap picker */}
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
