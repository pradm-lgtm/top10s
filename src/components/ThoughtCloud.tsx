'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloudResult = {
  id: number
  title?: string
  name?: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_SM   = 'https://image.tmdb.org/t/p/w185'

function cloudTitle(r: CloudResult) { return r.title ?? r.name ?? '' }

function dedupeById(items: CloudResult[]): CloudResult[] {
  const seen = new Set<number>()
  return items.filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
}

// TMDB genre IDs
const MOVIE_GENRE_IDS: Record<string, number> = {
  'Action': 28, 'Comedy': 35, 'Drama': 18, 'Horror': 27,
  'Sci-Fi': 878, 'Romance': 10749, 'Thriller': 53, 'Animation': 16,
}
const TV_GENRE_IDS: Record<string, number> = {
  'Drama': 18, 'Comedy': 35, 'Reality': 10764, 'Crime': 80,
  'Sci-Fi': 10765, 'Animation': 16, 'Documentary': 99,
}

// Genres to exclude when filtering by a primary genre (TMDB tags are messy)
const GENRE_EXCLUSIONS: Record<number, number[]> = {
  35:    [28, 53, 80, 27],       // Comedy → exclude Action, Thriller, Crime, Horror
  27:    [35, 16],               // Horror → exclude Comedy, Animation
  16:    [27, 53],               // Animation → exclude Horror, Thriller
  10749: [28, 53, 80, 27],      // Romance → exclude Action, Thriller, Crime, Horror
  878:   [35],                   // Sci-Fi → exclude Comedy
}

// Detect genre from list title or context text
const TITLE_GENRE_KEYWORDS: [RegExp, string][] = [
  [/\baction\b/i, 'Action'],
  [/\bcomedy|comedies|funny|feel.good\b/i, 'Comedy'],
  [/\bdrama\b/i, 'Drama'],
  [/\bhorror|scary|thriller\b/i, 'Horror'],
  [/\bsci.fi|science fiction|scifi\b/i, 'Sci-Fi'],
  [/\bromance|romantic|rom.com\b/i, 'Romance'],
  [/\bthriller\b/i, 'Thriller'],
  [/\banimate|animated|animation|cartoon\b/i, 'Animation'],
  [/\bcrime\b/i, 'Crime'],
  [/\bdocumentary|documentaries\b/i, 'Documentary'],
]

function detectGenreFromText(text: string): string {
  for (const [re, genre] of TITLE_GENRE_KEYWORDS) {
    if (re.test(text)) return genre
  }
  return ''
}

async function tmdbDiscover(
  category: 'movies' | 'tv', yearFrom: number | null, yearTo: number | null, apiKey: string, genreId?: number,
): Promise<CloudResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  let yearParam = ''
  if (yearFrom !== null && yearTo !== null) {
    if (yearFrom === yearTo) {
      yearParam = category === 'movies' ? `&primary_release_year=${yearFrom}` : `&first_air_date_year=${yearFrom}`
    } else {
      yearParam = category === 'movies'
        ? `&primary_release_date.gte=${yearFrom}-01-01&primary_release_date.lte=${yearTo}-12-31`
        : `&first_air_date.gte=${yearFrom}-01-01&first_air_date.lte=${yearTo}-12-31`
    }
  }
  const genreParam = genreId ? `&with_genres=${genreId}` : ''
  const excludeIds = genreId ? (GENRE_EXCLUSIONS[genreId] ?? []) : []
  const excludeParam = excludeIds.length > 0 ? `&without_genres=${excludeIds.join(',')}` : ''
  const minVotes = (yearFrom !== null) ? '&vote_count.gte=30' : '&vote_count.gte=1000'

  try {
    const [r1, r2] = await Promise.all([
      fetch(`${TMDB_BASE}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=1${yearParam}${genreParam}${excludeParam}`),
      fetch(`${TMDB_BASE}/discover/${type}?api_key=${apiKey}&sort_by=vote_average.desc&page=1${yearParam}${genreParam}${excludeParam}${minVotes}`),
    ])
    const [d1, d2] = await Promise.all([r1.json(), r2.json()])
    const merged: CloudResult[] = []
    const a: CloudResult[] = (d1.results ?? []).filter((r: CloudResult) => r.poster_path)
    const b: CloudResult[] = (d2.results ?? []).filter((r: CloudResult) => r.poster_path)
    const maxLen = Math.max(a.length, b.length)
    for (let i = 0; i < maxLen; i++) {
      if (a[i]) merged.push(a[i])
      if (b[i]) merged.push(b[i])
    }
    return dedupeById(merged)
  } catch { return [] }
}

