'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import { fetchPosters } from '@/lib/tmdb'
import type { List, ListEntry } from '@/types'

type ListWithOwner = List & {
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

// ── Title normalisation for matching ────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the |a |an )/i, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
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
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
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
  accentColor,
}: {
  entry: ListEntry
  matched: boolean
  poster: string | null
  accentColor: string
}) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg"
      style={{
        background: matched ? `${accentColor}10` : 'transparent',
        border: `1px solid ${matched ? `${accentColor}40` : 'transparent'}`,
        opacity: matched ? 1 : 0.45,
      }}
    >
      {/* Rank */}
      {entry.rank != null && (
        <span
          className="text-xs tabular-nums shrink-0 w-5 text-right"
          style={{
            color: entry.rank <= 3 ? accentColor : 'var(--muted)',
            fontWeight: entry.rank <= 3 ? 700 : 500,
          }}
        >
          {entry.rank}
        </span>
      )}

      {/* Poster */}
      <div
        className="shrink-0 rounded overflow-hidden"
        style={{ width: 32, height: 48, background: 'var(--surface-2)' }}
      >
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Title */}
      <span
        className="text-sm leading-snug min-w-0 flex-1"
        style={{ color: matched ? 'var(--foreground)' : 'var(--muted)' }}
      >
        {entry.title}
      </span>

      {/* Match indicator */}
      {matched && (
        <span className="text-xs shrink-0" style={{ color: accentColor }}>✓</span>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { listId1, listId2 } = useParams<{ listId1: string; listId2: string }>()
  const router = useRouter()

  const [list1, setList1] = useState<ListWithOwner | null>(null)
  const [list2, setList2] = useState<ListWithOwner | null>(null)
  const [entries1, setEntries1] = useState<ListEntry[]>([])
  const [entries2, setEntries2] = useState<ListEntry[]>([])
  const [posters1, setPosters1] = useState<Record<string, string | null>>({})
  const [posters2, setPosters2] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<1 | 2>(1)

  useEffect(() => {
    async function load() {
      const [r1, r2] = await Promise.all([
        supabase
          .from('lists')
          .select('id, title, year, category, list_type, list_format, genre, description, owner_id, featured, source_label, source_url, created_at, profiles(username, display_name, avatar_url)')
          .eq('id', listId1)
          .single(),
        supabase
          .from('lists')
          .select('id, title, year, category, list_type, list_format, genre, description, owner_id, featured, source_label, source_url, created_at, profiles(username, display_name, avatar_url)')
          .eq('id', listId2)
          .single(),
      ])

      if (!r1.data || !r2.data) { setLoading(false); return }

      setList1(r1.data as unknown as ListWithOwner)
      setList2(r2.data as unknown as ListWithOwner)

      const [e1, e2] = await Promise.all([
        supabase.from('list_entries').select('id, list_id, rank, tier_id, tier, title, notes, image_url, created_at').eq('list_id', listId1).order('rank', { ascending: true }),
        supabase.from('list_entries').select('id, list_id, rank, tier_id, tier, title, notes, image_url, created_at').eq('list_id', listId2).order('rank', { ascending: true }),
      ])

      const ee1 = (e1.data ?? []) as ListEntry[]
      const ee2 = (e2.data ?? []) as ListEntry[]
      setEntries1(ee1)
      setEntries2(ee2)

      // Fetch posters in background
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
    }
    load()
  }, [listId1, listId2])

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--background)' }}>
        <AppHeader />
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
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

  // Compute matches
  const norm1 = new Map(entries1.map(e => [normalizeTitle(e.title), e.id]))
  const norm2 = new Map(entries2.map(e => [normalizeTitle(e.title), e.id]))
  const matchedTitles = new Set([...norm1.keys()].filter(t => norm2.has(t)))
  const matchCount = matchedTitles.size
  const totalUnique = new Set([...norm1.keys(), ...norm2.keys()]).size

  const isMatched1 = (entry: ListEntry) => matchedTitles.has(normalizeTitle(entry.title))
  const isMatched2 = (entry: ListEntry) => matchedTitles.has(normalizeTitle(entry.title))

  const accentColor = 'var(--accent)'
  const owner1Label = list1.profiles?.display_name ?? list1.profiles?.username ?? 'List 1'
  const owner2Label = list2.profiles?.display_name ?? list2.profiles?.username ?? 'List 2'

  // Share URL
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${siteUrl}/compare/${listId1}/${listId2}`

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href={`/list/${listId1}`}
          className="inline-flex items-center gap-1.5 text-sm mb-6"
          style={{ color: 'var(--muted)' }}
        >
          ← Back to list
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">{list1.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: 'var(--muted)' }}>
            <span>vs.</span>
            <span style={{ color: 'var(--foreground)' }}>{list2.title}</span>
          </div>
        </div>

        {/* Overlap score */}
        <div
          className="rounded-xl p-5 mb-8 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-4xl font-bold mb-1" style={{ color: 'var(--accent)' }}>
            {matchCount}/{totalUnique}
          </div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>
            {matchCount === 0
              ? 'No titles in common'
              : matchCount === 1
                ? '1 title in common'
                : `${matchCount} titles in common`}
          </div>
          {matchCount > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {entries1.filter(isMatched1).map(e => (
                <span
                  key={e.id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent)', color: '#0a0a0f', fontWeight: 600 }}
                >
                  {e.title}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => { if (navigator.share) { navigator.share({ url: shareUrl, title: `${owner1Label} vs ${owner2Label}` }) } else { navigator.clipboard.writeText(shareUrl) } }}
            className="mt-4 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Share comparison
          </button>
        </div>

        {/* Mobile tab toggle */}
        <div className="flex lg:hidden mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {([1, 2] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2 text-sm font-medium transition-colors"
              style={{
                background: activeTab === tab ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === tab ? '#0a0a0f' : 'var(--muted)',
              }}
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
              <OwnerChip list={list1} />
              <Link href={`/list/${listId1}`} className="text-xs" style={{ color: 'var(--muted)' }}>
                View list →
              </Link>
            </div>
            <div className="space-y-1">
              {entries1.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  matched={isMatched1(entry)}
                  poster={entry.image_url ?? posters1[entry.id] ?? null}
                  accentColor="var(--accent)"
                />
              ))}
            </div>
          </div>

          {/* List 2 */}
          <div className={activeTab !== 2 ? 'hidden lg:block' : ''}>
            <div className="flex items-center justify-between mb-3">
              <OwnerChip list={list2} />
              <Link href={`/list/${listId2}`} className="text-xs" style={{ color: 'var(--muted)' }}>
                View list →
              </Link>
            </div>
            <div className="space-y-1">
              {entries2.map(entry => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  matched={isMatched2(entry)}
                  poster={entry.image_url ?? posters2[entry.id] ?? null}
                  accentColor="var(--accent)"
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
