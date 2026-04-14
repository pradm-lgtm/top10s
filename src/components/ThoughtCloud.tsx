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
  // Try person search first — handles "Brad Pitt", "Nolan", etc.
  try {
    const personRes = await fetch(`${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`)
    if (personRes.ok) {
      const personData = await personRes.json()
      const person = (personData.results ?? []).find(
        (p: { popularity: number; known_for_department: string }) =>
          p.popularity > 3 && ['Acting', 'Directing'].includes(p.known_for_department)
      )
      if (person) {
        const isDirector = person.known_for_department === 'Directing'
        const creditsRes = await fetch(`${TMDB_BASE}/person/${person.id}/${type}_credits?api_key=${apiKey}`)
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json()
          const credits: CloudResult[] = isDirector
            ? (creditsData.crew ?? []).filter((c: { job: string }) => c.job === 'Director')
            : (creditsData.cast ?? [])
          credits.sort((a, b) => ((b as { vote_count?: number }).vote_count ?? 0) - ((a as { vote_count?: number }).vote_count ?? 0))
          const results = dedupeById(credits.filter((r) => r.poster_path).slice(0, 20))
          if (results.length > 0) return results
        }
      }
    }
  } catch { /* fall through to title search */ }
  // Fall back to regular title search
  try {
    const res = await fetch(`${TMDB_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`)
    if (!res.ok) return []
    const data = await res.json()
    return dedupeById((data.results ?? []).filter((r: CloudResult) => r.poster_path))
  } catch { return [] }
}

async function claudeSuggestTitles(
  listTitle: string, category: 'movies' | 'tv', yearFrom: number | null, yearTo: number | null,
  context: string, genre: string,
): Promise<string[]> {
  const res = await fetch('/api/claude/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listTitle, category, yearFrom, yearTo, context, genre: genre || undefined, count: 36 }),
  })
  if (!res.ok) return []
  const { titles } = await res.json()
  return Array.isArray(titles) ? titles : []
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

// ─── Pre-fetch helpers (call from parent before ThoughtCloud mounts) ──────────

export function startPrefetch(
  listTitle: string, category: 'movies' | 'tv',
  yearFrom: number | null, yearTo: number | null,
  description: string,
): { claude: Promise<string[]> } {
  const genre = detectGenreFromText(listTitle + ' ' + description)
  return {
    claude: claudeSuggestTitles(listTitle, category, yearFrom, yearTo, description, genre),
  }
}

// Resolves a list of titles to TMDB CloudResults in batches of 8,
// calling onBatch after each batch. Returns a cancel function.
export function resolveTitlesProgressively(
  titles: string[], category: 'movies' | 'tv',
  yearFrom: number | null, yearTo: number | null,
  apiKey: string,
  onBatch: (results: CloudResult[]) => void,
): () => void {
  let cancelled = false
  ;(async () => {
    for (let i = 0; i < titles.length; i += 8) {
      if (cancelled) return
      const batch = titles.slice(i, i + 8)
      const resolved = await Promise.all(
        batch.map(t => tmdbSearchOne(t, category, yearFrom, yearTo, apiKey)),
      )
      if (cancelled) return
      const valid = resolved.filter((r): r is CloudResult => r !== null)
      if (valid.length > 0) onBatch(valid)
    }
  })()
  return () => { cancelled = true }
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
  prefetchedTmdb?: CloudResult[]
  prefetchedTitles?: string[]
  prefetchedResults?: CloudResult[]
}

