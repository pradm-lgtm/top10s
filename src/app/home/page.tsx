'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchPoster } from '@/lib/tmdb'
import { AppHeader } from '@/components/AppHeader'
import { useAuth } from '@/context/auth'
import type { List, ListEntry } from '@/types'

type OwnerInfo = { id: string; username: string; display_name: string | null; avatar_url: string | null }
type RichList = List & { entries: ListEntry[]; profiles: OwnerInfo | null; reactionCount: number; commentCount: number; reactionEmojis: string[] }
type WeeklyPrompt = { week_number: number; prompt_text: string; suggestions: { title: string; poster_url: string | null }[] }

// ── Owner chip ─────────────────────────────────────────────────────────────

function OwnerChip({
  owner,
  onClick,
  followingIds,
  onFollowToggle,
}: {
  owner: OwnerInfo
  onClick?: (e: React.MouseEvent) => void
  followingIds?: Set<string>
  onFollowToggle?: (userId: string, e: React.MouseEvent) => void
}) {
  const initial = (owner.display_name ?? owner.username)[0].toUpperCase()
  const isFollowing = followingIds?.has(owner.id)
  return (
    <div className="flex items-center gap-1.5 w-fit group/chip">
      <Link href={`/${owner.username}`} onClick={onClick} className="flex items-center gap-1.5">
        {owner.avatar_url ? (
          <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" loading="lazy" />
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
      {onFollowToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onFollowToggle(owner.id, e) }}
          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold opacity-0 group-hover/chip:opacity-100 sm:opacity-0 sm:group-hover/chip:opacity-100 transition-opacity"
          style={{
            background: isFollowing ? 'var(--surface-2)' : 'rgba(232,197,71,0.15)',
            color: isFollowing ? 'var(--muted)' : 'var(--accent)',
            border: `1px solid ${isFollowing ? 'var(--border)' : 'rgba(232,197,71,0.3)'}`,
          }}
          title={isFollowing ? 'Unfollow' : 'Follow'}
        >
          {isFollowing ? '✓' : '+'}
        </button>
      )}
    </div>
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
            loading="lazy"
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

function AllTimeCard({ list, posters, followingIds, onFollowToggle }: { list: RichList; posters: Record<string, string | null>; followingIds?: Set<string>; onFollowToggle?: (userId: string, e: React.MouseEvent) => void }) {
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
      {list.profiles && <OwnerChip owner={list.profiles} onClick={(e) => e.stopPropagation()} followingIds={followingIds} onFollowToggle={onFollowToggle} />}

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

      <StatsRow reactionCount={list.reactionCount} commentCount={list.commentCount} reactionEmojis={list.reactionEmojis} />
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

function YearCard({ list, posters, followingIds, onFollowToggle }: { list: RichList; posters: Record<string, string | null>; followingIds?: Set<string>; onFollowToggle?: (userId: string, e: React.MouseEvent) => void }) {
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
      {list.profiles && <OwnerChip owner={list.profiles} onClick={(e) => e.stopPropagation()} followingIds={followingIds} onFollowToggle={onFollowToggle} />}
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

      <StatsRow reactionCount={list.reactionCount} commentCount={list.commentCount} reactionEmojis={list.reactionEmojis} />
    </div>
  )
}

// ── Featured card ───────────────────────────────────────────────────────────

function FeaturedCard({ list, posters }: { list: RichList; posters: Record<string, string | null> }) {
  const router = useRouter()
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'

  return (
    <div
      className="cursor-pointer rounded-xl p-4 flex flex-col gap-3 h-full transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)', boxShadow: '0 0 24px rgba(232,197,71,0.04)' }}
      onClick={() => router.push(`/list/${list.id}`)}
    >
      {/* Source badge instead of owner chip */}
      <div className="flex items-center gap-2">
        <div
          className="text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded"
          style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}
        >
          {list.source_label ?? 'Featured'}
        </div>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
          {isMovie ? '🎬 Movies' : '📺 TV Shows'}
        </span>
      </div>

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

      <StatsRow reactionCount={list.reactionCount} commentCount={list.commentCount} reactionEmojis={list.reactionEmojis} />
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

function StatsRow({ reactionCount, commentCount, reactionEmojis = ['🔥'] }: { reactionCount: number; commentCount: number; reactionEmojis?: string[] }) {
  if (reactionCount === 0 && commentCount === 0) return null
  return (
    <div className="flex items-center gap-3 mt-auto pt-2">
      {reactionCount > 0 && (
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span style={{ fontSize: 13 }}>{reactionEmojis.join('')}</span>{reactionCount}
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
  followingIds,
  onFollowToggle,
}: {
  leftList: T[]
  rightList: T[]
  posters: Record<string, string | null>
  Card: React.ComponentType<{ list: T; posters: Record<string, string | null>; followingIds?: Set<string>; onFollowToggle?: (userId: string, e: React.MouseEvent) => void }>
  followingIds?: Set<string>
  onFollowToggle?: (userId: string, e: React.MouseEvent) => void
}) {
  const rowCount = Math.max(leftList.length, rightList.length)
  return (
    <div className="space-y-4">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="flex flex-col">
            {leftList[i] && <Card list={leftList[i]} posters={posters} followingIds={followingIds} onFollowToggle={onFollowToggle} />}
          </div>
          <div className="flex flex-col">
            {rightList[i] && <Card list={rightList[i]} posters={posters} followingIds={followingIds} onFollowToggle={onFollowToggle} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, profile, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [lists, setLists] = useState<RichList[]>([])
  const [posters, setPosters] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const [byYearOpen, setByYearOpen] = useState(false)
  const didInitExpand = useRef(false)

  // Following feed
  const [feedFilter, setFeedFilter] = useState<'everyone' | 'following'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('home_feed_filter') as 'everyone' | 'following') ?? 'everyone'
    }
    return 'everyone'
  })
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  // Weekly prompt
  const [weeklyPrompt, setWeeklyPrompt] = useState<WeeklyPrompt | null>(null)
  const [promptDismissed, setPromptDismissed] = useState(false)

  useEffect(() => { fetchLists() }, [])

  // Show prompt to everyone — visitors included
  useEffect(() => {
    const weekKey = `prompt_dismissed_${Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}`
    setPromptDismissed(localStorage.getItem(weekKey) === '1')
    fetchWeeklyPrompt()
  }, [])

  useEffect(() => {
    if (!user || !profile) return
    fetchFollowingIds()
    // Re-fetch with alternate-prompt check now that we have a profile
    fetchWeeklyPrompt()
    // Redirect if user just signed in with a pending prompt selection
    const pending = localStorage.getItem('pending_prompt')
    if (pending) {
      localStorage.removeItem('pending_prompt')
      try {
        const data = JSON.parse(pending)
        sessionStorage.setItem('weekly_prompt_data', JSON.stringify(data))
        router.push(`/create?promptWeek=${data.week_number}`)
      } catch {}
    }
  }, [user, profile])

  async function fetchFollowingIds() {
    if (!profile) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetch(`/api/follow/list?userId=${profile.id}&type=following`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: { id: string }[] = await res.json()
        setFollowingIds(new Set(data.map((p) => p.id)))
      }
    } catch {}
  }

  async function fetchWeeklyPrompt() {
    try {
      const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
      let week = weekNumber
      // If logged in, skip to next week's prompt if they already made one this week
      if (profile) {
        const { data: existing } = await supabase
          .from('lists')
          .select('id')
          .eq('owner_id', profile.id)
          .eq('prompt_week', weekNumber)
          .limit(1)
          .maybeSingle()
        if (existing) week = weekNumber + 1
      }
      const res = await fetch(`/api/weekly-prompt?week=${week}`)
      if (res.ok) setWeeklyPrompt(await res.json())
    } catch {}
  }

  async function handleFollowToggle(userId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!user || !profile) {
      signInWithGoogle()
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    if (followingIds.has(userId)) {
      setFollowingIds((prev) => { const next = new Set(prev); next.delete(userId); return next })
      await fetch('/api/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ following_id: userId }),
      })
    } else {
      setFollowingIds((prev) => new Set([...prev, userId]))
      await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ following_id: userId }),
      })
    }
  }

  function dismissPrompt() {
    const weekKey = `prompt_dismissed_${Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))}`
    localStorage.setItem(weekKey, '1')
    setPromptDismissed(true)
  }

  function saveFeedFilter(f: 'everyone' | 'following') {
    setFeedFilter(f)
    localStorage.setItem('home_feed_filter', f)
  }

  async function fetchLists() {
    try {
    const { data: raw, error } = await supabase
      .from('lists')
      .select('*, profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false })

    if (error || !raw) { setLoading(false); return }

    const listIds = raw.map((l) => l.id)

    // Fetch top-3 entries + list-level engagement only (no entry-level IN queries)
    const [{ data: topEntries }, { data: listReactions }, { data: listComments }] = await Promise.all([
      supabase.from('list_entries').select('id, list_id, title, rank, image_url').in('list_id', listIds).not('rank', 'is', null).lte('rank', 3).order('rank', { ascending: true }),
      supabase.from('reactions').select('list_id, emoji').in('list_id', listIds),
      supabase.from('comments').select('list_id').in('list_id', listIds),
    ])

    const entryMap: Record<string, ListEntry[]> = {}
    for (const e of topEntries ?? []) {
      if (!entryMap[e.list_id]) entryMap[e.list_id] = []
      if (entryMap[e.list_id].length < 3) entryMap[e.list_id].push(e as ListEntry)
    }

    const reactionMap: Record<string, number> = {}
    const emojiTally: Record<string, Record<string, number>> = {}
    for (const r of listReactions ?? []) {
      reactionMap[r.list_id] = (reactionMap[r.list_id] ?? 0) + 1
      if (!emojiTally[r.list_id]) emojiTally[r.list_id] = {}
      emojiTally[r.list_id][r.emoji] = (emojiTally[r.list_id][r.emoji] ?? 0) + 1
    }
    const reactionEmojisMap: Record<string, string[]> = {}
    for (const [lid, counts] of Object.entries(emojiTally)) {
      reactionEmojisMap[lid] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emoji]) => emoji)
    }

    const commentMap: Record<string, number> = {}
    for (const c of listComments ?? []) commentMap[c.list_id] = (commentMap[c.list_id] ?? 0) + 1

    const richLists: RichList[] = raw.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
      profiles: list.profiles ?? null,
      reactionCount: reactionMap[list.id] ?? 0,
      commentCount: commentMap[list.id] ?? 0,
      reactionEmojis: reactionEmojisMap[list.id] ?? ['🔥'],
    }))

    // Sort by engagement score (reactions + comments weighted), recency as tiebreak
    const engagementScore = (l: RichList) => l.reactionCount * 2 + l.commentCount * 3
    richLists.sort((a, b) => {
      const scoreDiff = engagementScore(b) - engagementScore(a)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Auto-expand most recent year
    if (!didInitExpand.current) {
      didInitExpand.current = true
      const years = richLists.map((l) => l.year).filter((y): y is number => y !== null)
      if (years.length > 0) setExpandedYears(new Set([Math.max(...years)]))
    }

    setLists(richLists)
    setLoading(false)

    // Fetch TMDB posters in a macrotask so the page renders before any requests fire
    const needPosters = richLists.flatMap((l) =>
      l.entries.filter((e) => !e.image_url).map((e) => ({
        id: e.id,
        title: e.title,
        category: l.category as 'movies' | 'tv',
        year: l.year,
      }))
    )
    if (needPosters.length > 0) {
      setTimeout(async () => {
        const results = await Promise.all(
          needPosters.map(async ({ id, title, category, year }) => ({
            id,
            url: (await fetchPoster(title, category, year)).poster,
          }))
        )
        const map: Record<string, string | null> = {}
        for (const { id, url } of results) map[id] = url
        setPosters(map)
      }, 0)
    }
    } catch (err) {
      console.error('fetchLists error:', err)
      setFetchError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  function toggleYear(y: number) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return next
    })
  }

  const featuredLists = lists.filter((l) => l.featured)
  const allLists      = lists.filter((l) => !l.featured)

  // Following feed filter
  const nonFeatured = feedFilter === 'following' && user
    ? allLists.filter((l) => l.owner_id && followingIds.has(l.owner_id))
    : allLists

  const allTimeLists  = nonFeatured.filter((l) => l.year === null)
  const allTimeMovies = allTimeLists.filter((l) => l.category === 'movies')
  const allTimeTV     = allTimeLists.filter((l) => l.category === 'tv')

  const recentLists = [...nonFeatured].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

  const annualLists = nonFeatured.filter((l) => l.year !== null)
  const years = [...new Set(annualLists.map((l) => l.year as number))].sort((a, b) => b - a)

  // Active user suggestions for Following empty state
  const activeProfiles = [...new Map(
    allLists.filter((l) => l.profiles && l.owner_id && !followingIds.has(l.owner_id) && l.owner_id !== profile?.id)
      .map((l) => [l.owner_id!, l.profiles!])
  ).values()].slice(0, 4)

  const showWeeklyPrompt = !!weeklyPrompt && !promptDismissed

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-24">

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}

        {fetchError && (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Failed to load lists. Please refresh.</p>
          </div>
        )}

        {!loading && !fetchError && lists.length === 0 && (
          <div className="text-center py-20">
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>No lists yet.</p>
            {user && (
              <Link href="/create" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                Create the first one →
              </Link>
            )}
          </div>
        )}

        {!loading && !fetchError && lists.length > 0 && (
          <div className="space-y-16">

            {/* ── Weekly Prompt Card ── */}
            {showWeeklyPrompt && weeklyPrompt && (
              <WeeklyPromptCard
                prompt={weeklyPrompt}
                onDismiss={dismissPrompt}
                user={user}
                onSignIn={signInWithGoogle}
              />
            )}

            {/* ── Feed filter tabs (logged-in users only) ── */}
            {user && (
              <div className="flex gap-1 -mt-8 mb-2">
                {(['everyone', 'following'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => saveFeedFilter(f)}
                    className="px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize"
                    style={
                      feedFilter === f
                        ? { background: 'var(--accent)', color: '#0a0a0f' }
                        : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }
                    }
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {/* ── Following empty state ── */}
            {feedFilter === 'following' && user && nonFeatured.length === 0 && (
              <section>
                <div className="py-10 text-center">
                  <p className="text-base font-semibold mb-2">Follow people to see their lists here</p>
                  <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Here are some people with great taste:</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {activeProfiles.map((p) => (
                      <Link
                        key={p.username}
                        href={`/${p.username}`}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                      >
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full" loading="lazy" />
                        ) : (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>
                            {(p.display_name ?? p.username)[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium">{p.display_name ?? p.username}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}

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
                        <CategoryLabel category="tv" />
                        <div className="space-y-4">
                          {allTimeTV.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
                        </div>
                      </div>
                      <div>
                        <CategoryLabel category="movies" />
                        <div className="space-y-4">
                          {allTimeMovies.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
                        </div>
                      </div>
                    </div>
                    {/* Desktop: side-by-side paired rows */}
                    <div className="hidden sm:block">
                      <div className="grid grid-cols-2 gap-8 mb-1">
                        <CategoryLabel category="tv" />
                        <CategoryLabel category="movies" />
                      </div>
                      <PairedCardGrid
                        leftList={allTimeTV}
                        rightList={allTimeMovies}
                        posters={posters}
                        Card={AllTimeCard}
                        followingIds={followingIds}
                        onFollowToggle={handleFollowToggle}
                      />
                    </div>
                  </div>
                ) : (
                  /* Single category */
                  <div className="max-w-xl">
                    {allTimeLists.length > 0 && <CategoryLabel category={allTimeLists[0].category} />}
                    <div className="space-y-4">
                      {allTimeLists.map((l) => <AllTimeCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
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

            {/* ── Section 3: Editorial Lists ── */}
            {featuredLists.length > 0 && (
              <section>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold tracking-[0.25em] uppercase px-2 py-0.5 rounded" style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}>Editorial</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">Editorial Lists</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>IMDB, Obama, AFI — compare your taste.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {featuredLists.map((l) => <FeaturedCard key={l.id} list={l} posters={posters} />)}
                </div>
              </section>
            )}

            {/* ── Section 4: By Year (collapsed by default) ── */}
            {years.length > 0 && (
              <section>
                <button
                  onClick={() => setByYearOpen((o) => !o)}
                  className="w-full flex items-center justify-between mb-6 text-left group"
                >
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">By Year</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Year-by-year, side by side.</p>
                  </div>
                  <span
                    className="text-sm transition-transform duration-200 ml-4 shrink-0"
                    style={{ color: 'var(--muted)', display: 'inline-block', transform: byYearOpen ? 'rotate(180deg)' : 'none' }}
                  >▼</span>
                </button>

                {byYearOpen && (
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
                                    <CategoryLabel category="tv" />
                                    <div className="space-y-3">
                                      {yearTV.map((l) => <YearCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
                                    </div>
                                  </div>
                                  <div>
                                    <CategoryLabel category="movies" />
                                    <div className="space-y-3">
                                      {yearMovies.map((l) => <YearCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
                                    </div>
                                  </div>
                                </div>
                                {/* Desktop: side-by-side paired rows */}
                                <div className="hidden sm:block">
                                  <div className="grid grid-cols-2 gap-6 mb-1">
                                    <CategoryLabel category="tv" />
                                    <CategoryLabel category="movies" />
                                  </div>
                                  <PairedCardGrid
                                    leftList={yearTV}
                                    rightList={yearMovies}
                                    posters={posters}
                                    Card={YearCard}
                                    followingIds={followingIds}
                                    onFollowToggle={handleFollowToggle}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="max-w-sm">
                                {yearMovies.length > 0 && <CategoryLabel category="movies" />}
                                {yearTV.length > 0 && <CategoryLabel category="tv" />}
                                <div className="space-y-3">
                                  {[...yearMovies, ...yearTV].map((l) => <YearCard key={l.id} list={l} posters={posters} followingIds={followingIds} onFollowToggle={handleFollowToggle} />)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>

      <div className="text-center py-8">
        <a href="/privacy" className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Privacy Policy</a>
      </div>
    </div>
  )
}

// ── Weekly Prompt Card ─────────────────────────────────────────────────────

function WeeklyPromptCard({
  prompt,
  onDismiss,
  user,
  onSignIn,
}: {
  prompt: WeeklyPrompt
  onDismiss: () => void
  user: ReturnType<typeof useAuth>['user']
  onSignIn: () => void
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const hasSuggestions = prompt.suggestions.length > 0

  function toggleSuggestion(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function startList() {
    const selectedSuggestions = prompt.suggestions.filter((_, i) => selected.has(i))
    const payload = { ...prompt, suggestions: selectedSuggestions }
    if (!user) {
      // Persist selections to localStorage so they survive the OAuth redirect
      localStorage.setItem('pending_prompt', JSON.stringify(payload))
      onSignIn()
      return
    }
    sessionStorage.setItem('weekly_prompt_data', JSON.stringify(payload))
    router.push(`/create?promptWeek=${prompt.week_number}`)
  }

  return (
    <div
      className="relative rounded-2xl p-5 sm:p-6 overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.3)', boxShadow: '0 0 40px rgba(232,197,71,0.06)' }}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-60 text-xs"
        style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
        aria-label="Dismiss"
      >
        ×
      </button>

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded"
          style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}
        >
          This Week
        </span>
      </div>

      {/* Prompt text */}
      <p className="text-xl sm:text-2xl font-bold leading-tight mb-2" style={{ maxWidth: 520 }}>
        {prompt.prompt_text}
      </p>

      {/* Poster thumbnails */}
      {hasSuggestions && (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Tap any to add to your list
          </p>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {prompt.suggestions.map((s, i) => {
              const isSelected = selected.has(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleSuggestion(i)}
                  className="shrink-0 relative rounded-lg overflow-hidden transition-all duration-150"
                  style={{
                    width: 56,
                    height: 84,
                    outline: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                    outlineOffset: 2,
                  }}
                  title={s.title}
                >
                  {s.poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.poster_url}
                      alt={s.title}
                      className="w-full h-full object-cover"
                      style={{ opacity: isSelected ? 1 : 0.5, filter: isSelected ? 'none' : 'blur(0.5px)', transition: 'opacity 0.15s, filter 0.15s' }}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-[9px] text-center px-1"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    >
                      {s.title}
                    </div>
                  )}
                  {/* Checkmark overlay */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 flex items-end justify-end p-1"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                      >
                        ✓
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* CTA */}
      <button
        onClick={startList}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
        style={{ background: 'var(--accent)', color: '#0a0a0f' }}
      >
        Start your list →
      </button>
    </div>
  )
}
