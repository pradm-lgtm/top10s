'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  release_date?: string
  first_air_date?: string
}

// ─── TMDB helpers ────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w185'

function tmdbTitle(r: TmdbResult) { return r.title ?? r.name ?? '' }

async function fetchSuggestions(
  category: 'movies' | 'tv',
  year: number | null,
  apiKey: string,
): Promise<TmdbResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearParam = year
    ? category === 'movies' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`
    : ''
  const pages = await Promise.all(
    [1, 2].map((p) =>
      fetch(`${TMDB_BASE}/discover/${type}?api_key=${apiKey}&sort_by=popularity.desc&page=${p}${yearParam}`)
        .then((r) => r.json())
        .then((d) => (d.results ?? []) as TmdbResult[])
        .catch(() => [] as TmdbResult[]),
    ),
  )
  return pages.flat().filter((r) => r.poster_path)
}

async function searchTmdb(
  query: string,
  category: 'movies' | 'tv',
  apiKey: string,
): Promise<TmdbResult[]> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const res = await fetch(
    `${TMDB_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`,
  )
  if (!res.ok) return []
  const data = await res.json()
  return ((data.results ?? []) as TmdbResult[]).filter((r) => r.poster_path)
}

// ─── Auto-detect year & category from title ──────────────────────────────────

function detectFromTitle(t: string) {
  const yearMatch = t.match(/\b(19[5-9]\d|20[0-2]\d)\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null
  const movieKw = /\b(movie|movies|film|films|cinema)\b/i
  const tvKw    = /\b(tv|show|shows|series|television)\b/i
  const category = movieKw.test(t) ? 'movies' : tvKw.test(t) ? 'tv' : null
  return { year, category }
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const labels = ['Name & Category', 'List Format', 'Add Entries']
  return (
    <div className="flex items-center gap-3 mb-10">
      {labels.map((label, i) => {
        const n = i + 1
        const active  = n === step
        const done    = n < step
        return (
          <div key={n} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  background: done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--surface-2)',
                  color: done || active ? '#0a0a0f' : 'var(--muted)',
                  border: done || active ? 'none' : '1px solid var(--border)',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span
                className="text-sm font-medium hidden sm:block"
                style={{ color: active ? 'var(--foreground)' : 'var(--muted)' }}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className="flex-1 h-px w-6" style={{ background: done ? 'var(--accent)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1 — Name & Category ─────────────────────────────────────────────────

function Step1({
  title, setTitle, category, setCategory, year, setYear, allTime, setAllTime, description, setDescription, onNext,
}: {
  title: string; setTitle: (v: string) => void
  category: 'movies' | 'tv'; setCategory: (v: 'movies' | 'tv') => void
  year: number | null; setYear: (v: number | null) => void
  allTime: boolean; setAllTime: (v: boolean) => void
  description: string; setDescription: (v: string) => void
  onNext: () => void
}) {
  function handleTitleChange(v: string) {
    setTitle(v)
    const detected = detectFromTitle(v)
    if (detected.category) setCategory(detected.category as 'movies' | 'tv')
    if (detected.year) { setYear(detected.year); setAllTime(false) }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          List Title
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. My Top 2024 Movies"
          maxLength={120}
          className="w-full px-4 py-3 rounded-xl text-base outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          Category
        </label>
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

      {/* Time scope */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
          Time Scope
        </label>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setAllTime(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: !allTime ? 'var(--accent)' : 'var(--surface)',
              color: !allTime ? '#0a0a0f' : 'var(--muted)',
              border: `1px solid ${!allTime ? 'transparent' : 'var(--border)'}`,
            }}
          >
            Specific Year
          </button>
          <button
            onClick={() => { setAllTime(true); setYear(null) }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: allTime ? 'var(--accent)' : 'var(--surface)',
              color: allTime ? '#0a0a0f' : 'var(--muted)',
              border: `1px solid ${allTime ? 'transparent' : 'var(--border)'}`,
            }}
          >
            All Time
          </button>
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
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        )}
      </div>

      {/* Description */}
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
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
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
      <div
        className="rounded-xl p-6 cursor-default"
        style={{ background: 'var(--surface)', border: `2px solid var(--accent)` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold">Ranked List</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Entries numbered 1 to N, in order of preference</p>
          </div>
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'var(--accent)', color: '#0a0a0f' }}
          >
            ✓
          </div>
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
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl text-sm font-medium"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          Next →
        </button>
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
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: entry.notesOpen ? '12px 12px 0 0' : '12px', borderBottom: entry.notesOpen ? 'none' : undefined }}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none px-1"
          style={{ color: 'var(--muted)', fontSize: '16px', lineHeight: 1 }}
          aria-label="Drag to reorder"
        >
          ⠿
        </button>

        {/* Rank */}
        <span className="text-xs font-bold w-5 shrink-0 text-right" style={{ color: 'var(--accent)' }}>
          {rank}
        </span>

        {/* Poster */}
        {entry.posterUrl && (
          <img src={entry.posterUrl} alt="" className="w-7 h-10 rounded object-cover shrink-0" />
        )}

        {/* Title */}
        <span className="flex-1 text-sm font-medium truncate">{entry.title}</span>

        {/* Notes toggle */}
        <button
          onClick={() => onToggleNotes(entry.uid)}
          className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70 shrink-0"
          style={{ color: entry.notesOpen || entry.notes ? 'var(--accent)' : 'var(--muted)' }}
        >
          {entry.notesOpen ? 'Done' : entry.notes ? 'Note ✎' : '+ Note'}
        </button>

        {/* Remove */}
        <button
          onClick={() => onRemove(entry.uid)}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          ✕
        </button>
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

// ─── Step 3 — Entries ─────────────────────────────────────────────────────────

function Step3({
  category, year, entries, setEntries, onPublish, onBack, publishing,
}: {
  category: 'movies' | 'tv'
  year: number | null
  entries: Entry[]
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>
  onPublish: () => void
  onBack: () => void
  publishing: boolean
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<TmdbResult[]>([])
  const [searchResults, setSearchResults] = useState<TmdbResult[]>([])
  const [loadingSugg, setLoadingSugg] = useState(true)
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''

  const addedTitles = new Set(entries.map((e) => e.title.toLowerCase()))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Load suggestions on mount
  useEffect(() => {
    if (!apiKey || apiKey === 'your-tmdb-api-key') { setLoadingSugg(false); return }
    setLoadingSugg(true)
    fetchSuggestions(category, year, apiKey).then((res) => {
      setSuggestions(res)
      setLoadingSugg(false)
    })
  }, [category, year, apiKey])

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const res = await searchTmdb(query.trim(), category, apiKey)
      setSearchResults(res)
      setSearching(false)
    }, 400)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [query, category, apiKey])

  function addEntry(result: TmdbResult) {
    const title = tmdbTitle(result)
    if (addedTitles.has(title.toLowerCase())) return
    setEntries((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        title,
        notes: '',
        posterUrl: result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null,
        notesOpen: false,
      },
    ])
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

  const displayResults = query.trim() ? searchResults : suggestions

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search for ${category === 'movies' ? 'movies' : 'TV shows'}…`}
          className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>
          {searching ? '⟳' : '⌕'}
        </span>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--muted)' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Section label */}
      <p className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
        {query.trim() ? 'Search Results' : year ? `Popular in ${year}` : 'All-Time Popular'}
      </p>

      {/* Poster grid */}
      <div className="relative">
        {(loadingSugg || searching) && !query.trim() ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : displayResults.length === 0 && query.trim() ? (
          <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>No results found.</p>
        ) : (
          <div
            className="grid gap-2 pb-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}
          >
            {displayResults.map((result) => {
              const t = tmdbTitle(result)
              const added = addedTitles.has(t.toLowerCase())
              return (
                <button
                  key={result.id}
                  onClick={() => !added && addEntry(result)}
                  disabled={added}
                  className="relative rounded-lg overflow-hidden transition-all active:scale-95 group"
                  style={{ aspectRatio: '2/3', opacity: added ? 0.45 : 1, cursor: added ? 'default' : 'pointer' }}
                >
                  {result.poster_path ? (
                    <img
                      src={`${TMDB_IMG}${result.poster_path}`}
                      alt={t}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs p-1 text-center" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                      {t}
                    </div>
                  )}
                  {!added && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xl font-bold">+</span>
                    </div>
                  )}
                  {added && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-lg font-bold">✓</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
            Your List ({entries.length})
          </p>
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
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
          Tap a poster above to add it to your list.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={publishing}
          className="px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-40"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          ← Back
        </button>
        <button
          onClick={onPublish}
          disabled={publishing || entries.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          {publishing ? 'Publishing…' : `Publish List${entries.length > 0 ? ` (${entries.length})` : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function CreatePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState(1)

  // Step 1 state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<'movies' | 'tv'>('movies')
  const [year, setYear] = useState<number | null>(null)
  const [allTime, setAllTime] = useState(false)
  const [description, setDescription] = useState('')

  // Step 3 state
  const [entries, setEntries] = useState<Entry[]>([])
  const [publishing, setPublishing] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [loading, user, router])

  async function publish() {
    if (!profile || entries.length === 0) return
    setPublishing(true)

    const listType = (!allTime && year) ? 'annual' : 'theme'

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        title: title.trim(),
        category,
        list_type: listType,
        list_format: 'ranked',
        year: (!allTime && year) ? year : null,
        description: description.trim() || null,
        owner_id: profile.id,
      })
      .select()
      .single()

    if (error || !list) {
      console.error('Failed to create list:', error)
      setPublishing(false)
      return
    }

    if (entries.length > 0) {
      await supabase.from('list_entries').insert(
        entries.map((e, i) => ({
          list_id: list.id,
          rank: i + 1,
          title: e.title,
          notes: e.notes.trim() || null,
          image_url: e.posterUrl || null,
        })),
      )
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
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            category={category}
            year={allTime ? null : year}
            entries={entries}
            setEntries={setEntries}
            onPublish={publish}
            onBack={() => setStep(2)}
            publishing={publishing}
          />
        )}
      </div>
    </div>
  )
}