export function ThoughtCloud({ listTitle, category, yearFrom, yearTo, description, addedIds, addedEntries, onToggle, prefetchedTitles, prefetchedResults }: ThoughtCloudProps) {
  const apiKey   = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  const [claudeSuggestions, setClaudeSuggestions] = useState<CloudResult[]>([])
  const [claudeLoading, setClaudeLoading] = useState(true)

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<CloudResult[]>([])
  const [searching, setSearching]         = useState(false)

  // Seed data from parent pre-fetch (captured at mount — only used on first load)
  const prefetchedTitlesRef = useRef(prefetchedTitles ?? [])

  // Refs mirroring state for stale-closure-safe access in async callbacks
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
  const gridRef        = useRef<HTMLDivElement>(null)

  // Keep addedEntriesRef in sync
  useEffect(() => { addedEntriesRef.current = addedEntries }, [addedEntries])

  // Track whether parent's progressive resolution has taken ownership
  const externallyFedRef = useRef(false)

  // Watch prefetchedResults from parent — sync into local state as batches arrive
  useEffect(() => {
    if (!prefetchedResults || prefetchedResults.length === 0) return
    externallyFedRef.current = true
    setClaudeSuggestions(dedupeById([...prefetchedResults]))
    claudeSuggestionsRef.current = dedupeById([...prefetchedResults])
    setClaudeLoading(false)
  }, [prefetchedResults])

  const loadSuggestions = useCallback(async () => {
    if (!apiKey) { setClaudeLoading(false); return }

    // If parent is feeding results progressively, don't also fetch internally
    if (prefetchedResults && prefetchedResults.length > 0) return

    setClaudeLoading(true)
    setClaudeSuggestions([])
    claudeSuggestionsRef.current = []

    const effectiveGenre = detectGenreFromText(listTitle + ' ' + description)
    effectiveGenreRef.current = effectiveGenre

    // Use pre-fetched titles if available (parent fetched Claude but TMDB not started yet),
    // otherwise do the full Claude + TMDB fetch internally
    const seedTitles = prefetchedTitlesRef.current
    const titles = seedTitles.length > 0
      ? seedTitles
      : await claudeSuggestTitles(listTitle, category, yearFrom, yearTo, description, effectiveGenre)

    if (titles.length === 0) { setClaudeLoading(false); return }

    // Resolve TMDB posters in batches of 8, updating state as each batch arrives.
    // Abort if parent takes over mid-fetch.
    let firstBatch = true
    for (let i = 0; i < titles.length; i += 8) {
      if (externallyFedRef.current) return
      const batch = titles.slice(i, i + 8)
      const resolved = await Promise.all(
        batch.map((t: string) => tmdbSearchOne(t, category, yearFrom, yearTo, apiKey)),
      )
      if (externallyFedRef.current) return
      const valid = resolved.filter((r): r is CloudResult => r !== null)
      if (valid.length > 0) {
        setClaudeSuggestions(prev => {
          const updated = dedupeById([...prev, ...valid])
          claudeSuggestionsRef.current = updated
          return updated
        })
      }
      if (firstBatch) { setClaudeLoading(false); firstBatch = false }
    }
    if (firstBatch) setClaudeLoading(false)
  }, [listTitle, category, yearFrom, yearTo, description, apiKey, prefetchedResults])

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
      const q = searchQuery.trim()

      // Run TMDB search and triage in parallel — zero added latency
      const [tmdbResults, triageRes] = await Promise.all([
        tmdbSearch(q, category, apiKey),
        fetch('/api/claude/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'triage', query: q }),
        }).then(r => r.ok ? r.json() : { type: 'lookup' }).catch(() => ({ type: 'lookup' })),
      ])

      if (triageRes.type === 'concept') {
        // Concept query — generate titles via Claude then resolve posters progressively
        setSearchResults([]) // clear while loading
        try {
          const res = await fetch('/api/claude/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'searchConcept', query: q, category, count: 15 }),
          })
          if (res.ok) {
            const { titles } = await res.json()
            if (Array.isArray(titles) && titles.length > 0) {
              const resolved: CloudResult[] = []
              for (let i = 0; i < titles.length; i += 8) {
                const batch = titles.slice(i, i + 8)
                const batchResults = await Promise.all(
                  batch.map((t: string) => tmdbSearchOne(t, category, null, null, apiKey)),
                )
                const valid = batchResults.filter((r): r is CloudResult => r !== null)
                resolved.push(...valid)
                setSearchResults(dedupeById([...resolved]))
              }
              setSearching(false)
              return
            }
          }
        } catch { /* fall through to TMDB results */ }
      }

      // Lookup query (or concept fallback) — show TMDB results
      setSearchResults(tmdbResults)
      setSearching(false)
    }, 400)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, category, apiKey])

  // ── Render ──────────────────────────────────────────────────────────────────

  const displayItems = searchQuery.trim() ? searchResults : claudeSuggestions

  return (
    <div className="space-y-4">

      {/* ── Search bar ── */}
      <div className="relative">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search by title, person, or theme…`}
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
        </p>
      )}

      {/* ── Grid ── */}
      <div className="relative" style={{ marginLeft: -16, marginRight: -16 }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: 48, background: 'linear-gradient(to right, var(--background), transparent)', zIndex: 10, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: '0 0 0 auto', width: 48, background: 'linear-gradient(to left, var(--background), transparent)', zIndex: 10, pointerEvents: 'none' }} />

        {claudeLoading ? (
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
                onToggle={(r) => { if (searchQuery.trim()) setSearchQuery(''); onToggle(r) }}
              />
            ))}

          </div>
        )}
      </div>
    </div>
  )
}
