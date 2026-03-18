'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchPoster } from '@/lib/tmdb'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/context/auth'
import type { List, ListEntry } from '@/types'

type OwnerInfo = { username: string; display_name: string | null; avatar_url: string | null }
type RichList = List & { entries: ListEntry[]; profiles: OwnerInfo | null; reactionCount: number; commentCount: number }

// ── Owner chip ─────────────────────────────────────────────────────────────

function OwnerChip({ owner, onClick }: { owner: OwnerInfo; onClick?: (e: React.MouseEvent) => void }) {
  const initial = (owner.display_name ?? owner.username)[0].toUpperCase()
  return (
    <Link href={`/${owner.username}`} onClick={onClick} className="flex items-center gap-1.5 w-fit">
      {owner.avatar_url ? (
        <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          {initial}
        </div>
      )}
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {owner.display_name ?? owner.username}
      </span>
    </Link>
  )
}

// ── Poster stack ────────────────────────────────────────────────────────────

function PosterStack({
  entries,
  size = 'md',
  posters = {},
}: {
  entries: ListEntry[]
  size?: 'sm' | 'md'
  posters?: Record<string, string | null>
}) {
  const top3 = entries.slice(0, 3)
  if (top3.length === 0) return null

  const w = size === 'sm' ? 36 : 48
  const h = size === 'sm' ? 54 : 72
  const overlap = size === 'sm' ? 10 : 14
  const totalW = w + (top3.length - 1) * (w - overlap)

  return (
    <div style={{ position: 'relative', width: totalW, height: h, flexShrink: 0 }}>
      {top3.map((entry, i) => {
        const url = entry.image_url ?? posters[entry.id] ?? null
        return url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={entry.id}
            src={url}
            alt={entry.title}
            style={{
              position: 'absolute',
              left: i * (w - overlap),
              width: w,
              height: h,
              objectFit: 'cover',
              borderRadius: 6,
              border: '2px solid var(--background)',
              zIndex: i,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          />
        ) : (
          <div
            key={entry.id}
            style={{
              position: 'absolute',
              left: i * (w - overlap),
              width: w,
              height: h,
              borderRadius: 6,
              border: '2px solid var(--background)',
              zIndex: i,
              background: 'var(--surface-2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          />
        )
      })}
    </div>
  )
}

// ── All-time card ───────────────────────────────────────────────────────────

function AllTimeCard({ list, posters }: { list: RichList; posters: Record<string, string | null> }) {
  const router = useRouter()
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'
  const hoverBorder = isMovie ? 'rgba(232,197,71,0.4)' : 'rgba(139,92,246,0.4)'
  const hoverShadow = isMovie ? '0 4px 24px rgba(232,197,71,0.07)' : '0 4px 24px rgba(139,92,246,0.07)'

  return (
    <div
      className="cursor-pointer rounded-xl p-4 flex flex-col gap-3 h-full transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onClick={() => router.push(`/list/${list.id}`)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.boxShadow = hoverShadow }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '' }}
    >
      {list.profiles && <OwnerChip owner={list.profiles} onClick={(e) => e.stopPropagation()} />}

      <h3 className="font-semibold text-base leading-tight">{list.title}</h3>

      <div className="flex items-start gap-4">
        <PosterStack entries={list.entries} size="md" posters={posters} />
        <ol className="flex-1 min-w-0 space-y-1.5 pt-1">
          {list.entries.slice(0, 3).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-xs min-w-0">
              {entry.rank != null && entry.rank > 0 && (
                <span className="font-bold w-4 shrink-0 text-right" style={{ color: accent }}>{entry.rank}</span>
              )}
              <span className="truncate" style={{ color: 'var(--muted)' }}>{entry.title}</span>
            </li>
          ))}
          {list.entries.length === 0 && (
            <li className="text-xs italic" style={{ color: 'var(--muted)' }}>Coming soon…</li>
          )}
        </ol>
      </div>

      <StatsRow reactionCount={list.reactionCount} commentCount={list.commentCount} />
    </div>
  )
}

// ── Recent card (horizontal strip) ─────────────────────────────────────────

function RecentCard({ list, posters }: { list: RichList; posters: Record<string, string | null> }) {
  const router = useRouter()
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'

  return (
    <div
      className="cursor-pointer rounded-xl p-3 flex flex-col gap-2.5 shrink-0 transition-all duration-200 hover:translate-y-[-2px]"
      style={{ width: 156, background: 'var(--surface)', border: '1px solid var(--border)' }}
      onClick={() => router.push(`/list/${list.id}`)}
    >
      <PosterStack entries={list.entries} size="sm" posters={posters} />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-snug line-clamp-2">{list.title}</p>
        {list.profiles && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
            {list.profiles.display_name ?? list.profiles.username}
          </p>
        )}
      </div>
      <span className="text-[10px] font-medium" style={{ color: accent }}>
        {isMovie ? '🎬' : '📺'} {list.year ?? 'All time'}
      </span>
    </div>
  )
}