async function tmdbSearchOne(
  title: string, category: 'movies' | 'tv', yearFrom: number | null, yearTo: number | null, apiKey: string,
): Promise<CloudResult | null> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearHint = (yearFrom !== null && yearTo !== null && yearFrom === yearTo) ? yearFrom : null
  const yearParam = yearHint
    ? category === 'movies' ? `&year=${yearHint}` : `&first_air_date_year=${yearHint}`
    : ''
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1${yearParam}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const results: CloudResult[] = (data.results ?? []).filter((r: CloudResult) => r.poster_path)
    return results[0] ?? null
  } catch { return null }
}

async function tmdbSearch(
  query: string, category: 'movies' | 'tv', apiKey: string,
): Promise<CloudResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  try {
    const res = await fetch(`${TMDB_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`)
    if (!res.ok) return []
    const data = await res.json()
    return dedupeById((data.results ?? []).filter((r: CloudResult) => r.poster_path))
  } catch { return [] }
}

async function claudeSuggest(
  listTitle: string, category: 'movies' | 'tv', yearFrom: number | null, yearTo: number | null,
  context: string, genre: string, apiKey: string,
): Promise<CloudResult[]> {
  try {
    const res = await fetch('/api/claude/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listTitle, category, yearFrom, yearTo, context, genre: genre || undefined, count: 24 }),
    })
    if (!res.ok) return []
    const { titles } = await res.json()
    if (!Array.isArray(titles) || titles.length === 0) return []

    const results: CloudResult[] = []
    for (let i = 0; i < titles.length; i += 8) {
      const batch = titles.slice(i, i + 8)
      const resolved = await Promise.all(
        batch.map((t: string) => tmdbSearchOne(t, category, yearFrom, yearTo, apiKey)),
      )
      results.push(...resolved.filter((r): r is CloudResult => r !== null))
    }
    return dedupeById(results)
  } catch { return [] }
}

// ─── Genre chips ──────────────────────────────────────────────────────────────

const MOVIE_CHIPS = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation']
const TV_CHIPS    = ['Drama', 'Comedy', 'Reality', 'Crime', 'Sci-Fi', 'Animation', 'Documentary']

// ─── PosterNode ───────────────────────────────────────────────────────────────

function PosterNode({ result, added, onToggle }: {
  result: CloudResult
  added: boolean
  onToggle: (r: CloudResult) => void
}) {
  const t = cloudTitle(result)
  return (
    <div
      title={t}
      onClick={() => onToggle(result)}
      style={{ width: 64, height: 94, position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
    >
      {result.poster_path && (
        <img
          src={`${TMDB_SM}${result.poster_path}`}
          alt={t}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
        />
      )}

      {/* Added overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(232,197,71,0.82)',
        opacity: added ? 1 : 0,
        transition: 'opacity 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#0a0a0f' }}>✓</span>
      </div>

      {/* Hover add overlay (desktop only) */}
      {!added && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            opacity: 0,
            transition: 'opacity 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0' }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: 'white', pointerEvents: 'none' }}>+</span>
        </div>
      )}
    </div>
  )
}

// ─── ThoughtCloud ─────────────────────────────────────────────────────────────

export interface ThoughtCloudProps {
  listTitle: string
  category: 'movies' | 'tv'
  yearFrom: number | null
  yearTo: number | null
  description: string
  addedIds: Set<number>
  addedEntries: string[]
  onToggle: (result: CloudResult) => void
}

