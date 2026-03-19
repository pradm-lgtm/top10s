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
  useDroppable,
  useDraggable,
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
import { RichTextEditor } from '@/components/RichTextEditor'
import type { TiptapDoc } from '@/lib/notes'

// ─── Types ───────────────────────────────────────────────────────────────────

type TierDef = {
  tempId: string
  label: string
  color: string
}

type Entry = {
  uid: string
  tmdbId: number | null
  title: string
  notes: TiptapDoc | null
  posterUrl: string | null
  notesOpen: boolean
  tierId: string | null
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

const TIER_COLOR_PRESETS = [
  '#f59e0b', '#22c55e', '#3b82f6', '#6b7280',
  '#ef4444', '#a78bfa', '#f97316', '#06b6d4', '#ec4899',
]

const DEFAULT_TIERS: TierDef[] = [
  { tempId: 'tier-s', label: 'S', color: '#f59e0b' },
  { tempId: 'tier-a', label: 'A', color: '#22c55e' },
  { tempId: 'tier-b', label: 'B', color: '#3b82f6' },
  { tempId: 'tier-c', label: 'C', color: '#6b7280' },
]

// ─── Auto-detect year & category from title ──────────────────────────────────

const DECADES: { label: string; from: number; to: number }[] = [
  { label: '70s', from: 1970, to: 1979 },
  { label: '80s', from: 1980, to: 1989 },
  { label: '90s', from: 1990, to: 1999 },
  { label: '00s', from: 2000, to: 2009 },
  { label: '10s', from: 2010, to: 2019 },
  { label: '20s', from: 2020, to: 2029 },
]

function detectFromTitle(t: string) {
  const yearMatch = t.match(/\b(19[5-9]\d|20[0-2]\d)\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null
  const decadeMatch = t.match(/\b(70|80|90|00|10|20)s\b/i) ?? t.match(/\b(197|198|199|200|201|202)0s?\b/i)
  const movieKw = /\b(movie|movies|film|films|cinema)\b/i
  const tvKw    = /\b(tv|show|shows|series|television)\b/i
  const category: 'movies' | 'tv' | null = movieKw.test(t) ? 'movies' : tvKw.test(t) ? 'tv' : null
  return { year, decadeMatch: !!decadeMatch, category }
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
  timeScope, setTimeScope, year, setYear, yearFrom, setYearFrom, yearTo, setYearTo,
  description, setDescription,
  onNext,
}: {
  title: string; setTitle: (v: string) => void
  category: 'movies' | 'tv'; setCategory: (v: 'movies' | 'tv') => void
  timeScope: 'all-time' | 'year' | 'range'; setTimeScope: (v: 'all-time' | 'year' | 'range') => void
  year: number | null; setYear: (v: number | null) => void
  yearFrom: number | null; setYearFrom: (v: number | null) => void
  yearTo: number | null; setYearTo: (v: number | null) => void
  description: string; setDescription: (v: string) => void
  onNext: () => void
}) {
  function handleTitleChange(v: string) {
    setTitle(v)
    const detected = detectFromTitle(v)
    if (detected.category) setCategory(detected.category)
    if (detected.year) { setYear(detected.year); setTimeScope('year') }
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

      <div className="space-y-3">
        <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>Time Scope</label>
        <div className="flex gap-2">
          {([
            { value: 'all-time', label: 'All Time' },
            { value: 'year',     label: 'Specific Year' },
            { value: 'range',    label: 'Time Range' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeScope(opt.value)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: timeScope === opt.value ? 'var(--accent)' : 'var(--surface)',
                color: timeScope === opt.value ? '#0a0a0f' : 'var(--muted)',
                border: `1px solid ${timeScope === opt.value ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {timeScope === 'year' && (
          <input
            type="number"
            value={year ?? ''}
            onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : null)}
            placeholder="e.g. 2024"
            min={1920}
            max={new Date().getFullYear() + 1}
            className="w-32 px-4 py-2.5 rounded-xl text-sm outline-none"
            style={inputStyle}
            onFocus={onFocusAccent}
            onBlur={onBlurBorder}
          />
        )}

        {timeScope === 'range' && (
          <div className="space-y-3">
            {/* Decade quick-picks */}
            <div className="flex gap-1.5 flex-wrap">
              {DECADES.map((d) => {
                const active = yearFrom === d.from && yearTo === d.to
                return (
                  <button
                    key={d.label}
                    onClick={() => { setYearFrom(d.from); setYearTo(d.to) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? 'var(--accent)' : 'var(--surface)',
                      color: active ? '#0a0a0f' : 'var(--muted)',
                      border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
            {/* Custom from/to */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={yearFrom ?? ''}
                onChange={(e) => setYearFrom(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="From"
                min={1920}
                max={new Date().getFullYear() + 1}
                className="w-28 px-3 py-2 rounded-xl text-sm outline-none"
                style={inputStyle}
                onFocus={onFocusAccent}
                onBlur={onBlurBorder}
              />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>–</span>
              <input
                type="number"
                value={yearTo ?? ''}
                onChange={(e) => setYearTo(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="To"
                min={1920}
                max={new Date().getFullYear() + 1}
                className="w-28 px-3 py-2 rounded-xl text-sm outline-none"
                style={inputStyle}
                onFocus={onFocusAccent}
                onBlur={onBlurBorder}
              />
            </div>
          </div>
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

function Step2({
  listFormat, setListFormat, tiers, setTiers, onNext, onBack,
}: {
  listFormat: 'ranked' | 'tiered' | 'tiered-ranked'
  setListFormat: (v: 'ranked' | 'tiered' | 'tiered-ranked') => void
  tiers: TierDef[]
  setTiers: (v: TierDef[]) => void
  onNext: () => void
  onBack: () => void
}) {
  const [tierMode, setTierMode] = useState<'standard' | 'custom'>('standard')

  const isTiered = listFormat === 'tiered' || listFormat === 'tiered-ranked'

  function cycleColor(idx: number) {
    setTiers(tiers.map((t, i) => {
      if (i !== idx) return t
      const cur = TIER_COLOR_PRESETS.indexOf(t.color)
      const next = TIER_COLOR_PRESETS[(cur + 1) % TIER_COLOR_PRESETS.length]
      return { ...t, color: next }
    }))
  }

  function updateLabel(idx: number, label: string) {
    setTiers(tiers.map((t, i) => i === idx ? { ...t, label } : t))
  }

  function removeTier(idx: number) {
    setTiers(tiers.filter((_, i) => i !== idx))
  }

  function addTier() {
    const color = TIER_COLOR_PRESETS[tiers.length % TIER_COLOR_PRESETS.length]
    setTiers([...tiers, { tempId: crypto.randomUUID(), label: '', color }])
  }

  function moveTier(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= tiers.length) return
    const arr = [...tiers]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setTiers(arr)
  }

  const formats = [
    {
      value: 'ranked' as const,
      label: 'Ranked',
      desc: 'Entries numbered 1 to N, in order of preference',
      preview: ['Parasite', 'The Godfather', 'Mulholland Drive'],
    },
    {
      value: 'tiered' as const,
      label: 'Tiered',
      desc: 'Group entries into tiers (S/A/B/C) without strict ranking',
      preview: null,
    },
    {
      value: 'tiered-ranked' as const,
      label: 'Tiered + Ranked',
      desc: 'Rank entries within each tier',
      preview: null,
    },
  ]

  return (
    <div className="space-y-4">
      {formats.map((fmt) => {
        const active = listFormat === fmt.value
        return (
          <div
            key={fmt.value}
            className="rounded-xl p-5 cursor-pointer transition-all"
            style={{
              background: 'var(--surface)',
              border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
            }}
            onClick={() => setListFormat(fmt.value)}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-semibold">{fmt.label}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{fmt.desc}</p>
              </div>
              {active && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>✓</div>
              )}
            </div>
            {fmt.preview && (
              <div className="space-y-2 pt-3 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
                {fmt.preview.map((film, i) => (
                  <div key={film} className="flex items-center gap-3 text-sm">
                    <span className="text-xs font-bold w-4" style={{ color: 'var(--accent)' }}>{i + 1}</span>
                    <span style={{ color: 'var(--muted)' }}>{film}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Tier editor */}
      {isTiered && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Tiers</p>
            <div className="flex gap-1">
              {(['standard', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setTierMode(m)
                    if (m === 'standard') setTiers(DEFAULT_TIERS)
                  }}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all capitalize"
                  style={{
                    background: tierMode === m ? 'var(--accent)' : 'var(--surface-2)',
                    color: tierMode === m ? '#0a0a0f' : 'var(--muted)',
                    border: `1px solid ${tierMode === m ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {m === 'standard' ? 'Standard (S/A/B/C)' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {tierMode === 'standard' ? (
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_TIERS.map((t) => (
                <div
                  key={t.tempId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: `${t.color}22`, border: `1px solid ${t.color}55`, color: t.color }}
                >
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {tiers.map((t, idx) => (
                <div key={t.tempId} className="flex items-center gap-2">
                  {/* Up/down */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveTier(idx, -1)}
                      disabled={idx === 0}
                      className="text-xs px-1 disabled:opacity-20"
                      style={{ color: 'var(--muted)' }}
                    >▲</button>
                    <button
                      onClick={() => moveTier(idx, 1)}
                      disabled={idx === tiers.length - 1}
                      className="text-xs px-1 disabled:opacity-20"
                      style={{ color: 'var(--muted)' }}
                    >▼</button>
                  </div>
                  {/* Color swatch */}
                  <button
                    onClick={() => cycleColor(idx)}
                    className="w-7 h-7 rounded shrink-0"
                    style={{ background: t.color, border: '2px solid rgba(255,255,255,0.15)' }}
                    title="Click to change color"
                  />
                  {/* Label */}
                  <input
                    value={t.label}
                    onChange={(e) => updateLabel(idx, e.target.value)}
                    placeholder="Tier label"
                    maxLength={20}
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  />
                  {/* Delete */}
                  <button
                    onClick={() => removeTier(idx)}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                  >✕</button>
                </div>
              ))}
              <button
                onClick={addTier}
                className="w-full py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
                style={{ border: '1px dashed var(--border)', color: 'var(--muted)' }}
              >
                + Add tier
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>← Back</button>
        <button onClick={onNext} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90" style={{ background: 'var(--accent)', color: '#0a0a0f' }}>Next →</button>
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
        Have an existing list to paste?{' '}
        <button onClick={onNext} className="underline transition-opacity hover:opacity-70" style={{ color: 'var(--muted)' }}>
          Skip — import it on the next step
        </button>
      </p>
    </div>
  )
}

// ─── Sortable entry row ───────────────────────────────────────────────────────

function SortableEntry({
  entry, rank, onRemove, onNotesChange, onToggleNotes,
}: {
  entry: Entry; rank: number
  onRemove: (uid: string) => void
  onNotesChange: (uid: string, notes: TiptapDoc | null) => void
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
        <div style={{ borderTop: '1px solid var(--border)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <RichTextEditor
            value={entry.notes}
            onChange={(doc) => onNotesChange(entry.uid, doc)}
            placeholder="Add a note about this entry…"
            autoFocus
            minHeight={56}
          />
        </div>
      )}
    </div>
  )
}

// ─── Genre map ───────────────────────────────────────────────────────────────

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller',
  10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids',
  10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10768: 'War & Politics',
}

// ─── Import helpers ───────────────────────────────────────────────────────────

type ParsedEntry = {
  title: string
  description?: string
  tier?: string
  rank?: number
}

type ParsedList = {
  format: 'ranked' | 'tiered' | 'tiered-ranked' | 'plain'
  tiers: string[]
  entries: ParsedEntry[]
}

type ImportResult = {
  entries: Entry[]
  missed: number
  newFormat?: 'ranked' | 'tiered' | 'tiered-ranked'
  newTiers?: TierDef[]
}

const FORMAT_LABELS: Record<string, string> = {
  ranked: 'Ranked',
  tiered: 'Tiered',
  'tiered-ranked': 'Tiered + Ranked',
  plain: 'Plain',
}

function textToTiptap(text: string): TiptapDoc {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text.trim() }] }] }
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// Extract descriptions from the original pasted text so Claude doesn't need to include them
// (keeping Claude output small means no truncation on long lists).
function extractRawDescriptions(rawText: string, entries: ParsedEntry[], format: string): string[] {
  const descs: string[] = entries.map(() => '')
  if (format === 'ranked') {
    // Split at each "N. " / "N) " boundary
    const sections = rawText.trim().split(/(?=^\s*\d+[\.\)]\s)/m)
    for (const section of sections) {
      const nl = section.indexOf('\n')
      if (nl === -1) continue
      const firstLine = section.slice(0, nl).trim()
      const rest = section.slice(nl + 1).trim()
      const rankMatch = firstLine.match(/^(\d+)[\.\)]\s+(.+)$/)
      if (!rankMatch) continue
      const lineTitle = rankMatch[2].trim()
      const idx = entries.findIndex((e) =>
        e.title.toLowerCase() === lineTitle.toLowerCase() ||
        lineTitle.toLowerCase().includes(e.title.toLowerCase()),
      )
      if (idx !== -1) descs[idx] = rest
    }
  } else {
    // For tiered / plain: find each title as its own line and extract until the next
    const lines = rawText.split('\n')
    for (let i = 0; i < entries.length; i++) {
      const titleLower = entries[i].title.toLowerCase()
      const lineIdx = lines.findIndex((l) => l.trim().toLowerCase() === titleLower)
      if (lineIdx === -1) continue
      // Collect lines after the title until the next entry title or tier header
      const descLines: string[] = []
      for (let j = lineIdx + 1; j < lines.length; j++) {
        const l = lines[j].trim().toLowerCase()
        const isNextTitle = entries.some((e, ei) => ei !== i && l === e.title.toLowerCase())
        const isTierHeader = /^[a-z][\w\s]{0,20}tier\s*$|^s$|^a$|^b$|^c$|^d$/i.test(lines[j].trim())
        if (isNextTitle || isTierHeader) break
        descLines.push(lines[j])
      }
      descs[i] = descLines.join('\n').trim()
    }
  }
  return descs
}

async function tmdbSearchForImport(
  title: string, category: 'movies' | 'tv', yearFrom: number | null, yearTo: number | null, apiKey: string,
): Promise<{ id: number; title?: string; name?: string; poster_path: string | null } | null> {
  const type = category === 'movies' ? 'movie' : 'tv'
  const yearHint = yearFrom !== null && yearTo !== null && yearFrom === yearTo ? yearFrom : null
  const yearParam = yearHint
    ? category === 'movies' ? `&year=${yearHint}` : `&first_air_date_year=${yearHint}`
    : ''
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1${yearParam}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.results ?? []).filter((r: { poster_path: string | null }) => r.poster_path)
    if (results.length === 0) return null
    // TMDB relevance can surface obscure exact-name matches over famous films.
    // 1) Prefer results whose title is an exact match for the query.
    // 2) Break ties by vote_count so the most well-known film wins.
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    const qNorm = normalize(title)
    results.sort((a: { title?: string; name?: string; vote_count?: number }, b: { title?: string; name?: string; vote_count?: number }) => {
      const aExact = normalize(a.title ?? a.name ?? '') === qNorm ? 1 : 0
      const bExact = normalize(b.title ?? b.name ?? '') === qNorm ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      return (b.vote_count ?? 0) - (a.vote_count ?? 0)
    })
    return results[0]
  } catch { return null }
}

// ─── TierEntryCard (draggable poster in tier row) ────────────────────────────

function TierEntryCard({
  entry, color, rank, onRemove,
}: {
  entry: Entry
  color: string
  rank?: number
  onRemove: (uid: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.uid })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="relative flex flex-col items-center gap-1 touch-none select-none"
      style={{ opacity: isDragging ? 0.35 : 1, cursor: isDragging ? 'grabbing' : 'grab', transform: transform ? CSS.Translate.toString(transform) : undefined, zIndex: isDragging ? 50 : 'auto' }}
    >
      <div className="relative" style={{ width: 50, height: 74 }}>
        {entry.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.posterUrl} alt={entry.title} className="w-full h-full object-cover rounded" draggable={false}
            style={{ border: `1px solid ${color}55`, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
        ) : (
          <div className="w-full h-full rounded flex items-end justify-center pb-1"
            style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
            <span className="text-[8px] text-center px-0.5 leading-tight" style={{ color: `${color}99` }}>{entry.title}</span>
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute top-0.5 left-0.5 text-[9px] font-black px-1 rounded"
            style={{ background: `${color}dd`, color: '#0a0a0f', lineHeight: '14px' }}>{rank}</span>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(entry.uid) }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center"
          style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}
        >✕</button>
      </div>
      <span className="text-center leading-tight" style={{
        fontSize: '0.58rem', color: 'var(--muted)', width: 50,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
      }}>{entry.title}</span>
    </div>
  )
}