// ── Year card ──────────────────────────────────────────────────────────────

function YearCard({ list, posters }: { list: RichList; posters: Record<string, string | null> }) {
  const router = useRouter()
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'
  const hoverBorder = isMovie ? 'rgba(232,197,71,0.4)' : 'rgba(139,92,246,0.4)'
  const hoverShadow = isMovie ? '0 4px 24px rgba(232,197,71,0.07)' : '0 4px 24px rgba(139,92,246,0.07)'

  return (
    <div
      className="cursor-pointer rounded-xl p-4 flex flex-col gap-3 h-full transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      onClick={() => router.push(`/list/${list.id}`)}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = hoverBorder; e.currentTarget.style.boxShadow = hoverShadow }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '' }}
    >
      {list.profiles && <OwnerChip owner={list.profiles} onClick={(e) => e.stopPropagation()} />}
      <h3 className="font-semibold text-sm leading-tight">{list.title}</h3>
      <div className="flex items-start gap-3">
        <PosterStack entries={list.entries} size="sm" posters={posters} />
        <ol className="flex-1 min-w-0 space-y-1.5 pt-0.5">
          {list.entries.slice(0, 3).map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-xs min-w-0">
              {entry.rank != null && entry.rank > 0 && (
                <span className="font-bold w-4 shrink-0 text-right" style={{ color: accent }}>{entry.rank}</span>
              )}
              <span className="truncate" style={{ color: 'var(--muted)' }}>{entry.title}</span>
            </li>
          ))}
          {list.entries.length === 0 && (
            <li className="text-xs italic" style={{ color: 'var(--muted)' }}>Coming soon…</li>
          )}
        </ol>
      </div>

      <StatsRow reactionCount={list.reactionCount} commentCount={list.commentCount} />
    </div>
  )
}

// ── Category label ─────────────────────────────────────────────────────────

function CategoryLabel({ category }: { category: 'movies' | 'tv' }) {
  const isMovie = category === 'movies'
  return (
    <div className="flex items-center gap-1.5 mb-3">
      <span className="text-sm">{isMovie ? '🎬' : '📺'}</span>
      <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: isMovie ? 'var(--accent)' : '#a78bfa' }}>
        {isMovie ? 'Movies' : 'TV Shows'}
      </span>
    </div>
  )
}

// ── Stats row ──────────────────────────────────────────────────────────────

function StatsRow({ reactionCount, commentCount }: { reactionCount: number; commentCount: number }) {
  if (reactionCount === 0 && commentCount === 0) return null
  return (
    <div className="flex items-center gap-3 mt-auto pt-2">
      {reactionCount > 0 && (
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span style={{ fontSize: 13 }}>🔥</span>{reactionCount}
        </span>
      )}
      {commentCount > 0 && (
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span style={{ fontSize: 13 }}>💬</span>{commentCount}
        </span>
      )}
    </div>
  )
}

// ── Paired card grid (same-height rows) ────────────────────────────────────

