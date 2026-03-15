'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/context/admin'
import type { List, ListEntry } from '@/types'

type ListWithPreview = List & { entries: ListEntry[] }

type GroupedByYear = {
  year: number
  movies: ListWithPreview[]
  tv: ListWithPreview[]
}

// Accent color per genre slug
const GENRE_COLORS: Record<string, string> = {
  'rom-com':  '#f472b6',
  'horror':   '#f87171',
  'action':   '#fb923c',
  'drama':    '#60a5fa',
  'scifi':    '#34d399',
  'comedy':   '#facc15',
  'animated': '#a78bfa',
}
const THEME_DEFAULT = '#f472b6'

function themeColor(genre: string | null) {
  return genre ? (GENRE_COLORS[genre] ?? THEME_DEFAULT) : THEME_DEFAULT
}

export default function HomePage() {
  const [annualGrouped, setAnnualGrouped] = useState<GroupedByYear[]>([])
  const [themeLists, setThemeLists] = useState<ListWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [visitorName, setVisitorName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [newListTitle, setNewListTitle] = useState('')
  const [newListYear, setNewListYear] = useState('')
  const [newListCategory, setNewListCategory] = useState<'movies' | 'tv'>('movies')
  const [newListType, setNewListType] = useState<'annual' | 'theme'>('annual')
  const [newListDesc, setNewListDesc] = useState('')
  const [savingList, setSavingList] = useState(false)
  const { isAdmin } = useAdmin()
  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem('visitor_name')
    if (!name) {
      router.replace('/')
      return
    }
    setVisitorName(name)
    fetchLists()
  }, [router])

  async function fetchLists() {
    const { data: lists, error } = await supabase
      .from('lists')
      .select('*')
      .order('year', { ascending: false, nullsFirst: false })

    if (error || !lists) {
      setLoading(false)
      return
    }

    const listIds = lists.map((l) => l.id)
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

    const withPreviews: ListWithPreview[] = lists.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
    }))

    const annual = withPreviews.filter((l) => l.list_type !== 'theme')
    const theme  = withPreviews.filter((l) => l.list_type === 'theme')

    // Group annual by year
    const yearMap: Record<number, { movies: ListWithPreview[]; tv: ListWithPreview[] }> = {}
    for (const list of annual) {
      const y = list.year!
      if (!yearMap[y]) yearMap[y] = { movies: [], tv: [] }
      yearMap[y][list.category].push(list)
    }
    const grouped: GroupedByYear[] = Object.entries(yearMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, cats]) => ({ year: Number(year), ...cats }))

    setAnnualGrouped(grouped)
    setThemeLists(theme)
    setLoading(false)
  }

  function handleSignOut() {
    localStorage.removeItem('visitor_id')
    localStorage.removeItem('visitor_name')
    router.push('/')
  }

  async function addList(e: React.FormEvent) {
    e.preventDefault()
    if (!newListTitle.trim()) return
    setSavingList(true)
    const body: Record<string, unknown> = {
      title: newListTitle.trim(),
      category: newListCategory,
      list_type: newListType,
      list_format: 'ranked',
      description: newListDesc.trim() || null,
    }
    if (newListType === 'annual' && newListYear) body.year = Number(newListYear)
    const res = await fetch('/api/admin/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const newList = await res.json()
      router.push(`/list/${newList.id}`)
    }
    setSavingList(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs tracking-[0.3em] uppercase font-medium" style={{ color: 'var(--accent)' }}>
              Top 10
            </span>
            <span className="ml-2 text-sm" style={{ color: 'var(--muted)' }}>
              Movies &amp; TV
            </span>
          </div>
          {visitorName && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Hey, <span style={{ color: 'var(--foreground)' }}>{visitorName}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs px-3 py-1 rounded-full transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                Leave
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <div
        className="relative py-16 px-4 text-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(232,197,71,0.1) 0%, transparent 70%)' }}
      >
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">The Lists</h1>
        <p style={{ color: 'var(--muted)' }}>
          My top 10s, year by year — movies and TV, ranked and annotated.
        </p>
      </div>

      <main className="max-w-4xl mx-auto px-4 pb-20 space-y-16">
        {loading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Theme Lists */}
        {!loading && themeLists.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                All-Time Rankings
              </h2>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {themeLists.map((list) => (
                <ListCard key={list.id} list={list} />
              ))}
            </div>
          </section>
        )}

        {/* Annual Lists */}
        {!loading && annualGrouped.length === 0 && themeLists.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            No lists yet. Check back soon.
          </div>
        )}

        {annualGrouped.map(({ year, movies, tv }) => (
          <section key={year}>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>{year}</h2>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(['movies', 'tv'] as const).map((cat) => {
                const catLists = cat === 'movies' ? movies : tv
                if (catLists.length === 0) return null
                return (
                  <div key={cat} className="space-y-3">
                    <span
                      className="text-xs tracking-[0.25em] uppercase font-semibold px-2 py-1 rounded inline-block"
                      style={{
                        background: cat === 'movies' ? 'rgba(232,197,71,0.12)' : 'rgba(139,92,246,0.12)',
                        color: cat === 'movies' ? 'var(--accent)' : '#a78bfa',
                      }}
                    >
                      {cat === 'movies' ? 'Movies' : 'TV Shows'}
                    </span>
                    {catLists.map((list) => (
                      <ListCard key={list.id} list={list} />
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {/* Add List — admin only */}
        {isAdmin && (
          <section>
            {addingList ? (
              <form
                onSubmit={addList}
                className="rounded-xl p-6 space-y-4"
                style={{ background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.3)' }}
              >
                <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--accent)' }}>
                  New List
                </p>
                <input
                  type="text"
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full px-3 py-2 rounded text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <div className="flex gap-3 flex-wrap">
                  <select
                    value={newListType}
                    onChange={(e) => setNewListType(e.target.value as 'annual' | 'theme')}
                    className="px-3 py-2 rounded text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="annual">Annual</option>
                    <option value="theme">Theme</option>
                  </select>
                  <select
                    value={newListCategory}
                    onChange={(e) => setNewListCategory(e.target.value as 'movies' | 'tv')}
                    className="px-3 py-2 rounded text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    <option value="movies">Movies</option>
                    <option value="tv">TV</option>
                  </select>
                  {newListType === 'annual' && (
                    <input
                      type="number"
                      value={newListYear}
                      onChange={(e) => setNewListYear(e.target.value)}
                      placeholder="Year"
                      className="w-24 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    />
                  )}
                </div>
                <textarea
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded text-sm resize-none outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingList || !newListTitle.trim()}
                    className="px-5 py-2 rounded text-sm font-semibold disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                  >
                    {savingList ? 'Creating…' : 'Create List'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingList(false)}
                    className="px-5 py-2 rounded text-sm"
                    style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="w-full py-4 rounded-xl text-sm font-medium transition-all"
                style={{ border: '1px dashed rgba(232,197,71,0.3)', color: 'var(--muted)' }}
              >
                + Add New List
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

function ListCard({ list }: { list: ListWithPreview }) {
  const isTheme  = list.list_type === 'theme'
  const isMovie  = list.category === 'movies'
  const accent   = isTheme
    ? themeColor(list.genre)
    : isMovie ? 'var(--accent)' : '#a78bfa'
  const hoverBg  = isTheme
    ? `rgba(244,114,182,0.06)`
    : isMovie ? 'rgba(232,197,71,0.06)' : 'rgba(139,92,246,0.06)'
  const hoverBorder = isTheme
    ? `rgba(244,114,182,0.4)`
    : isMovie ? 'rgba(232,197,71,0.4)' : 'rgba(139,92,246,0.4)'

  const isTiered = list.list_format === 'tiered'

  // For tiered preview: group entries by rank
  const tierGroups: { rank: number; tier: string; titles: string[] }[] = []
  if (isTiered) {
    const map = new Map<number, { tier: string; titles: string[] }>()
    for (const e of list.entries) {
      if (!map.has(e.rank)) map.set(e.rank, { tier: e.tier ?? `T${e.rank}`, titles: [] })
      map.get(e.rank)!.titles.push(e.title)
    }
    Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([rank, v]) => tierGroups.push({ rank, ...v }))
  }

  return (
    <Link href={`/list/${list.id}`} className="block group">
      <div
        className="rounded-xl p-5 transition-all duration-200 group-hover:translate-y-[-2px] flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 0 0 transparent',
          height: '220px',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = hoverBorder
          el.style.boxShadow = `0 4px 24px ${hoverBg}`
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border)'
          el.style.boxShadow = '0 0 0 0 transparent'
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3 shrink-0">
          <h3 className="font-semibold text-base leading-tight pr-2">{list.title}</h3>
        </div>

        {/* Preview — fixed remaining height, fades out */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {isTiered ? (
            <div className="space-y-1.5">
              {tierGroups.map(({ rank, tier, titles }) => (
                <div key={rank} className="flex items-baseline gap-2 text-sm">
                  <span
                    className="text-[10px] font-bold shrink-0 w-5"
                    style={{ color: accent }}
                  >
                    {rank === 1 ? '★' : `T${rank}`}
                  </span>
                  <span className="truncate" style={{ color: rank === 1 ? accent : 'var(--foreground)' }}>
                    {titles.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1.5">
              {list.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                  <span className="text-xs font-bold w-5 shrink-0" style={{ color: accent }}>
                    {entry.rank}
                  </span>
                  <span className="truncate" style={{ color: 'var(--foreground)' }}>{entry.title}</span>
                </li>
              ))}
              {list.entries.length === 0 && (
                <li className="text-xs italic" style={{ color: 'var(--muted)' }}>Coming soon…</li>
              )}
            </ol>
          )}

          {/* Fade out */}
          <div
            className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--surface))' }}
          />
        </div>

        {/* Footer */}
        <div
          className="mt-2 text-xs font-medium tracking-wide flex items-center gap-1 shrink-0"
          style={{ color: accent }}
        >
          See full list
          <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
        </div>
      </div>
    </Link>
  )
}