// ─── DroppableTier ────────────────────────────────────────────────────────────

function DroppableTier({
  tier, entries, listFormat, onRemove,
}: {
  tier: TierDef
  entries: Entry[]
  listFormat: 'tiered' | 'tiered-ranked'
  onRemove: (uid: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.tempId })
  return (
    <div ref={setNodeRef} className="flex items-stretch rounded-xl overflow-hidden min-h-[80px] transition-all duration-150"
      style={{
        border: `1px solid ${isOver ? tier.color : `${tier.color}44`}`,
        background: isOver ? `${tier.color}1a` : `${tier.color}08`,
        boxShadow: isOver ? `0 0 16px ${tier.color}30` : 'none',
      }}>
      <div className="flex items-center justify-center shrink-0 w-14"
        style={{ borderRight: `2px solid ${tier.color}40`, background: `${tier.color}15` }}>
        <span className="text-lg font-black" style={{ color: tier.color }}>{tier.label || '?'}</span>
      </div>
      <div className="flex flex-wrap gap-2 p-2.5 items-center flex-1 min-h-[80px]">
        {entries.length === 0 ? (
          <span className="text-xs italic" style={{ color: `${tier.color}55` }}>Empty</span>
        ) : (
          entries.map((entry, i) => (
            <TierEntryCard key={entry.uid} entry={entry} color={tier.color}
              rank={listFormat === 'tiered-ranked' ? i + 1 : undefined} onRemove={onRemove} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Add Entry Bottom Sheet ───────────────────────────────────────────────────

type SheetState = {
  result: import('@/components/ThoughtCloud').CloudResult
  alreadyAdded: boolean
  existingNotes: TiptapDoc | null
}

function AddEntrySheet({
  sheet, tiers, listFormat, onAddRanked, onAddToTier, onRemove, onUpdateNotes, onClose,
}: {
  sheet: SheetState | null
  tiers: TierDef[]
  listFormat: 'ranked' | 'tiered' | 'tiered-ranked'
  onAddRanked: (result: import('@/components/ThoughtCloud').CloudResult, notes: TiptapDoc | null) => void
  onAddToTier: (result: import('@/components/ThoughtCloud').CloudResult, tierId: string, notes: TiptapDoc | null) => void
  onRemove: (result: import('@/components/ThoughtCloud').CloudResult) => void
  onUpdateNotes: (result: import('@/components/ThoughtCloud').CloudResult, notes: TiptapDoc | null) => void
  onClose: () => void
}) {
  const isOpen = sheet !== null
  const isTiered = listFormat === 'tiered' || listFormat === 'tiered-ranked'
  const [notes, setNotes] = useState<TiptapDoc | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync notes when sheet changes (new selection or pre-fill for existing)
  useEffect(() => {
    setNotes(sheet?.existingNotes ?? null)
  }, [sheet?.result.id, sheet?.existingNotes])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Keyboard-aware positioning on mobile (visualViewport API)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onViewportChange() {
      if (!panelRef.current || !vv) return
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      panelRef.current.style.bottom = `${offset}px`
    }
    vv.addEventListener('resize', onViewportChange)
    vv.addEventListener('scroll', onViewportChange)
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
    }
  }, [])

  const title = sheet ? (sheet.result.title ?? sheet.result.name ?? '') : ''
  const posterUrl = sheet?.result.poster_path ? `${TMDB_IMG}${sheet.result.poster_path}` : null
  const year = (sheet?.result.release_date ?? sheet?.result.first_air_date ?? '').slice(0, 4)
  const genres = (sheet?.result.genre_ids ?? []).slice(0, 3).map((id) => GENRE_MAP[id]).filter(Boolean)

  function notesHaveContent(n: TiptapDoc | null): boolean {
    if (!n) return false
    function hasText(node: { type: string; text?: string; content?: typeof node[] }): boolean {
      if (node.type === 'text' && node.text) return true
      return (node.content ?? []).some(hasText)
    }
    return hasText(n as Parameters<typeof hasText>[0])
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{
          background: 'var(--surface)',
          maxHeight: '88vh',
          overflowY: 'auto',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0" style={{ background: 'var(--surface)' }}>
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {sheet && (
          <div className="px-5 pb-10 pt-4 space-y-6">
            {/* Movie info row */}
            <div className="flex gap-4 items-start">
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl} alt={title} className="rounded-xl object-cover shrink-0"
                  style={{ width: 80, height: 120, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
              ) : (
                <div className="rounded-xl shrink-0 flex items-center justify-center"
                  style={{ width: 80, height: 120, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <span className="text-3xl">🎬</span>
                </div>
              )}
              <div className="pt-1 min-w-0">
                <h3 className="text-xl font-bold leading-tight">{title}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {year && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{year}</span>
                  )}
                  {genres.map((g) => (
                    <span key={g} className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{g}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Note field */}
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
                Add a note (optional)
              </label>
              <RichTextEditor
                value={notes}
                onChange={(doc) => setNotes(doc)}
                placeholder="What makes this one special?"
                minHeight={72}
              />
            </div>

            {/* Action area */}
            {sheet.alreadyAdded ? (
              <div className="space-y-3">
                <button
                  onClick={() => { onUpdateNotes(sheet.result, notesHaveContent(notes) ? notes : null); onClose() }}
                  className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.97]"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  Save note
                </button>
                <button
                  onClick={() => { onRemove(sheet.result); onClose() }}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                >
                  Remove from list
                </button>
              </div>
            ) : isTiered ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-widest uppercase text-center" style={{ color: 'var(--muted)' }}>
                  Add to tier
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(tiers.length, 4)}, 1fr)` }}>
                  {tiers.map((tier) => (
                    <button
                      key={tier.tempId}
                      onClick={() => { onAddToTier(sheet.result, tier.tempId, notesHaveContent(notes) ? notes : null); onClose() }}
                      className="py-5 rounded-2xl text-2xl font-black transition-all active:scale-95"
                      style={{
                        background: `${tier.color}20`,
                        border: `2px solid ${tier.color}80`,
                        color: tier.color,
                        minHeight: 72,
                      }}
                    >
                      {tier.label || '?'}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                onClick={() => { onAddRanked(sheet.result, notesHaveContent(notes) ? notes : null); onClose() }}
                className="w-full py-5 rounded-2xl text-lg font-bold transition-all active:scale-[0.97]"
                style={{ background: 'var(--accent)', color: '#0a0a0f' }}
              >
                Add to list
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

type ImportPhase = 'idle' | 'parsing' | 'conflict' | 'resolving'

function ImportModal({
  open, onClose, listFormat, tiers, category, yearFrom, yearTo, onImport,
}: {
  open: boolean
  onClose: () => void
  listFormat: 'ranked' | 'tiered' | 'tiered-ranked'
  tiers: TierDef[]
  category: 'movies' | 'tv'
  yearFrom: number | null
  yearTo: number | null
  onImport: (result: ImportResult) => void
}) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<ImportPhase>('idle')
  const [parsed, setParsed] = useState<ParsedList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setText(''); setParsed(null); setError(null); setPhase('idle') }
  }, [open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function resolveAndImport(p: ParsedList, targetFormat: 'ranked' | 'tiered' | 'tiered-ranked', targetTiers: TierDef[], rawText: string) {
    setPhase('resolving')

    // For tiered imports: always derive TierDefs from the parsed tier labels so the
    // user never needs to pre-create matching tiers in Step 2.
    let effectiveTiers = targetTiers
    let autoTiers: TierDef[] | undefined
    if ((targetFormat === 'tiered' || targetFormat === 'tiered-ranked') && p.tiers.length > 0) {
      autoTiers = p.tiers.map((label, i) => ({
        tempId: crypto.randomUUID(),
        label,
        color: TIER_COLOR_PRESETS[i % TIER_COLOR_PRESETS.length],
      }))
      effectiveTiers = autoTiers
    }

    // Extract descriptions from the raw text client-side (Claude no longer includes them)
    const rawDescs = extractRawDescriptions(rawText, p.entries, p.format)

    // Resolve all titles via TMDB in batches of 8
    const allResolved: ({ id: number; title?: string; name?: string; poster_path: string | null } | null)[] = []
    for (let i = 0; i < p.entries.length; i += 8) {
      const batch = p.entries.slice(i, i + 8)
      const results = await Promise.all(
        batch.map((e) => tmdbSearchForImport(e.title, category, yearFrom, yearTo, apiKey)),
      )
      allResolved.push(...results)
    }

    const importedEntries: Entry[] = []
    let missed = 0
    for (let i = 0; i < p.entries.length; i++) {
      const parsedEntry = p.entries[i]
      const tmdb = allResolved[i]
      if (!tmdb) { missed++; continue }

      let tierId: string | null = null
      if (parsedEntry.tier && (targetFormat === 'tiered' || targetFormat === 'tiered-ranked')) {
        const matched = effectiveTiers.find((t) => t.label.toLowerCase() === parsedEntry.tier!.toLowerCase())
        tierId = matched?.tempId ?? null
      }

      const desc = rawDescs[i]
      importedEntries.push({
        uid: crypto.randomUUID(),
        tmdbId: tmdb.id,
        title: tmdb.title ?? tmdb.name ?? parsedEntry.title,
        notes: desc ? textToTiptap(desc) : null,
        posterUrl: tmdb.poster_path ? `${TMDB_IMG}${tmdb.poster_path}` : null,
        notesOpen: false,
        tierId,
      })
    }

    onImport({
      entries: importedEntries,
      missed,
      newFormat: targetFormat !== listFormat ? targetFormat : undefined,
      newTiers: autoTiers ?? (targetFormat !== listFormat ? targetTiers : undefined),
    })
    onClose()
  }

  async function handleImport() {
    if (!text.trim()) return
    setError(null)
    setPhase('parsing')
    try {
      const res = await fetch('/api/claude/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, category }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error === 'parse_failed'
          ? "Couldn't read that list — try one title per line"
          : 'Something went wrong. Please try again.')
        setPhase('idle')
        return
      }
      const p: ParsedList = await res.json()
      setParsed(p)

      // 'plain' is always compatible with any format
      const hasConflict = p.format !== 'plain' && p.format !== listFormat
      if (hasConflict) {
        setPhase('conflict')
      } else {
        await resolveAndImport(p, listFormat, tiers, text)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setPhase('idle')
    }
  }

  async function handleSwitchFormat() {
    if (!parsed) return
    const newTiers = (parsed.tiers.length > 0 ? parsed.tiers : ['S', 'A', 'B', 'C']).map((label, i) => ({
      tempId: crypto.randomUUID(),
      label,
      color: TIER_COLOR_PRESETS[i % TIER_COLOR_PRESETS.length],
    }))
    const targetFormat = (parsed.format === 'plain' ? listFormat : parsed.format) as 'ranked' | 'tiered' | 'tiered-ranked'
    await resolveAndImport(parsed, targetFormat, newTiers, text)
  }

  async function handleImportAnyway() {
    if (!parsed) return
    await resolveAndImport(parsed, listFormat, tiers, text)
  }

  const busy = phase === 'parsing' || phase === 'resolving'
  const detectedLabel = parsed ? FORMAT_LABELS[parsed.format] : ''
  const chosenLabel = FORMAT_LABELS[listFormat]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={!busy ? onClose : undefined}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl"
        style={{
          background: 'var(--surface)',
          maxHeight: '92vh',
          overflowY: 'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="px-5 pb-10 pt-3 space-y-5">

          {phase === 'resolving' ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Matching titles…</p>
            </div>
          ) : phase === 'conflict' && parsed ? (
            <>
              <div>
                <h2 className="text-xl font-bold">Format mismatch</h2>
                <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
                  This looks like a <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{detectedLabel}</span> list,
                  but you&apos;re creating a <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{chosenLabel}</span> list.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSwitchFormat}
                  className="w-full py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.97]"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  Switch to {detectedLabel}
                </button>
                <button
                  onClick={handleImportAnyway}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  Import as {chosenLabel} anyway
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-bold">Paste your list</h2>
                <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
                  Paste a list in any format — numbered, bulleted, tiered, or one title per line. Descriptions are supported too.
                </p>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`1. The Godfather\nBest movie ever made\n\n2. Goodfellas\nScorsese at his peak\n\nor tiered:\nS Tier\nThe Godfather\nGoodfellas\n\nA Tier\nCasino`}
                rows={12}
                className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none font-mono"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)', lineHeight: 1.6 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />

              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                  {error}
                </p>
              )}

              <button
                onClick={handleImport}
                disabled={!text.trim() || busy}
                className="w-full py-4 rounded-2xl text-base font-bold disabled:opacity-40 transition-all active:scale-[0.97]"
                style={{ background: 'var(--accent)', color: '#0a0a0f' }}
              >
                {phase === 'parsing' ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 animate-spin inline-block" style={{ borderColor: '#0a0a0f', borderTopColor: 'transparent' }} />
                    Reading…
                  </span>
                ) : 'Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Step 3 — Entries ─────────────────────────────────────────────────────────

function Step3({
  listTitle, category, yearFrom, yearTo, description,
  listFormat, setListFormat, tiers, setTiers,
  entries, setEntries,
  onPublish, onBack, publishing, publishError,
}: {
  listTitle: string
  category: 'movies' | 'tv'
  yearFrom: number | null
  yearTo: number | null
  description: string
  listFormat: 'ranked' | 'tiered' | 'tiered-ranked'
  setListFormat: (v: 'ranked' | 'tiered' | 'tiered-ranked') => void
  tiers: TierDef[]
  setTiers: (v: TierDef[]) => void
  entries: Entry[]
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>
  onPublish: () => void
  onBack: () => void
  publishing: boolean
  publishError: string | null
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [editingTiers, setEditingTiers] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; missed: number } | null>(null)

  useEffect(() => {
    if (!importResult) return
    const t = setTimeout(() => setImportResult(null), 5000)
    return () => clearTimeout(t)
  }, [importResult])

  function handleImport({ entries: newEntries, missed, newFormat, newTiers }: ImportResult) {
    if (newFormat) setListFormat(newFormat)
    if (newTiers) setTiers(newTiers)
    setEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.tmdbId).filter(Boolean))
      return [...prev, ...newEntries.filter((e) => !existingIds.has(e.tmdbId))]
    })
    setImportResult({ imported: newEntries.length, missed })
  }

  const isTiered = listFormat === 'tiered' || listFormat === 'tiered-ranked'
  const addedTmdbIds = new Set(entries.map((e) => e.tmdbId).filter(Boolean) as number[])
  const catLabel = category === 'movies' ? 'movies' : 'shows'

  // Open bottom sheet instead of directly toggling
  function handleCloudToggle(result: CloudResult) {
    const existing = entries.find((e) => e.tmdbId === result.id)
    setSheet({ result, alreadyAdded: addedTmdbIds.has(result.id), existingNotes: existing?.notes ?? null })
  }

  function addRanked(result: CloudResult, notes: TiptapDoc | null) {
    setEntries((prev) => [...prev, {
      uid: crypto.randomUUID(),
      tmdbId: result.id,
      title: result.title ?? result.name ?? '',
      notes,
      posterUrl: result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null,
      notesOpen: false,
      tierId: null,
    }])
  }

  function addToTier(result: CloudResult, tierId: string, notes: TiptapDoc | null) {
    setEntries((prev) => [...prev, {
      uid: crypto.randomUUID(),
      tmdbId: result.id,
      title: result.title ?? result.name ?? '',
      notes,
      posterUrl: result.poster_path ? `${TMDB_IMG}${result.poster_path}` : null,
      notesOpen: false,
      tierId,
    }])
  }

  function updateNotesByResult(result: CloudResult, notes: TiptapDoc | null) {
    setEntries((prev) => prev.map((e) => e.tmdbId === result.id ? { ...e, notes } : e))
  }

  function removeByResult(result: CloudResult) {
    setEntries((prev) => prev.filter((e) => e.tmdbId !== result.id))
  }

  function removeEntry(uid: string) {
    setEntries((prev) => prev.filter((e) => e.uid !== uid))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    if (listFormat === 'ranked') {
      if (activeId !== overId) {
        setEntries((prev) => {
          const oldIndex = prev.findIndex((e) => e.uid === activeId)
          const newIndex = prev.findIndex((e) => e.uid === overId)
          return arrayMove(prev, oldIndex, newIndex)
        })
      }
      return
    }

    // Tiered: move between tier zones
    const overTier = tiers.find((t) => t.tempId === overId)
    if (overTier) {
      setEntries((prev) => prev.map((e) => e.uid === activeId ? { ...e, tierId: overTier.tempId } : e))
    }
  }

  function updateNotes(uid: string, notes: TiptapDoc | null) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, notes } : e)))
  }

  function toggleNotes(uid: string) {
    setEntries((prev) => prev.map((e) => (e.uid === uid ? { ...e, notesOpen: !e.notesOpen } : e)))
  }

  // Tier editor helpers
  function cycleColor(idx: number) {
    setTiers(tiers.map((t, i) => {
      if (i !== idx) return t
      const cur = TIER_COLOR_PRESETS.indexOf(t.color)
      return { ...t, color: TIER_COLOR_PRESETS[(cur + 1) % TIER_COLOR_PRESETS.length] }
    }))
  }
  function updateTierLabel(idx: number, label: string) {
    setTiers(tiers.map((t, i) => i === idx ? { ...t, label } : t))
  }
  function removeTier(idx: number) {
    const removed = tiers[idx]
    setTiers(tiers.filter((_, i) => i !== idx))
    setEntries((prev) => prev.map((e) => e.tierId === removed.tempId ? { ...e, tierId: null } : e))
  }
  function addTier() {
    const color = TIER_COLOR_PRESETS[tiers.length % TIER_COLOR_PRESETS.length]
    setTiers([...tiers, { tempId: crypto.randomUUID(), label: '', color }])
  }
  function moveTier(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= tiers.length) return
    const arr = [...tiers]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setTiers(arr)
  }

  const poolEntries = entries.filter((e) => e.tierId === null)

  return (
    <div className="space-y-6">

      {/* ── Bottom sheet (always rendered for animation) ── */}
      <AddEntrySheet
        sheet={sheet}
        tiers={tiers}
        listFormat={listFormat}
        onAddRanked={addRanked}
        onAddToTier={addToTier}
        onRemove={removeByResult}
        onUpdateNotes={updateNotesByResult}
        onClose={() => setSheet(null)}
      />

      {/* ── Import modal ── */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        listFormat={listFormat}
        tiers={tiers}
        category={category}
        yearFrom={yearFrom}
        yearTo={yearTo}
        onImport={handleImport}
      />

      {/* ── Import success toast ── */}
      {importResult && (
        <div
          className="px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
        >
          <span>
            {importResult.imported} title{importResult.imported !== 1 ? 's' : ''} imported
            {importResult.missed > 0 && (
              <span style={{ color: 'var(--muted)' }}> · {importResult.missed} couldn&apos;t be matched on TMDB</span>
            )}
          </span>
          <button onClick={() => setImportResult(null)} style={{ color: 'var(--muted)', fontSize: 12 }}>✕</button>
        </div>
      )}

      {/* ── Tier list ── */}
      {isTiered ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
              Your List {entries.length > 0 ? `(${entries.length})` : ''}
            </p>
            <button
              onClick={() => setEditingTiers((v) => !v)}
              className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              {editingTiers ? 'Done' : '✎ Edit tiers'}
            </button>
          </div>

          {editingTiers && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {tiers.map((t, idx) => (
                <div key={t.tempId} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveTier(idx, -1)} disabled={idx === 0} className="text-xs px-1 disabled:opacity-20" style={{ color: 'var(--muted)' }}>▲</button>
                    <button onClick={() => moveTier(idx, 1)} disabled={idx === tiers.length - 1} className="text-xs px-1 disabled:opacity-20" style={{ color: 'var(--muted)' }}>▼</button>
                  </div>
                  <button onClick={() => cycleColor(idx)} className="w-6 h-6 rounded shrink-0" style={{ background: t.color, border: '2px solid rgba(255,255,255,0.15)' }} />
                  <input value={t.label} onChange={(e) => updateTierLabel(idx, e.target.value)} placeholder="Tier label" maxLength={20}
                    className="flex-1 px-2 py-1 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                  <button onClick={() => removeTier(idx)} className="w-6 h-6 flex items-center justify-center rounded-full text-xs hover:opacity-70"
                    style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>✕</button>
                </div>
              ))}
              <button onClick={addTier} className="w-full py-1.5 rounded-lg text-sm hover:opacity-70"
                style={{ border: '1px dashed var(--border)', color: 'var(--muted)' }}>+ Add tier</button>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="text-sm py-5 text-center rounded-xl" style={{ color: 'var(--muted)', border: '1px dashed var(--border)' }}>
              Tap a poster below to add it to a tier
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <DroppableTier
                    key={tier.tempId}
                    tier={tier}
                    entries={entries.filter((e) => e.tierId === tier.tempId)}
                    listFormat={listFormat as 'tiered' | 'tiered-ranked'}
                    onRemove={removeEntry}
                  />
                ))}
                {/* Unassigned entries (e.g. after a tier is deleted) */}
                {poolEntries.length > 0 && (
                  <div className="rounded-xl p-3 space-y-1" style={{ border: '1px dashed var(--border)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Unassigned</p>
                    <div className="flex flex-wrap gap-2">
                      {poolEntries.map((e) => (
                        <TierEntryCard key={e.uid} entry={e} color="#6b7280" onRemove={removeEntry} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DndContext>
          )}
        </div>
      ) : (
        /* ── Ranked list ── */
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--muted)' }}>
            Your List {entries.length > 0 ? `(${entries.length})` : ''}
          </p>
          {entries.length === 0 ? (
            <p className="text-sm py-6 text-center rounded-xl" style={{ color: 'var(--muted)', border: '1px dashed var(--border)' }}>
              Tap a poster below to add it to your list
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map((e) => e.uid)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {entries.map((entry, i) => (
                    <SortableEntry key={entry.uid} entry={entry} rank={i + 1} onRemove={removeEntry}
                      onNotesChange={updateNotes} onToggleNotes={toggleNotes} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

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

      {/* ── Add section ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <span className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>Add {catLabel}</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        <button
          onClick={() => setImportOpen(true)}
          className="text-xs px-2.5 py-1 rounded-lg shrink-0 transition-opacity hover:opacity-70"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          Import list
        </button>
      </div>

      <ThoughtCloud
        listTitle={listTitle}
        category={category}
        yearFrom={yearFrom}
        yearTo={yearTo}
        description={description}
        addedIds={addedTmdbIds}
        addedEntries={entries.map((e) => e.title)}
        onToggle={handleCloudToggle}
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
  const [timeScope, setTimeScope] = useState<'all-time' | 'year' | 'range'>('all-time')
  const [year, setYear] = useState<number | null>(null)
  const [yearFrom, setYearFrom] = useState<number | null>(null)
  const [yearTo, setYearTo] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [listFormat, setListFormat] = useState<'ranked' | 'tiered' | 'tiered-ranked'>('ranked')
  const [tiers, setTiers] = useState<TierDef[]>(DEFAULT_TIERS)
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

    const resolvedYear = timeScope === 'year' ? year : null
    const resolvedYearFrom = timeScope === 'range' ? yearFrom : null
    const resolvedYearTo = timeScope === 'range' ? yearTo : null

    const { data: list, error } = await supabase
      .from('lists')
      .insert({
        title: title.trim(),
        category,
        list_type: timeScope === 'year' ? 'annual' : 'theme',
        list_format: listFormat,
        year: resolvedYear,
        year_from: resolvedYearFrom,
        year_to: resolvedYearTo,
        description: description.trim() || null,
        owner_id: profile.id,
      })
      .select()
      .single()

    if (error || !list) {
      setPublishError(`Failed to create list: ${error?.message ?? 'no data returned'}`)
      setPublishing(false)
      return
    }

    // For tiered lists: insert tiers first, then entries with tier_id
    if (listFormat !== 'ranked' && entries.length > 0) {
      const { data: insertedTiers, error: tierError } = await supabase
        .from('tiers')
        .insert(tiers.map((t, i) => ({ list_id: list.id, label: t.label, color: t.color, position: i })))
        .select()

      if (tierError || !insertedTiers) {
        setPublishError('Failed to create tiers')
        setPublishing(false)
        return
      }

      // Map tempId → real DB tier id
      const tierIdMap = new Map(tiers.map((t, i) => [t.tempId, insertedTiers[i].id]))

      // Calculate rank within tier for tiered-ranked
      const tierRankCounters = new Map<string, number>()
      const entriesToInsert = entries.map((e) => {
        let rank: number | null = null
        if (listFormat === 'tiered-ranked' && e.tierId) {
          const prev = tierRankCounters.get(e.tierId) ?? 0
          rank = prev + 1
          tierRankCounters.set(e.tierId, rank)
        }
        return {
          list_id: list.id,
          tier_id: e.tierId ? tierIdMap.get(e.tierId) ?? null : null,
          rank,
          title: e.title,
          notes: e.notes ? JSON.stringify(e.notes) : null,
          image_url: e.posterUrl || null,
        }
      })

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      for (const entryData of entriesToInsert) {
        const res = await fetch(`/api/lists/${list.id}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(entryData),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setPublishError(`Failed to add entry "${entryData.title}": ${err.error ?? 'unknown error'}`)
          setPublishing(false)
          return
        }
      }
    } else if (listFormat === 'ranked' && entries.length > 0) {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const rankedEntries = entries.map((e, i) => ({
        list_id: list.id,
        rank: i + 1,
        tier_id: null,
        title: e.title,
        notes: e.notes ? JSON.stringify(e.notes) : null,
        image_url: e.posterUrl || null,
      }))
      for (const entryData of rankedEntries) {
        const res = await fetch(`/api/lists/${list.id}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(entryData),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setPublishError(`Failed to add entry "${entryData.title}": ${err.error ?? 'unknown error'}`)
          setPublishing(false)
          return
        }
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
            timeScope={timeScope} setTimeScope={setTimeScope}
            year={year} setYear={setYear}
            yearFrom={yearFrom} setYearFrom={setYearFrom}
            yearTo={yearTo} setYearTo={setYearTo}
            description={description} setDescription={setDescription}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2
            listFormat={listFormat}
            setListFormat={setListFormat}
            tiers={tiers}
            setTiers={setTiers}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            listTitle={title}
            category={category}
            yearFrom={timeScope === 'year' ? (year ?? null) : timeScope === 'range' ? yearFrom : null}
            yearTo={timeScope === 'year' ? (year ?? null) : timeScope === 'range' ? yearTo : null}
            description={description}
            listFormat={listFormat}
            setListFormat={setListFormat}
            tiers={tiers}
            setTiers={setTiers}
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