function PairedCardGrid<T extends RichList>({
  leftList,
  rightList,
  posters,
  Card,
}: {
  leftList: T[]
  rightList: T[]
  posters: Record<string, string | null>
  Card: React.ComponentType<{ list: T; posters: Record<string, string | null> }>
}) {
  const rowCount = Math.max(leftList.length, rightList.length)
  return (
    <div className="space-y-4">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="flex flex-col">
            {leftList[i] && <Card list={leftList[i]} posters={posters} />}
          </div>
          <div className="flex flex-col">
            {rightList[i] && <Card list={rightList[i]} posters={posters} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth()
  const [lists, setLists] = useState<RichList[]>([])
  const [posters, setPosters] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const didInitExpand = useRef(false)

  useEffect(() => { fetchLists() }, [])

  async function fetchLists() {
    const { data: raw, error } = await supabase
      .from('lists')
      .select('*, profiles(username, display_name, avatar_url)')
      .order('created_at', { ascending: false })

    if (error || !raw) { setLoading(false); return }

    const listIds = raw.map((l) => l.id)

    // Fetch top-3 entries for card display + all entry IDs for engagement counts
    const [{ data: topEntries }, { data: allEntries }, { data: listReactions }, { data: listComments }] = await Promise.all([
      supabase.from('list_entries').select('*').in('list_id', listIds).lte('rank', 3).order('rank', { ascending: true }),
      supabase.from('list_entries').select('id, list_id').in('list_id', listIds),
      supabase.from('reactions').select('list_id').in('list_id', listIds),
      supabase.from('comments').select('list_id').in('list_id', listIds),
    ])

    // Build entry-id → list-id map for aggregating entry-level counts
    const entryToList: Record<string, string> = {}
    for (const e of allEntries ?? []) entryToList[e.id] = e.list_id
    const allEntryIds = Object.keys(entryToList)

    const [{ data: entryReactions }, { data: entryComments }] = await Promise.all([
      allEntryIds.length > 0
        ? supabase.from('entry_reactions').select('list_entry_id').in('list_entry_id', allEntryIds)
        : Promise.resolve({ data: [] }),
      allEntryIds.length > 0
        ? supabase.from('entry_comments').select('list_entry_id').in('list_entry_id', allEntryIds)
        : Promise.resolve({ data: [] }),
    ])

    const entryMap: Record<string, ListEntry[]> = {}
    for (const e of topEntries ?? []) {
      if (!entryMap[e.list_id]) entryMap[e.list_id] = []
      if (entryMap[e.list_id].length < 3) entryMap[e.list_id].push(e)
    }

    const reactionMap: Record<string, number> = {}
    for (const r of listReactions ?? []) reactionMap[r.list_id] = (reactionMap[r.list_id] ?? 0) + 1
    for (const r of entryReactions ?? []) {
      const lid = entryToList[r.list_entry_id]
      if (lid) reactionMap[lid] = (reactionMap[lid] ?? 0) + 1
    }

    const commentMap: Record<string, number> = {}
    for (const c of listComments ?? []) commentMap[c.list_id] = (commentMap[c.list_id] ?? 0) + 1
    for (const c of entryComments ?? []) {
      const lid = entryToList[c.list_entry_id]
      if (lid) commentMap[lid] = (commentMap[lid] ?? 0) + 1
    }

    const richLists: RichList[] = raw.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
      profiles: list.profiles ?? null,
      reactionCount: reactionMap[list.id] ?? 0,
      commentCount: commentMap[list.id] ?? 0,
    }))

    // Auto-expand most recent year
    if (!didInitExpand.current) {
      didInitExpand.current = true
      const years = richLists.map((l) => l.year).filter((y): y is number => y !== null)
      if (years.length > 0) setExpandedYears(new Set([Math.max(...years)]))
    }

    setLists(richLists)
    setLoading(false)

    // Fetch TMDB posters for entries that don't have one stored
    const needPosters = richLists.flatMap((l) =>
      l.entries.filter((e) => !e.image_url).map((e) => ({
        id: e.id,
        title: e.title,
        category: l.category as 'movies' | 'tv',
        year: l.year,
      }))
    )
    if (needPosters.length > 0) {
      const results = await Promise.all(
        needPosters.map(async ({ id, title, category, year }) => ({
          id,
          url: (await fetchPoster(title, category, year)).poster,
        }))
      )
      const map: Record<string, string | null> = {}
      for (const { id, url } of results) map[id] = url
      setPosters(map)
    }
  }

  function toggleYear(y: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next
    })
  }

  const allTimeLists  = lists.filter((l) => l.year === null)
  const allTimeMovies = allTimeLists.filter((l) => l.category === 'movies')
  const allTimeTV     = allTimeLists.filter((l) => l.category === 'tv')

  const recentLists = lists.slice(0, 5)

  const annualLists = lists.filter((l) => l.year !== null)
  const years = [...new Set(annualLists.map((l) => l.year as number))].sort((a, b) => b - a)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-24">

        {/* ── Page header ── */}
        <div className="mb-14">
          <h1 className="text-3xl font-bold tracking-tight">Ranked</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            The best in film &amp; TV, ranked by people who care too much.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {!loading && lists.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>No lists yet.</p>
            {user && (
              <Link href="/create" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                Create the first one →
              </Link>
            )}
          </div>
        )}

        {!loading && lists.length > 0 && (
          <div className="space-y-16">

            {/* ── Section 1: All Time ── */}
            {allTimeLists.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">All Time</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>The definitive lists — no year limits.</p>
                </div>

                {allTimeMovies.length > 0 && allTimeTV.length > 0 ? (
                  /* Both categories */
                  <div>
                    {/* Mobile: grouped by category */}
                    <div className="sm:hidden space-y-6">
                      <div>
                        <CategoryLabel category="movies" />
                        <div className="space-y-4">
                          {allTimeMovies.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} />)}
                        </div>
                      </div>
                      <div>
                        <CategoryLabel category="tv" />
                        <div className="space-y-4">
                          {allTimeTV.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} />)}
                        </div>
                      </div>
                    </div>
                    {/* Desktop: side-by-side paired rows */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-2 gap-8 mb-1">
                        <CategoryLabel category="movies" />
                        <CategoryLabel category="tv" />
                      </div>
                      <PairedCardGrid
                        leftList={allTimeMovies}
                        rightList={allTimeTV}
                        posters={posters}
                        Card={AllTimeCard}
                      />
                    </div>
                  </div>
                ) : (
                  /* Single category */
                  <div className="max-w-xl">
                    {allTimeLists.length > 0 && <CategoryLabel category={allTimeLists[0].category} />}
                    <div className="space-y-4">
                      {allTimeLists.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} />)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Section 2: Recently Added ── */}
            {recentLists.length > 0 && (
              <section>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold tracking-tight">Recently Added</h2>
                </div>
                <div
                  className="flex gap-3 overflow-x-auto pb-2"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {recentLists.map((l) => <RecentCard key={l.id} list={l} posters={posters} />)}
                </div>
              </section>
            )}

            {/* ── Section 3: By Year ── */}
            {years.length > 0 && (
              <section>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">By Year</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Year-by-year, side by side.</p>
                </div>

                <div className="space-y-3">
                  {years.map((year) => {
                    const yearMovies = annualLists.filter((l) => l.year === year && l.category === 'movies')
                    const yearTV     = annualLists.filter((l) => l.year === year && l.category === 'tv')
                    const isOpen     = expandedYears.has(year)

                    return (
                      <div key={year} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <button
                          onClick={() => toggleYear(year)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left"
                          style={{ background: 'var(--surface)' }}
                        >
                          <span className="font-bold text-lg">{year}</span>
                          <span className="text-sm transition-transform duration-200" style={{ color: 'var(--muted)', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                        </button>

                        {isOpen && (
                          <div
                            className="px-5 py-5"
                            style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}
                          >
                            {yearMovies.length > 0 && yearTV.length > 0 ? (
                              <div>
                                {/* Mobile: grouped by category */}
                                <div className="sm:hidden space-y-6">
                                  <div>
                                    <CategoryLabel category="movies" />
                                    <div className="space-y-3">
                                      {yearMovies.map((l) => <YearCard key={l.id} list={l} posters={posters} />)}
                                    </div>
                                  </div>
                                  <div>
                                    <CategoryLabel category="tv" />
                                    <div className="space-y-3">
                                      {yearTV.map((l) => <YearCard key={l.id} list={l} posters={posters} />)}
                                    </div>
                                  </div>
                                </div>
                                {/* Desktop: side-by-side paired rows */}
                                <div className="hidden sm:block">
                                  <div className="grid grid-cols-2 gap-6 mb-1">
                                    <CategoryLabel category="movies" />
                                    <CategoryLabel category="tv" />
                                  </div>
                                  <PairedCardGrid
                                    leftList={yearMovies}
                                    rightList={yearTV}
                                    posters={posters}
                                    Card={YearCard}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="max-w-sm">
                                {yearMovies.length > 0 && <CategoryLabel category="movies" />}
                                {yearTV.length > 0 && <CategoryLabel category="tv" />}
                                <div className="space-y-3">
                                  {[...yearMovies, ...yearTV].map((l) => <YearCard key={l.id} list={l} posters={posters} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
