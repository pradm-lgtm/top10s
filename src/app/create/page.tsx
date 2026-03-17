'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'
import { AppHeader } from '@/components/AppHeader'

// ─── Types ───────────────────────────────────────────────────────────────────

type Entry = {
  uid: string
  tmdbId: number | null   // track which TMDB result this came from
  title: string
  notes: string
  posterUrl: string | null
  notesOpen: boolean
}

type TmdbResult = {
  id: number
  title?: string
  name?: string
  poster_path: string | null
}

// ─── TMDB helpers ────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w185'

function tmdbTitle(r: TmdbResult) { return r.title ?? r.name ?? '' }

function dedupeById(results: TmdbResult[]): TmdbResult[] {
  const seen = new Set<number>()
  return results.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

async function discoverPage(
  type: string, sort: string, page: number, extra: string, apiKey: string,
): Promise<TmdbResult[]> {
  try {
    const res = await fetch(
      `${TMDB_BASE}/discover/${type}?api_key=${apiKey}&sort_by=${sort}&page=${page}${extra}`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return ((data.results ?? []) as TmdbResult[]).filter((r) => r.poster_path)
  } catch { return [] }
}

async function loadSuggestions(
  category: 'movies' | 'tv',
  year: number | null,
  apiKey: string,
  page = 1,
): Promise<TmdbResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearParam = year
    ? category === 'movies' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`
    : ''
  const minVotes = year ? '&vote_count.gte=50' : '&vote_count.gte=500'

  const [popular, topRated] = await Promise.all([
    discoverPage(type, 'popularity.desc', page, yearParam, apiKey),
    discoverPage(type, 'vote_average.desc', page, yearParam + minVotes, apiKey),
  ])

  // Interleave: popular result, top-rated result, popular result, …
  const merged: TmdbResult[] = []
  const maxLen = Math.max(popular.length, topRated.length)
  for (let i = 0; i < maxLen; i++) {
    if (popular[i]) merged.push(popular[i])
    if (topRated[i]) merged.push(topRated[i])
  }
  return dedupeById(merged)
}

async function searchTmdb(
  query: string,
  category: 'movies' | 'tv',
  apiKey: string,
): Promise<TmdbResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return dedupeById(((data.results ?? []) as TmdbResult[]).filter((r) => r.poster_path))
  } catch { return [] }
}

// ─── Auto-detect year & category from title ──────────────────────────────────

function detectFromTitle(t: string) {
  const yearMatch = t.match(/\b(19[5-9]\d|20[0-2]\d)\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null
  const movieKw = /\b(movie|movies|film|films|cinema)\b/i
  const tvKw    = /\b(tv|show|shows|series|television)\b/i
  const category: 'movies' | 'tv' | null = movieKw.test(t) ? 'movies' : tvKw.test(t) ? 'tv' : null
  return { year, category }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const labels = ['Name & Category', 'List Format', 'Add Entries']
  return (
    <div className="flex items-center gap-3 mb-10">
      {labels.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done   = n < step
        return (
          <div key={n} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: done || active ? 'var(--accent)' : 'var(--surface-2)',
                  color: done || active ? '#0a0a0f' : 'var(--muted)',
                  border: done || active ? 'none' : '1px solid var(--border)',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: active ? 'var(--foreground)' : 'var(--muted)' }}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className="h-px w-6" style={{ background: done ? 'var(--accent)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared input style helpers ───────────────────────────────────────────────

const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }
function onFocusAccent(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = 'var(--accent)' }
function onBlurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) { e.currentTarget.style.borderColor = 'var(--border)' }

// ─── Step 1 — Name & Category ─────────────────────────────────────────────────

function Step1({
  title, setTitle, category, setCategory,
  year, setYear, allTime, setAllTime,
  description, setDescription,
  context, setContext,
  onNext,
}: {
  title: string; setTitle: (v: string) => void
  category: 'movies' | 'tv'; setCategory: (v: 'movies' | 'tv') => void
  year: number | null; setYear: (v: number | null) => void
  allTime: boolean; setAllTime: (v: boolean) => void
  description: string; setDescription: (v: string) => void
  context: string; setContext: (v: string) => void
  onNext: () => void
}) {
  function handleTitleChange(v: string) {
    setTitle(v)
    const detected = detectFromTitle(v)
    if (detected.category) setCategory(detected.category)
    if (detected.year) { setYear(detected.year); setAllTime(false) }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>List Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. My Top 2024 Movies"
          maxLength={120}
          className="w-full px-4 py-3 rounded-xl text-base outline-none"
          style={inputStyle}
          onFocus={onFocusAccent}
          onBlur={onBlurBorder}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>Category</label>
        <div className="flex gap-2">
          {(['movies', 'tv'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: category === cat ? 'var(--accent)' : 'var(--surface)',
                color: category === cat ? '#0a0a0f' : 'var(--muted)',
                border: `1px solid ${category === cat ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {cat === 'movies' ? '🎬 Movies' : '📺 TV Shows'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>Time Scope</label>
        <div className="flex gap-2 mb-2">
          {[false, true].map((isAllTime) => (
            <button
              key={String(isAllTime)}
              onClick={() => { setAllTime(isAllTime); if (isAllTime) setYear(null) }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: allTime === isAllTime ? 'var(--accent)' : 'var(--surface)',
                color: allTime === isAllTime ? '#0a0a0f' : 'var(--muted)',
                border: `1px solid ${allTime === isAllTime ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {isAllTime ? 'All Time' : 'Specific Year'}
            </button>
          ))}
        </div>
        {!allTime && (
          <input
            type="number"
            value={year ?? ''}
            onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 2024"
            min={1950}
            max={new Date().getFullYear() + 1}
            className="w-32 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            onFocus={onFocusAccent}
            onBlur={onBlurBorder}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          What kind of {category === 'movies' ? 'movies' : 'shows'} are you thinking of?{' '}
          <span className="normal-case font-normal">(optional — helps with suggestions)</span>
        </label>
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={category === 'movies' ? 'e.g. feel-good comedies, Oscar winners, sci-fi thrillers…' : 'e.g. prestige dramas, reality TV, limited series…'}
          maxLength={120}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={inputStyle}
          onFocus={onFocusAccent}
          onBlur={onBlurBorder}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          Description <span className="normal-case font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this list about?"
          rows={2}
          maxLength={300}
          className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none"
          style={inputStyle}
          onFocus={onFocusAccent}
          onBlur={onBlurBorder}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!title.trim()}
        className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)', color: '#0a0a0f' }}
      >
        Next →
      </button>
    </div>
  )
}

// ─── Step 2 — Format ──────────────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: `2px solid var(--accent)` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold">Ranked List</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Entries numbered 1 to N, in order of preference</p>
          </div>
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>✓</div>
        </div>
        <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {['Parasite', 'The Godfather', 'Mulholland Drive'].map((film, i) => (
            <div key={film} className="flex items-center gap-3 text-sm">
              <span className="text-xs font-bold w-4" style={{ color: 'var(--accent)' }}>{i + 1}</span>
              <span style={{ color: 'var(--muted)' }}>{film}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs font-bold w-4" style={{ color: 'var(--muted)' }}>…</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>Next →</button>
      </div>
    </div>
  )
}

// ─── Sortable entry row ───────────────────────────────────────────────────────

function SortableEntry({
  entry, rank, onRemove, onNotesChange, onToggleNotes,
}: {
  entry: Entry; rank: number
  onRemove: (uid: string) => void
  onNotesChange: (uid: string, notes: string) => void
  onToggleNotes: (uid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.uid })

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: entry.notesOpen ? '12px 12px 0 0' : '12px',
          borderBottom: entry.notesOpen ? 'none' : undefined,
        }}
      >
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none px-1"
          style={{ color: 'var(--muted)', fontSize: '16px', lineHeight: 1 }}
        >⠿</button>

        <span className="text-xs font-bold w-5 shrink-0 text-right" style={{ color: 'var(--accent)' }}>{rank}</span>

        {entry.posterUrl && (
          <img src={entry.posterUrl} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
        )}

        <span className="flex-1 text-sm font-medium truncate">{entry.title}</span>

        <button
          onClick={() => onToggleNotes(entry.uid)}
          className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70 shrink-0"
          style={{ color: entry.notesOpen || entry.notes ? 'var(--accent)' : 'var(--muted)' }}
        >
          {entry.notesOpen ? 'Done' : entry.notes ? 'Note ✎' : '+ Note'}
        </button>

        <button
          onClick={() => onRemove(entry.uid)}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
        >✕</button>
      </div>

      {entry.notesOpen && (
        <textarea
          autoFocus
          value={entry.notes}
          onChange={(e) => onNotesChange(entry.uid, e.target.value)}
          placeholder="Add a note about this entry…"
          rows={2}
          maxLength={300}
          className="w-full px-4 py-2.5 text-sm resize-none outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            borderRadius: '0 0 12px 12px',
            color: 'var(--foreground)',
          }}
        />
      )}
    </div>
  )
}

// ─── Poster tile ──────────────────────────────────────────────────────────────

function PosterTile({
  result, added, onToggle,
}: {
  result: TmdbResult
  added: boolean
  onToggle: (result: TmdbResult) => void
}) {
  const t = tmdbTitle(result)
  return (
    <button
      onClick={() => onToggle(result)}
      title={t}
      className="relative rounded-lg overflow-hidden transition-all active:scale-95"
      style={{ aspectRatio: '2/3', display: 'block', width: '100%', cursor: 'pointer' }}
    >
      {result.poster_path ? (
        <img src={`${TMDB_IMG}${result.poster_path}`} alt={t} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs p-1 text-center" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{t}</div>
      )}
      {/* Overlay — always rendered, opacity controlled */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity"
        style={{
          background: added ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
          opacity: added ? 1 : 0,
        }}
      >
        <span className="text-white text-lg font-bold">{added ? '✓' : '+'}</span>
      </div>
      {/* Hover overlay via CSS — separate element so it doesn't interfere */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: 'rgba(0,0,0,0.4)',
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { if (!added) (e.currentTarget as HTMLElement).style.opacity = '1' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0' }}
      >
        {!added && <span className="text-white text-xl font-bold pointer-events-none">+</span>}
      </div>
    </button>
  )
}

// ─── Step 3 — Entries ─────────────────────────────────────────────────────────

function Step3({
  category, year, context, entries, setEntries,
  onPublish, onBack, publishing, publishError,
}: {
  category: 'movies' | 'tv'
  year: number | null
  context: string
  entries: Entry[]
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>
  onPublish: () => void
  onBack: () => void
  publishing: boolean
  publishError: string | null
}) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''

  // Suggestions state
  const [suggestions, setSuggestions] = useState<TmdbResult[]>([])
  const [suggPage, setSuggPage] = useState(1)
  const [loadingSugg, setLoadingSugg] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Refine input (changes the suggestion pool) — starts empty, context is just placeholder
  const [refineInput, setRefineInput] = useState('')
  const [refineApplied, setRefineApplied] = useState('')
  const refineTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search bar (direct title lookup)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Set of TMDB IDs added
  const addedIds = new Set(entries.map((e) => e.tmdbId).filter(Boolean) as number[])

  // Load/reload suggestions when refineApplied changes
  useEffect(() => {
    if (!apiKey || apiKey === 'your-tmdb-api-key') { setLoadingSugg(false); return }
    setLoadingSugg(true)
    setSuggestions([])
    setSuggPage(1)
    const load = async () => {
      if (refineApplied.trim()) {
        const results = await searchTmdb(refineApplied.trim(), category, apiKey)
        if (results.length > 0) {
          setSuggestions(results)
        } else {
          // Fall back to default suggestions when refine returns nothing
          const fallback = await loadSuggestions(category, year, apiKey, 1)
          setSuggestions(fallback)
        }
      } else {
        const results = await loadSuggestions(category, year, apiKey, 1)
        setSuggestions(results)
      }
      setLoadingSugg(false)
    }
    load()
  }, [refineApplied, category, year, apiKey])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const res = await searchTmdb(searchQuery.trim(), category, apiKey)
      setSearchResults(res)
      setSearching(false)
    }, 400)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery, category, apiKey])

  async function loadMore() {
    if (refineApplied.trim()) return // search mode, no pagination
    setLoadingMore(true)
    const nextPage = suggPage + 1
    const more = await loadSuggestions(category, year, apiKey, nextPage)
    setSuggestions((prev) => dedupeById([...prev, ...more]))
    setSuggPage(nextPage)
    setLoadingMore(false)
  }

  function applyRefine() {
    if (refineTimeout.current) clearTimeout(refineTimeout.current)
    setRefineApplied(refineInput)
  }

  function toggleEntry(result: TmdbResult) {
    const t = tmdbTitle(result)
    if (addedIds.has(result.id)) {
      // Remove
      setEntries((prev) => prev.filter((e) => e.tmdbId !== result.id))
    } else {
      // Add
      setEntries((prev) => [
        ...prev,
        {
          uid: crypto.randomUUID(),
          tmdbId: result.id,
          title: t,
          notes: '',
          posterUrl: result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null,
          notesOpen: false,
        },
      ])
    }
  }

  function removeEntry(uid: string) {
    setEntries((prev) => prev.filter((e) => e.uid !== uid))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEntries((prev) => {
        const oldIndex = prev.findIndex((e) => e.uid === active.id)
        const newIndex = prev.findIndex((e) => e.uid === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  function updateNotes(uid: string, notes: string) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, notes } : e)))
  }

  function toggleNotes(uid: string) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, notesOpen: !e.notesOpen } : e)))
  }

  const displaySuggestions = searchQuery.trim() ? searchResults : suggestions
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  return (
    <div className="space-y-6">

      {/* ── Ranked list (TOP) ── */}
      <div>
        <p className="text-xs font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--muted)' }}>
          Your List {entries.length > 0 ? `(${entries.length})` : ''}
        </p>

        {entries.length === 0 ? (
          <p className="text-sm py-6 text-center rounded-xl" style={{ color: 'var(--muted)', border: '1px dashed var(--border)' }}>
            Tap a poster below to add it to your list.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entries.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <SortableEntry
                    key={entry.uid}
                    entry={entry}
                    rank={i + 1}
                    onRemove={removeEntry}
                    onNotesChange={updateNotes}
                    onToggleNotes={toggleNotes}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ── Publish ── */}
      {publishError && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
          {publishError}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onBack} disabled={publishing} className="px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-40" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>← Back</button>
        <button
          onClick={onPublish}
          disabled={publishing || entries.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          {publishing ? 'Publishing…' : `Publish List${entries.length > 0 ? ` (${entries.length})` : ''}`}
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>Add {catLabel}</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>

      {/* ── Refine suggestions input ── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          Refine suggestions
        </label>
        <div className="flex gap-2">
          <input
            value={refineInput}
            onChange={(e) => setRefineInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyRefine()}
            placeholder={context.trim() ? context : `e.g. Oscar winners, feel-good ${catLabel}, more like Dune…`}
            maxLength={120}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            onFocus={onFocusAccent}
            onBlur={onBlurBorder}
          />
          <button
            onClick={applyRefine}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            Go
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {refineApplied.trim() && suggestions.length > 0
            ? `Showing results for "${refineApplied}"`
            : refineApplied.trim() && suggestions.length === 0
            ? `No results for "${refineApplied}" — showing defaults`
            : year ? `Popular & top-rated ${catLabel} from ${year}` : `All-time popular & top-rated ${catLabel}`}
        </p>
      </div>

      {/* ── Poster grid ── */}
      {loadingSugg || (searching && searchQuery.trim()) ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : displaySuggestions.length === 0 && (refineApplied.trim() || searchQuery.trim()) ? (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No results found. Try different keywords.</p>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
            {displaySuggestions.map((result) => (
              <PosterTile
                key={result.id}
                result={result}
                added={addedIds.has(result.id)}
                onToggle={toggleEntry}
              />
            ))}
          </div>
          {!searchQuery.trim() && !refineApplied.trim() && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}

      {/* ── Direct search bar (bottom) ── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          Search by title
        </label>
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Find a specific ${category === 'movies' ? 'movie' : 'show'}…`}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            onFocus={onFocusAccent}
            onBlur={onBlurBorder}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>
            {searching ? '⟳' : '⌕'}
          </span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--muted)' }}>✕</button>
          )}
        </div>
        {searchQuery.trim() && !searching && searchResults.length > 0 && (
          <div className="grid gap-2 pt-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
            {searchResults.map((result) => (
              <PosterTile
                key={result.id}
                result={result}
                added={addedIds.has(result.id)}
                onToggle={toggleEntry}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<'movies' | 'tv'>('movies')
  const [year, setYear] = useState<number | null>(null)
  const [allTime, setAllTime] = useState(false)
  const [description, setDescription] = useState('')
  const [context, setContext] = useState('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  async function publish() {
    if (!profile) return
    setPublishing(true)
    setPublishError(null)

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        title: title.trim(),
        category,
        list_type: (!allTime && year) ? 'annual' : 'theme',
        list_format: 'ranked',
        year: (!allTime && year) ? year : null,
        description: description.trim() || null,
        owner_id: profile.id,
      })
      .select()
      .single()

    if (error || !list) {
      setPublishError(`Failed to create list: ${error?.message ?? 'no data returned'} (code: ${error?.code ?? 'none'})`)
      setPublishing(false)
      return
    }

    if (entries.length > 0) {
      const { error: entriesError } = await supabase.from('list_entries').insert(
        entries.map((e, i) => ({
          list_id: list.id,
          rank: i + 1,
          title: e.title,
          notes: e.notes.trim() || null,
          image_url: e.posterUrl || null,
        })),
      )
      if (entriesError) {
        // List was created — redirect anyway, user can add entries via edit
        router.push(`/list/${list.id}`)
        return
      }
    }

    router.push(`/list/${list.id}`)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />
      <div className="max-w-xl mx-auto px-4 py-10">
        <StepIndicator step={step} />
        {step === 1 && (
          <Step1
            title={title} setTitle={setTitle}
            category={category} setCategory={setCategory}
            year={year} setYear={setYear}
            allTime={allTime} setAllTime={setAllTime}
            description={description} setDescription={setDescription}
            context={context} setContext={setContext}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step3
            category={category}
            year={allTime ? null : year}
            context={context}
            entries={entries}
            setEntries={setEntries}
            onPublish={publish}
            onBack={() => setStep(2)}
            publishing={publishing}
            publishError={publishError}
          />
        )}
      </div>
    </div>
  )
}