export function ThoughtCloud({ listTitle, category, yearFrom, yearTo, description, addedIds, addedEntries, onToggle }: ThoughtCloudProps) {
  const apiKey   = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const genreMap = category === 'movies' ? MOVIE_GENRE_IDS : TV_GENRE_IDS
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  const [tmdbSuggestions, setTmdbSuggestions] = useState<CloudResult[]>([])
  const [claudeSuggestions, setClaudeSuggestions] = useState<CloudResult[]>([])
  const [loading, setLoading]             = useState(true)
  const [claudeLoading, setClaudeLoading] = useState(false)

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<CloudResult[]>([])
  const [searching, setSearching]         = useState(false)

  // Refs mirroring state for stale-closure-safe access in async callbacks
  const tmdbSuggestionsRef   = useRef<CloudResult[]>([])
  const claudeSuggestionsRef = useRef<CloudResult[]>([])
  const addedEntriesRef      = useRef<string[]>(addedEntries)

  // Adaptive update refs
  const adaptiveTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingAdaptiveRef     = useRef<CloudResult[] | null>(null)
  const adaptiveCountRef       = useRef(0)
  const addsSinceSwapRef       = useRef(0)
  const prevAddedLengthRef     = useRef(addedEntries.length)
  const effectiveGenreRef      = useRef('')
  const genreInferenceFiredRef = useRef(false)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef    = useRef<HTMLDivElement>(null)
  const gridRef        = useRef<HTMLDivElement>(null)

  // Keep addedEntriesRef in sync
  useEffect(() => { addedEntriesRef.current = addedEntries }, [addedEntries])

  const loadSuggestions = useCallback(async () => {
    if (!apiKey) { setLoading(false); return }

    setLoading(true)
    setTmdbSuggestions([])
    setClaudeSuggestions([])
    tmdbSuggestionsRef.current = []
    claudeSuggestionsRef.current = []

    const effectiveGenre = detectGenreFromText(listTitle + ' ' + description)
    effectiveGenreRef.current = effectiveGenre
    const genreId = effectiveGenre ? genreMap[effectiveGenre] : undefined

    const tmdbResults = await tmdbDiscover(category, yearFrom, yearTo, apiKey, genreId)
    setTmdbSuggestions(tmdbResults)
    tmdbSuggestionsRef.current = tmdbResults
    setLoading(false)

    setClaudeLoading(true)
    const claudeResults = await claudeSuggest(listTitle, category, yearFrom, yearTo, description, effectiveGenre, apiKey)
    setClaudeLoading(false)

    if (claudeResults.length > 0) {
      setClaudeSuggestions(claudeResults)
      claudeSuggestionsRef.current = claudeResults
    }
  }, [listTitle, category, yearFrom, yearTo, description, apiKey, genreMap])

  useEffect(() => {
    loadSuggestions()
  }, [loadSuggestions])

  // ── Adaptive suggestions ────────────────────────────────────────────────────

  const fireAdaptiveUpdate = useCallback(async () => {
    if (adaptiveCountRef.current >= 3) return
    if (!apiKey) return

    const currentAdded = addedEntriesRef.current
    if (currentAdded.length === 0) return

    adaptiveCountRef.current += 1

    // Infer genre via Claude if regex returned nothing and we have ≥2 entries
    let genre = effectiveGenreRef.current
    if (!genre && !genreInferenceFiredRef.current && currentAdded.length >= 2) {
      genreInferenceFiredRef.current = true
      try {
        const res = await fetch('/api/claude/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'inferGenre', category, addedEntries: currentAdded }),
        })
        if (res.ok) {
          const { genre: inferred } = await res.json()
          if (inferred) { genre = inferred; effectiveGenreRef.current = inferred }
        }
      } catch { /* ignore */ }
    }

    // Current Claude suggestions as titles for pruning
    const currentSuggestions = claudeSuggestionsRef.current.slice(0, 12).map(cloudTitle)

    try {
      const res = await fetch('/api/claude/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'adaptive',
          listTitle,
          category,
          yearFrom,
          yearTo,
          context: description,
          genre: genre || undefined,
          addedEntries: currentAdded,
          currentSuggestions,
          count: 20,
        }),
      })
      if (!res.ok) return
      const { titles } = await res.json()
      if (!Array.isArray(titles) || titles.length === 0) return

      // TMDB-resolve titles in batches
      const results: CloudResult[] = []
      for (let i = 0; i < titles.length; i += 8) {
        const batch = titles.slice(i, i + 8)
        const resolved = await Promise.all(
          batch.map((t: string) => tmdbSearchOne(t, category, yearFrom, yearTo, apiKey)),
        )
        results.push(...resolved.filter((r): r is CloudResult => r !== null))
      }

      const deduped = dedupeById(results)
      if (deduped.length > 0) {
        pendingAdaptiveRef.current = deduped
      }
    } catch { /* ignore */ }
  }, [listTitle, category, yearFrom, yearTo, description, apiKey])

  // Use a ref so the setTimeout callback always calls the latest version
  const fireAdaptiveUpdateRef = useRef(fireAdaptiveUpdate)
  useEffect(() => { fireAdaptiveUpdateRef.current = fireAdaptiveUpdate }, [fireAdaptiveUpdate])

  // Detect adds, debounce adaptive call, swap buffer every 3rd add
  useEffect(() => {
    const prevLen = prevAddedLengthRef.current
    const newLen = addedEntries.length
    prevAddedLengthRef.current = newLen

    if (newLen <= prevLen) return

    // New add detected
    addsSinceSwapRef.current += 1

    // Apply buffered adaptive result every 3rd add
    if (addsSinceSwapRef.current >= 3 && pendingAdaptiveRef.current !== null) {
      const pending = pendingAdaptiveRef.current
      setClaudeSuggestions(pending)
      claudeSuggestionsRef.current = pending
      pendingAdaptiveRef.current = null
      addsSinceSwapRef.current = 0
    }

    // Debounce adaptive API call (fire after 3s idle)
    if (adaptiveCountRef.current >= 3) return

    if (adaptiveTimerRef.current) clearTimeout(adaptiveTimerRef.current)
    adaptiveTimerRef.current = setTimeout(() => {
      fireAdaptiveUpdateRef.current()
    }, 3000)

    return () => {
      if (adaptiveTimerRef.current) clearTimeout(adaptiveTimerRef.current)
    }
  }, [addedEntries.length])

  // Search debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      const results = await tmdbSearch(searchQuery.trim(), category, apiKey)
      setSearchResults(results)
      setSearching(false)
    }, 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, category, apiKey])

  // Scroll-right sentinel → load more
  const loadMore = useCallback(async () => {
    if (loading || claudeLoading || searchQuery) return
    const more = await tmdbDiscover(category, yearFrom, yearTo, apiKey)
    setTmdbSuggestions((prev) => {
      const updated = dedupeById([...prev, ...more])
      tmdbSuggestionsRef.current = updated
      return updated
    })
  }, [loading, claudeLoading, searchQuery, category, yearFrom, yearTo, apiKey])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const grid = gridRef.current
    if (!sentinel || !grid) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { root: grid, threshold: 0.1 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [loadMore])

  // ── Render ──────────────────────────────────────────────────────────────────

  const suggestions = dedupeById([...claudeSuggestions, ...tmdbSuggestions])
  const displayItems = searchQuery.trim() ? searchResults : suggestions

  return (
    <div className="space-y-4">

      {/* ── Search bar ── */}
      <div className="relative">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search for a specific ${category === 'movies' ? 'movie' : 'show'}…`}
          className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>
          {searching ? '⟳' : '⌕'}
        </span>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>✕</button>
        )}
      </div>

      {/* Status line */}
      {!searchQuery.trim() && (
        <p className="text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          {yearFrom !== null && yearTo !== null
            ? yearFrom === yearTo
              ? `Suggested ${catLabel} from ${yearFrom}`
              : `Suggested ${catLabel} from ${yearFrom}–${yearTo}`
            : `Suggested ${catLabel}`
          }
          {claudeLoading && (
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              finding more…
            </span>
          )}
        </p>
      )}

      {/* ── Grid ── */}
      <div className="relative" style={{ marginLeft: -16, marginRight: -16 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 48, background: 'linear-gradient(to right, var(--background), transparent)', zIndex: 10, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: '0 0 0 auto', width: 48, background: 'linear-gradient(to left, var(--background), transparent)', zIndex: 10, pointerEvents: 'none' }} />

        {loading ? (
          <div className="flex justify-center py-14">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : displayItems.length === 0 ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--muted)' }}>No results. Try different keywords.</p>
        ) : (
          <div
            ref={gridRef}
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(3, 94px)',
              gridAutoFlow: 'column',
              gridAutoColumns: '64px',
              gap: 8,
              overflowX: 'auto',
              padding: '8px 56px',
              scrollbarWidth: 'none',
            } as React.CSSProperties}
          >
            {displayItems.map((result) => (
              <PosterNode
                key={result.id}
                result={result}
                added={addedIds.has(result.id)}
                onToggle={onToggle}
              />
            ))}

            {!searchQuery.trim() && (
              <div ref={sentinelRef} style={{ width: 64, height: 94 }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
