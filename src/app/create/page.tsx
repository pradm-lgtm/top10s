'use client'

import { useState, useEffect } from 'react'
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
import { ThoughtCloud } from '@/components/ThoughtCloud'
import type { CloudResult } from '@/components/ThoughtCloud'

// ─── Types ───────────────────────────────────────────────────────────────────

type Entry = {
  uid: string
  tmdbId: number | null
  title: string
  notes: string
  posterUrl: string | null
  notesOpen: boolean
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

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
  onNext,
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

// ─── Step 3 — Entries ─────────────────────────────────────────────────────────

function Step3({
  listTitle, category, year, description, entries, setEntries,
  onPublish, onBack, publishing, publishError,
}: {
  listTitle: string
  category: 'movies' | 'tv'
  year: number | null
  description: string
  entries: Entry[]
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>
  onPublish: () => void
  onBack: () => void
  publishing: boolean
  publishError: string | null
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const addedIds = new Set(entries.map((e) => e.tmdbId).filter(Boolean) as number[])
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  function toggleEntry(result: CloudResult) {
    const t = result.title ?? result.name ?? ''
    if (addedIds.has(result.id)) {
      setEntries((prev) => prev.filter((e) => e.tmdbId !== result.id))
    } else {
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

  return (
    <div className="space-y-6">

      {/* ── Ranked list ── */}
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

      {/* ── Thought Cloud ── */}
      <ThoughtCloud
        listTitle={listTitle}
        category={category}
        year={year}
        description={description}
        addedIds={addedIds}
        onToggle={toggleEntry}
      />
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
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <Step3
            listTitle={title}
            category={category}
            year={allTime ? null : year}
            description={description}
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
