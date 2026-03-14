'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { List, ListEntry } from '@/types'

type ListWithPreview = List & { entries: ListEntry[] }

type GroupedByYear = {
  year: number
  movies: ListWithPreview[]
  tv: ListWithPreview[]
}

const CATEGORY_LABELS = {
  movies: 'Movies',
  tv: 'TV Shows',
} as const

export default function HomePage() {
  const [grouped, setGrouped] = useState<GroupedByYear[]>([])
  const [loading, setLoading] = useState(true)
  const [visitorName, setVisitorName] = useState('')
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
      .order('year', { ascending: false })

    if (error || !lists) {
      setLoading(false)
      return
    }

    // Fetch top 3 entries for each list
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

    const listsWithPreviews: ListWithPreview[] = lists.map((list) => ({
      ...list,
      entries: entryMap[list.id] ?? [],
    }))

    // Group by year
    const yearMap: Record<number, { movies: ListWithPreview[]; tv: ListWithPreview[] }> = {}
    for (const list of listsWithPreviews) {
      if (!yearMap[list.year]) yearMap[list.year] = { movies: [], tv: [] }
      yearMap[list.year][list.category].push(list)
    }

    const result: GroupedByYear[] = Object.entries(yearMap)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, cats]) => ({ year: Number(year), ...cats }))

    setGrouped(result)
    setLoading(false)
  }

  function handleSignOut() {
    localStorage.removeItem('visitor_id')
    localStorage.removeItem('visitor_name')
    router.push('/')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          background: 'rgba(10,10,15,0.85)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span
              className="text-xs tracking-[0.3em] uppercase font-medium"
              style={{ color: 'var(--accent)' }}
            >
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
                style={{
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                }}
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
        style={{
          background:
            'radial-gradient(ellipse 80% 100% at 50% -20%, rgba(232,197,71,0.1) 0%, transparent 70%)',
        }}
      >
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          The Lists
        </h1>
        <p style={{ color: 'var(--muted)' }}>
          My top 10s, year by year — movies and TV, ranked and annotated.
        </p>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 pb-20 space-y-16">
        {loading && (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {!loading && grouped.length === 0 && (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            No lists yet. Check back soon.
          </div>
        )}

        {grouped.map(({ year, movies, tv }) => (
          <section key={year}>
            {/* Year header */}
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {year}
              </h2>
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
                      {CATEGORY_LABELS[cat]}
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
      </main>
    </div>
  )
}

function ListCard({ list }: { list: ListWithPreview }) {
  const isMovie = list.category === 'movies'

  return (
    <Link href={`/list/${list.id}`} className="block group">
      <div
        className="rounded-xl p-5 transition-all duration-200 group-hover:translate-y-[-2px]"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 0 0 transparent',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = isMovie ? 'rgba(232,197,71,0.4)' : 'rgba(139,92,246,0.4)'
          el.style.boxShadow = isMovie
            ? '0 4px 24px rgba(232,197,71,0.06)'
            : '0 4px 24px rgba(139,92,246,0.06)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderColor = 'var(--border)'
          el.style.boxShadow = '0 0 0 0 transparent'
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-base leading-tight pr-2">
            {list.title}
          </h3>
          <span
            className="text-xs shrink-0 mt-0.5"
            style={{ color: 'var(--muted)' }}
          >
            10 picks
          </span>
        </div>

        {list.description && (
          <p
            className="text-sm mb-4 line-clamp-2"
            style={{ color: 'var(--muted)' }}
          >
            {list.description}
          </p>
        )}

        {/* Top 3 preview */}
        <ol className="space-y-1.5">
          {list.entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2.5 text-sm">
              <span
                className="text-xs font-bold w-5 shrink-0"
                style={{ color: isMovie ? 'var(--accent)' : '#a78bfa' }}
              >
                {entry.rank}
              </span>
              <span className="truncate" style={{ color: 'var(--foreground)' }}>
                {entry.title}
              </span>
            </li>
          ))}
          {list.entries.length === 0 && (
            <li className="text-xs italic" style={{ color: 'var(--muted)' }}>
              Coming soon…
            </li>
          )}
        </ol>

        <div
          className="mt-4 text-xs font-medium tracking-wide flex items-center gap-1 transition-colors"
          style={{ color: isMovie ? 'var(--accent)' : '#a78bfa' }}
        >
          See full list
          <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
        </div>
      </div>
    </Link>
  )
}
