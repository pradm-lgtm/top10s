'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import type { List, ListEntry } from '@/types'

type OwnerInfo = { username: string; display_name: string | null; avatar_url: string | null }
type ListWithPreview = List & { entries: ListEntry[]; profiles: OwnerInfo | null }

const GENRE_COLORS: Record<string, string> = {
  'rom-com':  '#f472b6',
  'horror':   '#f87171',
  'action':   '#fb923c',
  'drama':    '#60a5fa',
  'scifi':    '#34d399',
  'comedy':   '#facc15',
  'animated': '#a78bfa',
}

function themeColor(genre: string | null) {
  return genre ? (GENRE_COLORS[genre] ?? '#f472b6') : '#f472b6'
}

export default function HomePage() {
  const [lists, setLists] = useState<ListWithPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLists()
  }, [])

  async function fetchLists() {
    let raw: (List & { profiles?: OwnerInfo | null })[] | null = null

    const { data: withJoin, error: joinError } = await supabase
      .from('lists')
      .select('*, profiles(username, display_name, avatar_url)')
      .order('created_at', { ascending: false })

    if (!joinError) {
      raw = withJoin
    } else {
      const { data: plain } = await supabase
        .from('lists')
        .select('*')
        .order('created_at', { ascending: false })
      raw = plain
    }

    if (!raw) { setLoading(false); return }

    const listIds = raw.map((l) => l.id)
    const { data: entries } = await supabase
      .from('list_entries')
      .select('*')
      .in('list_id', listIds)
      .lte('rank', 3)
      .order('rank', { ascending: true })

    const entryMap: Record<string, ListEntry[]> = {}
    for (const entry of entries ?? []) {
      if (!entryMap[entry.list_id]) entryMap[entry.list_id] = []
      entryMap[entry.list_id].push(entry)
    }

    setLists(raw.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
      profiles: list.profiles ?? null,
    })))
    setLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 pt-10 pb-20">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">All Lists</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The best in film &amp; TV, ranked by people who care too much.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {!loading && lists.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            No lists yet. Check back soon.
          </div>
        )}

        {!loading && lists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ListCard({ list }: { list: ListWithPreview }) {
  const isTheme  = list.list_type === 'theme'
  const isMovie  = list.category === 'movies'
  const accent   = isTheme ? themeColor(list.genre) : isMovie ? 'var(--accent)' : '#a78bfa'
  const hoverBg  = isTheme ? `rgba(244,114,182,0.06)` : isMovie ? 'rgba(232,197,71,0.06)' : 'rgba(139,92,246,0.06)'
  const hoverBorder = isTheme ? `rgba(244,114,182,0.4)` : isMovie ? `rgba(232,197,71,0.4)` : `rgba(139,92,246,0.4)`

  const isTiered = list.list_format === 'tiered'
  const isTierRanked = list.list_format === 'tier-ranked'

  const tierGroups: { rank: number; titles: string[] }[] = []
  if (isTiered) {
    const map = new Map<number, string[]>()
    for (const e of list.entries) {
      if (!map.has(e.rank)) map.set(e.rank, [])
      map.get(e.rank)!.push(e.title)
    }
    Array.from(map.entries()).sort(([a], [b]) => a - b).forEach(([rank, titles]) => tierGroups.push({ rank, titles }))
  }

  const owner = list.profiles
  const ownerInitial = (owner?.display_name ?? owner?.username ?? '?')[0].toUpperCase()

  return (
    <Link href={`/list/${list.id}`} className="block group">
      <div
        className="rounded-xl p-5 transition-all duration-200 group-hover:translate-y-[-2px] flex flex-col"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: '240px' }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = hoverBorder
          el.style.boxShadow = `0 4px 24px ${hoverBg}`
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border)'
          el.style.boxShadow = ''
        }}
      >
        {/* Owner */}
        {owner && (
          <Link
            href={`/${owner.username}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 mb-3 shrink-0 w-fit"
          >
            {owner.avatar_url ? (
              <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: 'var(--accent)', color: '#0a0a0f' }}
              >
                {ownerInitial}
              </div>
            )}
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {owner.display_name ?? owner.username}
            </span>
          </Link>
        )}

        {/* Title */}
        <h3 className="font-semibold text-base leading-tight mb-3 shrink-0">{list.title}</h3>

        {/* Preview */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {isTierRanked ? (
            <ol className="space-y-1.5">
              {list.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-bold w-5 shrink-0" style={{ color: accent }}>{entry.rank}</span>
                  <span className="truncate">{entry.title}</span>
                </li>
              ))}
            </ol>
          ) : isTiered ? (
            <div className="space-y-1.5">
              {tierGroups.map(({ rank, titles }) => (
                <div key={rank} className="flex items-baseline gap-2 text-sm">
                  <span className="text-[10px] font-bold shrink-0 w-5" style={{ color: accent }}>{`T${rank}`}</span>
                  <span className="truncate">{titles.join(', ')}</span>
                </div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1.5">
              {list.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-bold w-5 shrink-0" style={{ color: accent }}>{entry.rank}</span>
                  <span className="truncate">{entry.title}</span>
                </li>
              ))}
              {list.entries.length === 0 && (
                <li className="text-xs italic" style={{ color: 'var(--muted)' }}>Coming soon…</li>
              )}
            </ol>
          )}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--surface))' }}
          />
        </div>

        {/* Footer */}
        <div className="mt-2 text-xs font-medium tracking-wide flex items-center gap-1 shrink-0" style={{ color: accent }}>
          See full list
          <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
        </div>
      </div>
    </Link>
  )
}
