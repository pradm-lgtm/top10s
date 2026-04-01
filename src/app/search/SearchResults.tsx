'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'

type TopicResult = {
  id: string | null
  slug: string
  title: string
  listCount: number
  posters: string[]
  isImplicit: boolean
}

type ListResult = {
  id: string
  title: string
  category: string
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

type ProfileResult = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

type FilterType = 'all' | 'topics' | 'lists' | 'people'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'topics', label: 'Topics' },
  { id: 'lists', label: 'Lists' },
  { id: 'people', label: 'People' },
]

function CategoryIcon({ category }: { category: string }) {
  if (category === 'movies') {
    return (
      <svg width="16" height="15" viewBox="0 0 14 13" fill="none" style={{ color: 'var(--accent)' }}>
        <rect x="1" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 2l1 3.5M7.5 2l1 3.5M11 2l1 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="15" viewBox="0 0 14 13" fill="none" style={{ color: '#a78bfa' }}>
      <rect x="1" y="1" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 9.5v2M9 9.5v2M3.5 11.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialQ = searchParams.get('q') ?? ''
  const initialType = (searchParams.get('type') ?? 'all') as FilterType

  const [query, setQuery] = useState(initialQ)
  const [activeType, setActiveType] = useState<FilterType>(initialType)
  const [topics, setTopics] = useState<TopicResult[]>([])
  const [lists, setLists] = useState<ListResult[]>([])
  const [profiles, setProfiles] = useState<ProfileResult[]>([])
  const [loading, setLoading] = useState(false)
  const isFirstRender = useRef(true)

  async function search(q: string) {
    if (!q.trim()) {
      setTopics([])
      setLists([])
      setProfiles([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&full=true`)
      const data = await res.json()
      setTopics(data.topics ?? [])
      setLists(data.lists ?? [])
      setProfiles(data.profiles ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = query.trim()

    if (isFirstRender.current) {
      isFirstRender.current = false
      if (q) search(q)
      return
    }

    const timer = setTimeout(() => {
      search(q)
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (activeType !== 'all') params.set('type', activeType)
      router.replace(params.toString() ? `/search?${params.toString()}` : '/search', { scroll: false })
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeType])

  function handleTypeChange(type: FilterType) {
    setActiveType(type)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (type !== 'all') params.set('type', type)
    router.replace(params.toString() ? `/search?${params.toString()}` : '/search', { scroll: false })
  }

  const showTopics = activeType === 'all' || activeType === 'topics'
  const showLists = activeType === 'all' || activeType === 'lists'
  const showPeople = activeType === 'all' || activeType === 'people'

  const hasResults = topics.length > 0 || lists.length > 0 || profiles.length > 0
  const showEmpty = query.trim() && !loading && !hasResults

  return (
    <div className="min-h-screen pb-24 sm:pb-8" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12.5 12.5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, lists, people…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--foreground)' }}
          />
          {loading && (
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
            />
          )}
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="text-xs transition-opacity hover:opacity-70 shrink-0"
              style={{ color: 'var(--muted)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleTypeChange(f.id)}
              className="shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={
                activeType === f.id
                  ? { background: 'var(--accent)', color: '#0a0a0f' }
                  : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!query.trim() && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Search topics, lists and people
            </p>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
            <Link
              href={`/create?title=${encodeURIComponent(query.trim())}`}
              className="text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              Create a list about this →
            </Link>
          </div>
        )}

        {/* Topics */}
        {showTopics && topics.length > 0 && (
          <section className="mb-8">
            <p className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: 'var(--muted)' }}>
              {topics[0].isImplicit ? 'Related' : 'Topics'}
            </p>
            <div className="space-y-3">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={
                    topic.isImplicit
                      ? `/search?q=${encodeURIComponent(query.trim())}&type=lists`
                      : `/topic/${topic.slug}`
                  }
                  className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:bg-white/5"
                  style={{ background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.2)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[10px] font-bold tracking-widest uppercase mb-1"
                      style={{ color: 'var(--accent)' }}
                    >
                      {topic.isImplicit ? 'See all' : 'Topic'}
                    </p>
                    <p className="text-lg font-bold truncate">{topic.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                      {topic.listCount} {topic.listCount === 1 ? 'list' : 'lists'} →
                    </p>
                  </div>
                  {topic.posters.length > 0 && (
                    <div className="flex gap-1.5 shrink-0">
                      {topic.posters.map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="rounded-md object-cover"
                          style={{ width: 40, height: 60 }}
                        />
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* People */}
        {showPeople && profiles.length > 0 && (
          <section className="mb-8">
            <p className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: 'var(--muted)' }}>
              People
            </p>
            <div className="space-y-1">
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/${p.username}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-white/5"
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                    >
                      {(p.display_name ?? p.username)[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.display_name ?? p.username}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      @{p.username}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Lists */}
        {showLists && lists.length > 0 && (
          <section className="mb-8">
            <p className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: 'var(--muted)' }}>
              Lists
            </p>
            <div className="space-y-1">
              {lists.map((l) => (
                <Link
                  key={l.id}
                  href={`/list/${l.id}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-white/5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <CategoryIcon category={l.category} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{l.title}</p>
                    {l.profiles && (
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                        @{l.profiles.username}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
