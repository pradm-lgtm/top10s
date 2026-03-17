'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloudResult = {
  id: number
  title?: string
  name?: string
  poster_path: string | null
}

type TmdbDetail = {
  director: string | null
  cast: string[]
  genres: string[]
  year: string | null
}

type PreviewState = {
  result: CloudResult
  rect: DOMRect
  detail: TmdbDetail | null
  loadingDetail: boolean
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_SM   = 'https://image.tmdb.org/t/p/w185'
const TMDB_MD   = 'https://image.tmdb.org/t/p/w342'

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
  category: 'movies' | 'tv', year: number | null, apiKey: string, genreId?: number,
): Promise<CloudResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearParam = year
    ? category === 'movies' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`
    : ''
  const genreParam = genreId ? `&with_genres=${genreId}` : ''
  const excludeIds = genreId ? (GENRE_EXCLUSIONS[genreId] ?? []) : []
  const excludeParam = excludeIds.length > 0 ? `&without_genres=${excludeIds.join(',')}` : ''
  const minVotes = year ? '&vote_count.gte=30' : '&vote_count.gte=1000'

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

// Search TMDB for a specific title (Claude-generated), return best match with poster
async function tmdbSearchOne(
  title: string, category: 'movies' | 'tv', year: number | null, apiKey: string,
): Promise<CloudResult | null> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearParam = year
    ? category === 'movies' ? `&year=${year}` : `&first_air_date_year=${year}`
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

// Search TMDB for a user-typed query (freeform)
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

// Fetch Claude-generated titles then resolve each on TMDB
async function claudeSuggest(
  listTitle: string, category: 'movies' | 'tv', year: number | null,
  context: string, genre: string, refineText: string, apiKey: string,
): Promise<CloudResult[]> {
  try {
    const res = await fetch('/api/claude/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listTitle, category, year, context, genre: genre || undefined, refineText: refineText || undefined, count: 24 }),
    })
    if (!res.ok) return []
    const { titles } = await res.json()
    if (!Array.isArray(titles) || titles.length === 0) return []

    // Resolve all titles on TMDB in parallel (batches of 8 to avoid rate limits)
    const results: CloudResult[] = []
    for (let i = 0; i < titles.length; i += 8) {
      const batch = titles.slice(i, i + 8)
      const resolved = await Promise.all(
        batch.map((t: string) => tmdbSearchOne(t, category, year, apiKey)),
      )
      results.push(...resolved.filter((r): r is CloudResult => r !== null))
    }
    return dedupeById(results)
  } catch { return [] }
}

async function fetchDetail(id: number, category: 'movies' | 'tv', apiKey: string): Promise<TmdbDetail> {
  const type = category === 'movies' ? 'movie' : 'tv'
  try {
    const res = await fetch(`${TMDB_BASE}/${type}/${id}?api_key=${apiKey}&append_to_response=credits`)
    if (!res.ok) return { director: null, cast: [], genres: [], year: null }
    const d = await res.json()
    const director = category === 'movies'
      ? ((d.credits?.crew ?? []) as { job: string; name: string }[]).find((c) => c.job === 'Director')?.name ?? null
      : (d.created_by as { name: string }[] | undefined)?.[0]?.name ?? null
    const cast = ((d.credits?.cast ?? []) as { name: string }[]).slice(0, 3).map((c) => c.name)
    const genres = ((d.genres ?? []) as { name: string }[]).slice(0, 2).map((g) => g.name)
    const year = category === 'movies'
      ? ((d.release_date ?? '') as string).split('-')[0] || null
      : ((d.first_air_date ?? '') as string).split('-')[0] || null
    return { director, cast, genres, year }
  } catch { return { director: null, cast: [], genres: [], year: null } }
}

// ─── Genre chips ──────────────────────────────────────────────────────────────

const MOVIE_CHIPS = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation']
const TV_CHIPS    = ['Drama', 'Comedy', 'Reality', 'Crime', 'Sci-Fi', 'Animation', 'Documentary']

// ─── PosterNode ───────────────────────────────────────────────────────────────

interface PosterNodeProps {
  result: CloudResult
  added: boolean
  onToggle: (r: CloudResult) => void
  onShowPreview: (r: CloudResult, rect: DOMRect) => void
  onScheduleHide: () => void
  onCancelHide: () => void
}

function PosterNode({ result, added, onToggle, onShowPreview, onScheduleHide, onCancelHide }: PosterNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const t = cloudTitle(result)

  function handlePointerDown() {
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      if (nodeRef.current) onShowPreview(result, nodeRef.current.getBoundingClientRect())
    }, 400)
  }

  function handlePointerUp() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  function handleClick() {
    if (longPressFired.current) { longPressFired.current = false; return }
    onToggle(result)
  }

  function handleMouseEnter() {
    onCancelHide()
    if (nodeRef.current) onShowPreview(result, nodeRef.current.getBoundingClientRect())
  }

  return (
    <div
      ref={nodeRef}
      title={t}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onScheduleHide}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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

      {/* Hover add overlay */}
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

// ─── PreviewCard ──────────────────────────────────────────────────────────────

function PreviewCard({
  preview, added, onAdd, onClose, onCancelHide,
}: {
  preview: PreviewState
  added: boolean
  onAdd: () => void
  onClose: () => void
  onCancelHide: () => void
}) {
  const { result, rect, detail, loadingDetail } = preview
  const t = cloudTitle(result)
  const CARD_W = 200
  const CARD_H = 310
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600

  let left = rect.right + 10
  if (left + CARD_W > vw - 8) left = rect.left - CARD_W - 10
  if (left < 8) left = 8

  let top = rect.top - 10
  if (top + CARD_H > vh - 8) top = vh - CARD_H - 8
  if (top < 8) top = 8

  return (
    <div
      onMouseEnter={onCancelHide}
      onMouseLeave={onClose}
      style={{
        position: 'fixed', left, top, width: CARD_W,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.7)', zIndex: 9999,
      }}
    >
      {result.poster_path && (
        <img src={`${TMDB_MD}${result.poster_path}`} alt={t} style={{ width: '100%', borderRadius: 8, marginBottom: 10, display: 'block' }} />
      )}
      <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.35, marginBottom: 6, color: 'var(--foreground)' }}>{t}</p>
      {loadingDetail ? (
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</p>
      ) : detail && (
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 2 }}>
          {detail.year && <p>{detail.year}</p>}
          {detail.genres.length > 0 && <p>{detail.genres.join(' · ')}</p>}
          {detail.director && <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Dir: {detail.director}</p>}
          {detail.cast.length > 0 && <p style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.cast.slice(0, 2).join(', ')}</p>}
        </div>
      )}
      <button
        onClick={onAdd}
        style={{
          marginTop: 8, width: '100%', padding: '6px 0',
          background: added ? 'var(--surface-2)' : 'var(--accent)',
          color: added ? 'var(--muted)' : '#0a0a0f',
          borderRadius: 8, fontSize: 12, fontWeight: 600,
          cursor: added ? 'default' : 'pointer', border: '1px solid var(--border)',
          transition: 'background 0.2s',
        }}
      >
        {added ? '✓ Added' : '+ Add to list'}
      </button>
    </div>
  )
}

// ─── ThoughtCloud ─────────────────────────────────────────────────────────────

export interface ThoughtCloudProps {
  listTitle: string
  category: 'movies' | 'tv'
  year: number | null
  description: string
  addedIds: Set<number>
  onToggle: (result: CloudResult) => void
}

export function ThoughtCloud({ listTitle, category, year, description, addedIds, onToggle }: ThoughtCloudProps) {
  const apiKey   = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const genreMap = category === 'movies' ? MOVIE_GENRE_IDS : TV_GENRE_IDS
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  const [suggestions, setSuggestions]     = useState<CloudResult[]>([])
  const [loading, setLoading]             = useState(true)
  const [claudeLoading, setClaudeLoading] = useState(false)

  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<CloudResult[]>([])
  const [searching, setSearching]         = useState(false)

  const [preview, setPreview]             = useState<PreviewState | null>(null)
  const [mounted, setMounted]             = useState(false)

  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef    = useRef<HTMLDivElement>(null)
  const gridRef        = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const loadSuggestions = useCallback(async () => {
    if (!apiKey) { setLoading(false); return }

    setLoading(true)
    setSuggestions([])

    // Auto-detect genre from list title + description
    const effectiveGenre = detectGenreFromText(listTitle + ' ' + description)
    const genreId = effectiveGenre ? genreMap[effectiveGenre] : undefined

    // 1. Fast TMDB discover (genre-filtered when detectable)
    const tmdbResults = await tmdbDiscover(category, year, apiKey, genreId)
    setSuggestions(tmdbResults)
    setLoading(false)

    // 2. Claude suggestions — prepend when ready
    setClaudeLoading(true)
    const claudeResults = await claudeSuggest(listTitle, category, year, description, effectiveGenre, '', apiKey)
    setClaudeLoading(false)

    if (claudeResults.length > 0) {
      setSuggestions((prev) => dedupeById([...claudeResults, ...prev]))
    }
  }, [listTitle, category, year, description, apiKey, genreMap])

  useEffect(() => {
    loadSuggestions()
  }, [loadSuggestions])

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
    const more = await tmdbDiscover(category, year, apiKey)
    setSuggestions((prev) => dedupeById([...prev, ...more]))
  }, [loading, claudeLoading, searchQuery, category, year, apiKey])

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

  // ── Preview ─────────────────────────────────────────────────────────────────

  function scheduleHide() {
    hideTimerRef.current = setTimeout(() => setPreview(null), 150)
  }

  function cancelHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  async function showPreview(result: CloudResult, rect: DOMRect) {
    cancelHide()
    setPreview({ result, rect, detail: null, loadingDetail: true })
    const detail = await fetchDetail(result.id, category, apiKey)
    setPreview((prev) => prev?.result.id === result.id ? { ...prev, detail, loadingDetail: false } : prev)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
          {year ? `Suggested ${catLabel} from ${year}` : `Suggested ${catLabel}`}
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
                onShowPreview={showPreview}
                onScheduleHide={scheduleHide}
                onCancelHide={cancelHide}
              />
            ))}

            {!searchQuery.trim() && (
              <div ref={sentinelRef} style={{ width: 64, height: 94 }} />
            )}
          </div>
        )}
      </div>

      {/* ── Preview card ── */}
      {mounted && preview && ReactDOM.createPortal(
        <PreviewCard
          preview={preview}
          added={addedIds.has(preview.result.id)}
          onAdd={() => { onToggle(preview.result); setPreview(null) }}
          onClose={scheduleHide}
          onCancelHide={cancelHide}
        />,
        document.body,
      )}
    </div>
  )
}
