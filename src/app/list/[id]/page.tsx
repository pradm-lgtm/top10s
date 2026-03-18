'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchPosters } from '@/lib/tmdb'
import { useAdmin } from '@/context/admin'
import { useAuth } from '@/context/auth'
import { EditableText } from '@/components/EditableText'
import { EntryDrawer } from '@/components/EntryDrawer'
import type { PosterInfo } from '@/lib/tmdb'
import type { List, ListEntry, Tier, Comment, ReactionCount, HonorableMention, AlsoWatched } from '@/types'

const EMOJIS = ['🔥', '❤️', '😮', '😂', '👏']

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [list, setList] = useState<List | null>(null)
  const [entries, setEntries] = useState<ListEntry[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [reactions, setReactions] = useState<ReactionCount[]>([])
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [honorableMentions, setHonorableMentions] = useState<HonorableMention[]>([])
  const [alsoWatched, setAlsoWatched] = useState<AlsoWatched[]>([])
  const [hmOpen, setHmOpen] = useState(false)
  const [awOpen, setAwOpen] = useState(false)
  const [posters, setPosters] = useState<Record<string, PosterInfo>>({})
  const [loading, setLoading] = useState(true)
  const [visitorId, setVisitorId] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [addingEntry, setAddingEntry] = useState(false)
  const [newEntryTitle, setNewEntryTitle] = useState('')
  const [newEntryRank, setNewEntryRank] = useState('')
  const [newEntryNotes, setNewEntryNotes] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [commentNameInput, setCommentNameInput] = useState('')
  const [pendingListReaction, setPendingListReaction] = useState<string | null>(null)
  const [listReactionNameInput, setListReactionNameInput] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<ListEntry | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [entryReactions, setEntryReactions] = useState<Record<string, Record<string, number>>>({})
  const { isAdmin } = useAdmin()
  const { user } = useAuth()
  const [isOwner, setIsOwner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem('visitor_name')
    const vid = localStorage.getItem('visitor_id') ?? ''
    if (name) setVisitorName(name)
    if (vid) setVisitorId(vid)
    fetchAll(vid)
  }, [id])

  async function fetchAll(vid: string) {
    const [listRes, entriesRes, commentsRes, reactionsRes, hmRes, awRes, tiersRes] = await Promise.all([
      supabase.from('lists').select('*').eq('id', id).single(),
      supabase.from('list_entries').select('*').eq('list_id', id).order('rank'),
      supabase
        .from('comments')
        .select('*, visitors(name)')
        .eq('list_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('reactions').select('emoji, visitor_id').eq('list_id', id),
      supabase.from('honorable_mentions').select('*').eq('list_id', id).order('created_at'),
      supabase.from('also_watched').select('*').eq('list_id', id).order('created_at'),
      supabase.from('tiers').select('*').eq('list_id', id).order('position'),
    ])

    if (listRes.data) {
      setList(listRes.data)
      setIsOwner(!!user && listRes.data.owner_id === user.id)
    }
    if (entriesRes.data) {
      setEntries(entriesRes.data)
      const category = listRes.data?.category ?? 'movies'
      const year = listRes.data?.year ?? null
      fetchPosters(entriesRes.data, category, year).then(setPosters)
      // Fetch entry-level comment counts and reaction counts
      const entryIds = entriesRes.data.map(e => e.id)
      supabase
        .from('entry_comments')
        .select('list_entry_id')
        .in('list_entry_id', entryIds)
        .then(({ data }) => {
          const counts: Record<string, number> = {}
          for (const row of data ?? []) {
            counts[row.list_entry_id] = (counts[row.list_entry_id] ?? 0) + 1
          }
          setCommentCounts(counts)
        })
      supabase
        .from('entry_reactions')
        .select('list_entry_id, emoji')
        .in('list_entry_id', entryIds)
        .then(({ data }) => {
          const reacs: Record<string, Record<string, number>> = {}
          for (const row of data ?? []) {
            if (!reacs[row.list_entry_id]) reacs[row.list_entry_id] = {}
            reacs[row.list_entry_id][row.emoji] = (reacs[row.list_entry_id][row.emoji] ?? 0) + 1
          }
          setEntryReactions(reacs)
        })
    }
    if (commentsRes.data) setComments(commentsRes.data as Comment[])

    if (reactionsRes.data) {
      const counts: Record<string, { count: number; reacted: boolean }> = {}
      for (const emoji of EMOJIS) {
        counts[emoji] = { count: 0, reacted: false }
      }
      for (const r of reactionsRes.data) {
        if (counts[r.emoji]) {
          counts[r.emoji].count++
          if (r.visitor_id === vid) counts[r.emoji].reacted = true
        }
      }
      setReactions(EMOJIS.map((e) => ({ emoji: e, ...counts[e] })))
    }

    if (hmRes.data) setHonorableMentions(hmRes.data)
    if (awRes.data) setAlsoWatched(awRes.data)
    if (tiersRes.data) setTiers(tiersRes.data)

    setLoading(false)
  }

  async function saveListField(field: string, value: string) {
    if (isAdmin) {
      await fetch(`/api/admin/lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    } else if (isOwner) {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ [field]: value }),
      })
    }
    setList((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  async function deleteList() {
    if (!confirm('Delete this list? This cannot be undone.')) return
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/lists/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    if (res.ok) {
      router.push('/home')
    } else {
      setDeleting(false)
      alert('Failed to delete list.')
    }
  }

  async function saveEntryField(entryId: string, field: string, value: string | number) {
    await fetch(`/api/admin/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setEntries((prev) =>
      prev.map((e) => e.id === entryId ? { ...e, [field]: value } : e)
    )
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!newEntryTitle.trim() || !newEntryRank) return
    setSavingEntry(true)
    const res = await fetch('/api/admin/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list_id: id,
        rank: Number(newEntryRank),
        title: newEntryTitle.trim(),
        notes: newEntryNotes.trim() || null,
      }),
    })
    if (res.ok) {
      const entry = await res.json()
      setEntries((prev) =>
        [...prev, entry].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      )
      setNewEntryTitle('')
      setNewEntryRank('')
      setNewEntryNotes('')
      setAddingEntry(false)
    }
    setSavingEntry(false)
  }

  function handleEntryClick(entry: ListEntry) {
    setSelectedEntry(entry)
  }

  function handleCommentPosted(entryId: string) {
    setCommentCounts(prev => ({ ...prev, [entryId]: (prev[entryId] ?? 0) + 1 }))
  }

  function handleReactionToggled(entryId: string, emoji: string, delta: number) {
    setEntryReactions(prev => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] ?? {}),
        [emoji]: Math.max(0, (prev[entryId]?.[emoji] ?? 0) + delta),
      },
    }))
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Delete this entry?')) return
    if (isAdmin) {
      await fetch(`/api/admin/entries/${entryId}`, { method: 'DELETE' })
    } else if (isOwner) {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/lists/${id}/entries/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
    }
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  async function registerVisitor(name: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('visitors')
        .insert({ name })
        .select('id')
        .single()
      const newId = data?.id ?? crypto.randomUUID()
      localStorage.setItem('visitor_id', newId)
      localStorage.setItem('visitor_name', name)
      setVisitorId(newId)
      setVisitorName(name)
      return newId
    } catch {
      const newId = crypto.randomUUID()
      localStorage.setItem('visitor_id', newId)
      localStorage.setItem('visitor_name', name)
      setVisitorId(newId)
      setVisitorName(name)
      return newId
    }
  }

  async function toggleReaction(emoji: string, overrideVid?: string) {
    const vid = overrideVid ?? visitorId
    if (!vid) return

    const existing = reactions.find((r) => r.emoji === emoji)
    const hasReacted = existing?.reacted ?? false

    // Optimistic update
    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.count + (hasReacted ? -1 : 1), reacted: !r.reacted }
          : r
      )
    )

    if (hasReacted) {
      await supabase
        .from('reactions')
        .delete()
        .eq('list_id', id)
        .eq('visitor_id', vid)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('reactions')
        .insert({ list_id: id, visitor_id: vid, emoji })
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    let vid = visitorId
    if (!vid) {
      if (!commentNameInput.trim()) return
      vid = await registerVisitor(commentNameInput.trim())
      setCommentNameInput('')
    }

    setSubmittingComment(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ list_id: id, visitor_id: vid, content: newComment.trim() })
      .select('*, visitors(name)')
      .single()

    if (!error && data) {
      setComments((prev) => [data as Comment, ...prev])
      setNewComment('')
    }
    setSubmittingComment(false)
  }

  const isMovie = list?.category === 'movies'
  const accentColor = isMovie ? 'var(--accent)' : '#a78bfa'

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!list) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--background)' }}
      >
        <p style={{ color: 'var(--muted)' }}>List not found.</p>
        <Link href="/home" style={{ color: accentColor }}>
          ← Back to lists
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/home"
            className="flex items-center gap-2 text-sm transition-colors group"
            style={{ color: 'var(--muted)' }}
          >
            <span>←</span>
            <span>
              <span className="font-bold" style={{ color: 'var(--foreground)' }}>Ranked</span>
              <span className="ml-1.5 text-xs tracking-[0.15em] uppercase">by Prad</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className="text-xs tracking-[0.3em] uppercase font-semibold px-2 py-1 rounded"
              style={{
                background: isMovie ? 'rgba(232,197,71,0.12)' : 'rgba(139,92,246,0.12)',
                color: accentColor,
              }}
            >
              {isMovie ? 'Movies' : 'TV Shows'}
            </span>

            {/* Owner menu */}
            {(isOwner || isAdmin) && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-opacity hover:opacity-70"
                  style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                  aria-label="List options"
                >
                  ⋯
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[160px]"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    >
                      <button
                        onClick={() => setMenuOpen(false)}
                        className="w-full text-left px-4 py-2.5 text-sm transition-opacity hover:opacity-70"
                        style={{ color: 'var(--foreground)' }}
                        title="Click the title or description to edit"
                      >
                        ✎ Edit details
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); deleteList() }}
                        disabled={deleting}
                        className="w-full text-left px-4 py-2.5 text-sm transition-opacity hover:opacity-70 disabled:opacity-40"
                        style={{ color: '#f87171' }}
                      >
                        {deleting ? 'Deleting…' : '🗑 Delete list'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div
        className="py-14 px-4 relative overflow-hidden"
        style={{
          background: `radial-gradient(ellipse 70% 120% at 50% -10%, ${isMovie ? 'rgba(232,197,71,0.1)' : 'rgba(139,92,246,0.1)'} 0%, transparent 70%)`,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="text-xs tracking-[0.3em] uppercase font-medium mb-3"
            style={{ color: accentColor }}
          >
            {list.list_type === 'theme'
              ? (list.genre ?? 'All-Time')
              : `${list.year} · ${isMovie ? 'Movies' : 'TV Shows'}`}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            <EditableText
              value={list.title}
              onSave={(v) => saveListField('title', v)}
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              editable={isAdmin || isOwner}
            />
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'var(--muted)' }}>
            <EditableText
              value={list.description ?? ''}
              onSave={(v) => saveListField('description', v)}
              multiline
              placeholder="Add a description…"
              className="text-base"
              style={{ color: 'var(--muted)' }}
              editable={isAdmin || isOwner}
            />
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-20 space-y-12">
        {/* Entries */}
        <section>
          {list.list_format === 'tiered' ? (
            <TieredEntries entries={entries} tiers={tiers} accentColor={accentColor} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} />
          ) : list.list_format === 'tier-ranked' ? (
            <TierRankedEntries entries={entries} tiers={tiers} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} />
          ) : (
          <>
          <ol className="space-y-3">
            {entries.map((entry, i) => (
              <li key={entry.id}>
                <div
                  className={`rounded-xl p-4 sm:p-5 flex gap-4 items-start transition-colors${!isAdmin ? ' cursor-pointer' : ''}`}
                  style={{
                    background: selectedEntry?.id === entry.id ? `${accentColor}08` : 'var(--surface)',
                    border: `1px solid ${selectedEntry?.id === entry.id ? `${accentColor}40` : 'var(--border)'}`,
                    borderLeft: `3px solid ${i === 0 ? accentColor : selectedEntry?.id === entry.id ? `${accentColor}60` : 'var(--border)'}`,
                  }}
                  onClick={(e) => {
                    if (isAdmin) return
                    if ((e.target as HTMLElement).closest('a')) return
                    handleEntryClick(entry)
                  }}
                >
                  {/* Rank */}
                  <div
                    className="text-2xl font-bold w-9 shrink-0 tabular-nums leading-none mt-0.5"
                    style={{
                      color: i === 0 ? accentColor : i < 3 ? 'var(--foreground)' : 'var(--muted)',
                    }}
                  >
                    <EditableText
                      value={String(entry.rank ?? i + 1)}
                      onSave={(v) => saveEntryField(entry.id, 'rank', Number(v))}
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: i === 0 ? accentColor : i < 3 ? 'var(--foreground)' : 'var(--muted)' }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-snug">
                        <EditableText
                          value={entry.title}
                          onSave={(v) => saveEntryField(entry.id, 'title', v)}
                          className="font-semibold text-base"
                          renderValue={(v) =>
                            posters[entry.id]?.imdbUrl && !isAdmin ? (
                              <a
                                href={posters[entry.id].imdbUrl!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                                style={{ color: 'inherit' }}
                              >
                                {v}
                              </a>
                            ) : <>{v}</>
                          }
                        />
                      </h3>
                      <div className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                        <EditableText
                          value={entry.notes ?? ''}
                          onSave={(v) => saveEntryField(entry.id, 'notes', v)}
                          multiline
                          placeholder="Add notes…"
                          className="text-sm"
                          style={{ color: 'var(--muted)' }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                        {commentCounts[entry.id] > 0 && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            💬 {commentCounts[entry.id]}
                          </span>
                        )}
                        {['🔥', '❤️', '😮', '😂', '👏']
                          .filter(e => (entryReactions[entry.id]?.[e] ?? 0) > 0)
                          .map(e => (
                            <span key={e} className="text-xs" style={{ color: 'var(--muted)' }}>
                              {e} {entryReactions[entry.id][e]}
                            </span>
                          ))}
                      </div>
                    </div>
                    {/* Thumbnail — right aligned */}
                    {(() => {
                      const info = posters[entry.id]
                      const src = entry.image_url ?? info?.poster
                      const imdbUrl = info?.imdbUrl
                      const img = src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={entry.title}
                          className="w-12 h-[4.5rem] object-cover rounded shrink-0"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                        />
                      ) : null
                      if (src) return imdbUrl ? (
                        <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          {img}
                        </a>
                      ) : img
                      const pending = !(entry.id in posters)
                      return (
                        <div
                          className="w-12 h-[4.5rem] rounded shrink-0 flex items-end justify-center pb-1 overflow-hidden"
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            opacity: pending ? 0.4 : 1,
                          }}
                        >
                          {!pending && (
                            <span
                              className="text-[9px] text-center leading-tight px-1"
                              style={{ color: 'var(--muted)' }}
                            >
                              {entry.title}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {(isAdmin || isOwner) && (
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="shrink-0 text-xs px-2 py-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                        style={{ border: '1px solid #f87171', color: '#f87171' }}
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Add Entry */}
          {(isAdmin || isOwner) && (
            <div className="mt-4">
              {addingEntry ? (
                <form
                  onSubmit={addEntry}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--accent)33' }}
                >
                  <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
                    New Entry
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      value={newEntryRank}
                      onChange={(e) => setNewEntryRank(e.target.value)}
                      placeholder="Rank"
                      min={1}
                      className="w-20 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    />
                    <input
                      type="text"
                      value={newEntryTitle}
                      onChange={(e) => setNewEntryTitle(e.target.value)}
                      placeholder="Title"
                      className="flex-1 px-3 py-2 rounded text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    />
                  </div>
                  <textarea
                    value={newEntryNotes}
                    onChange={(e) => setNewEntryNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full px-3 py-2 rounded text-sm resize-none outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingEntry || !newEntryTitle.trim() || !newEntryRank}
                      className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                    >
                      {savingEntry ? 'Adding…' : 'Add Entry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingEntry(false)}
                      className="px-4 py-2 rounded text-sm"
                      style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAddingEntry(true)}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ border: '1px dashed var(--border)', color: 'var(--muted)' }}
                >
                  + Add Entry
                </button>
              )}
            </div>
          )}
          </>
          )}
        </section>

        {/* Honorable Mentions */}
        {honorableMentions.length > 0 && (
          <CollapsibleSection
            label="Honorable Mentions"
            count={honorableMentions.length}
            open={hmOpen}
            onToggle={() => setHmOpen((v) => !v)}
            accentColor={accentColor}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {honorableMentions.map((hm) => (
                <span key={hm.id} className="text-sm flex items-center gap-2 min-w-0">
                  <span className="shrink-0" style={{ color: accentColor }}>·</span>
                  <span className="truncate" style={{ color: 'var(--foreground)' }}>{hm.title}</span>
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Also Watched */}
        {alsoWatched.length > 0 && (
          <CollapsibleSection
            label="Also Watched"
            count={alsoWatched.length}
            open={awOpen}
            onToggle={() => setAwOpen((v) => !v)}
            accentColor={accentColor}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {alsoWatched.map((aw) => (
                <span key={aw.id} className="text-sm flex items-center gap-2 min-w-0">
                  <span className="shrink-0" style={{ color: accentColor }}>·</span>
                  <span className="truncate" style={{ color: 'var(--foreground)' }}>{aw.title}</span>
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Reactions */}
        <section>
          <h2
            className="text-xs tracking-[0.3em] uppercase font-semibold mb-4"
            style={{ color: 'var(--muted)' }}
          >
            Reactions
          </h2>
          <div className="flex flex-wrap gap-3">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => {
                  if (!visitorId) {
                    setPendingListReaction(r.emoji)
                    return
                  }
                  toggleReaction(r.emoji)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: r.reacted ? `${accentColor}18` : 'var(--surface)',
                  border: `1px solid ${r.reacted ? accentColor : 'var(--border)'}`,
                  color: r.reacted ? accentColor : 'var(--foreground)',
                }}
              >
                <span className="text-base">{r.emoji}</span>
                {r.count > 0 && (
                  <span className="tabular-nums">{r.count}</span>
                )}
              </button>
            ))}
          </div>
          {pendingListReaction && !visitorId && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!listReactionNameInput.trim()) return
                const newId = await registerVisitor(listReactionNameInput.trim())
                await toggleReaction(pendingListReaction, newId)
                setPendingListReaction(null)
                setListReactionNameInput('')
              }}
              className="mt-3 flex items-center gap-2"
            >
              <input
                autoFocus
                value={listReactionNameInput}
                onChange={(e) => setListReactionNameInput(e.target.value)}
                placeholder="Your name to react…"
                maxLength={50}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <button
                type="submit"
                disabled={!listReactionNameInput.trim()}
                className="px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: accentColor, color: '#0a0a0f' }}
              >
                React {pendingListReaction}
              </button>
              <button
                type="button"
                onClick={() => { setPendingListReaction(null); setListReactionNameInput('') }}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </form>
          )}
        </section>

        {/* Comments */}
        <section>
          <h2
            className="text-xs tracking-[0.3em] uppercase font-semibold mb-4"
            style={{ color: 'var(--muted)' }}
          >
            Comments
          </h2>

          {/* Comment form */}
          <form onSubmit={submitComment} className="mb-6 space-y-3">
            {visitorName ? (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Posting as <span style={{ color: 'var(--foreground)' }}>{visitorName}</span>
              </span>
            ) : (
              <input
                value={commentNameInput}
                onChange={(e) => setCommentNameInput(e.target.value)}
                placeholder="Your name…"
                maxLength={50}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            )}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your thoughts…"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-lg text-sm resize-none outline-none transition-all"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {newComment.length}/500
              </span>
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim() || (!visitorName && !commentNameInput.trim())}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: accentColor, color: '#0a0a0f' }}
              >
                {submittingComment ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--muted)' }}>
              No comments yet. Be the first!
            </p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl p-4"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {comment.visitors?.name ?? 'Anonymous'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(comment.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--muted)' }}
                  >
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <EntryDrawer
        entry={selectedEntry}
        visitorId={visitorId}
        visitorName={visitorName}
        accentColor={accentColor}
        onClose={() => setSelectedEntry(null)}
        onCommentPosted={handleCommentPosted}
        onReactionToggled={handleReactionToggled}
        onRegisterVisitor={registerVisitor}
      />
    </div>
  )
}

function CollapsibleSection({
  label,
  count,
  open,
  onToggle,
  accentColor,
  children,
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  accentColor: string
  children: React.ReactNode
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between group mb-3"
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs tracking-[0.3em] uppercase font-semibold"
            style={{ color: 'var(--muted)' }}
          >
            {label}
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded tabular-nums"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
          >
            {count}
          </span>
        </div>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: accentColor,
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="rounded-xl p-4 sm:p-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {children}
        </div>
      )}
    </section>
  )
}

// Colors for tier-ranked banners (one per tier, sequential)
const TIER_RANKED_COLORS = [
  '#e8c547', // gold
  '#60a5fa', // blue
  '#34d399', // green
  '#a78bfa', // purple
  '#fb923c', // orange
  '#f472b6', // pink
  '#818cf8', // indigo
  '#38bdf8', // sky
  '#f43f5e', // rose
  '#4ade80', // light green
  '#94a3b8', // slate
  '#6b7280', // gray
]

// Tier colors — index 0 = tier 1 (best), descending
const TIER_COLORS = [
  '#e8c547', // gold
  '#34d399', // green
  '#60a5fa', // blue
  '#a78bfa', // purple
  '#fb923c', // orange
  '#f87171', // red
  '#6b7280', // grey
]

function TieredEntries({
  entries,
  tiers: tierData,
  accentColor,
  posters,
  isTheme = false,
  isAdmin = false,
  saveEntryField,
  onEntryClick,
  commentCounts = {},
  entryReactions = {},
  selectedEntryId,
}: {
  entries: ListEntry[]
  tiers: Tier[]
  accentColor: string
  posters: Record<string, PosterInfo>
  isTheme?: boolean
  isAdmin?: boolean
  saveEntryField?: (id: string, field: string, value: string | number) => Promise<void>
  onEntryClick?: (entry: ListEntry) => void
  commentCounts?: Record<string, number>
  entryReactions?: Record<string, Record<string, number>>
  selectedEntryId?: string | null
}) {
  // New format: group by tier_id using tiers data
  if (tierData.length > 0) {
    const entriesByTier = new Map<string, ListEntry[]>()
    for (const entry of entries) {
      const key = entry.tier_id ?? 'none'
      if (!entriesByTier.has(key)) entriesByTier.set(key, [])
      entriesByTier.get(key)!.push(entry)
    }

    return (
      <div className="space-y-2">
        {tierData.map((tier, i) => {
          const tierEntries = entriesByTier.get(tier.id) ?? []
          if (tierEntries.length === 0) return null
          const color = tier.color ?? TIER_COLORS[i] ?? accentColor
          const label = tier.label
          const isTop = i === 0

          if (isTop) {
            const hero = tierEntries[0]
            const heroPoster = hero.image_url ?? posters[hero.id]?.poster
            const heroImdb = posters[hero.id]?.imdbUrl
            return (
              <div
                key={tier.id}
                className={`rounded-xl overflow-hidden flex items-stretch${!isAdmin ? ' cursor-pointer' : ''}`}
                style={{
                  border: `1px solid ${selectedEntryId === hero.id ? color : `${color}55`}`,
                  background: `linear-gradient(135deg, ${color}18 0%, ${color}06 60%, transparent 100%)`,
                  boxShadow: selectedEntryId === hero.id ? `0 0 32px ${color}40` : `0 0 32px ${color}20`,
                  minHeight: '110px',
                }}
                onClick={(e) => {
                  if (isAdmin) return
                  if ((e.target as HTMLElement).closest('a')) return
                  onEntryClick?.(hero)
                }}
              >
                <div
                  className="flex flex-col items-center justify-center px-4 shrink-0 text-center w-24"
                  style={{ borderRight: `2px solid ${color}40` }}
                >
                  <span className="text-2xl font-black" style={{ color }}>★</span>
                  <span className="text-[9px] leading-tight mt-1 font-semibold uppercase tracking-widest" style={{ color }}>
                    {label}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-5 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1" style={{ color: `${color}99` }}>
                      #1 Pick
                    </p>
                    <h3 className="text-xl font-bold leading-snug flex items-center gap-1.5" style={{ color }}>
                      {heroImdb ? (
                        <a href={heroImdb} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>
                          {hero.title}
                        </a>
                      ) : hero.title}
                    </h3>
                  </div>
                  {heroPoster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroPoster}
                      alt={hero.title}
                      className="shrink-0 rounded-lg object-cover ml-auto"
                      style={{ width: '56px', height: '84px', boxShadow: `0 4px 20px ${color}50`, border: `2px solid ${color}60` }}
                    />
                  )}
                </div>
              </div>
            )
          }

          return (
            <div
              key={tier.id}
              className="rounded-xl overflow-hidden flex items-stretch"
              style={{ border: `1px solid ${color}22` }}
            >
              <div
                className="flex flex-col items-center justify-center py-3 shrink-0 text-center w-24"
                style={{ background: `${color}12`, borderRight: `2px solid ${color}28` }}
              >
                <span className="text-sm font-bold" style={{ color }}>{label}</span>
              </div>
              <div className="flex flex-wrap gap-2 p-3 items-start" style={{ background: `${color}05` }}>
                {tierEntries.map((entry) => {
                  const poster = entry.image_url ?? posters[entry.id]?.poster
                  const imdbUrl = posters[entry.id]?.imdbUrl
                  const imgEl = poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt={entry.title} className="rounded object-cover w-full" style={{ height: '78px', border: `1px solid ${color}30`, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
                  ) : (
                    <div className="rounded w-full flex items-center justify-center" style={{ height: '78px', background: `${color}12`, border: `1px solid ${color}22` }} />
                  )
                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col items-center gap-1${!isAdmin ? ' cursor-pointer' : ''}`}
                      style={{ width: '56px', outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none', outlineOffset: '2px', borderRadius: '4px' }}
                      onClick={(e) => {
                        if (isAdmin) return
                        if ((e.target as HTMLElement).closest('a')) return
                        onEntryClick?.(entry)
                      }}
                    >
                      {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="w-full">{imgEl}</a> : imgEl}
                      <span
                        className="text-center leading-tight"
                        style={{ color: i <= 2 ? 'var(--foreground)' : 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%', textAlign: 'center' }}
                      >
                        {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                      </span>
                      {(entry.notes || isAdmin) && (
                        <div className="w-full text-center" style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                          <EditableText value={entry.notes ?? ''} onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()} multiline placeholder="Notes…" className="text-[0.6rem]" style={{ color: 'var(--muted)' }} />
                        </div>
                      )}
                      {(commentCounts[entry.id] ?? 0) > 0 && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>
                      )}
                      {['🔥', '❤️', '😮', '😂', '👏']
                        .filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)
                        .map(e => (
                          <span key={e} style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{e}{entryReactions![entry.id][e]}</span>
                        ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        <p className="text-xs text-right" style={{ color: 'var(--muted)' }}>
          {entries.length} films
        </p>
      </div>
    )
  }

  // Legacy fallback: old rank-based grouping
  const tierMap = new Map<number, { label: string; entries: ListEntry[] }>()
  for (const entry of entries) {
    if (!tierMap.has(entry.rank ?? 0)) {
      tierMap.set(entry.rank ?? 0, { label: entry.tier ?? `Tier ${entry.rank ?? 0}`, entries: [] })
    }
    tierMap.get(entry.rank ?? 0)!.entries.push(entry)
  }

  const legacyTiers = Array.from(tierMap.entries()).sort(([a], [b]) => a - b)

  return (
    <div className="space-y-2">
      {legacyTiers.map(([rank, { label, entries: tierEntries }], i) => {
        const color = TIER_COLORS[i] ?? accentColor
        const isTop = i === 0

        // ── Tier 1 hero treatment ──────────────────────
        if (isTop) {
          const hero = tierEntries[0]
          const heroPoster = hero.image_url ?? posters[hero.id]?.poster
          const heroImdb = posters[hero.id]?.imdbUrl
          return (
            <div
              key={rank}
              className={`rounded-xl overflow-hidden flex items-stretch${!isAdmin ? ' cursor-pointer' : ''}`}
              style={{
                border: `1px solid ${selectedEntryId === hero.id ? color : `${color}55`}`,
                background: `linear-gradient(135deg, ${color}18 0%, ${color}06 60%, transparent 100%)`,
                boxShadow: selectedEntryId === hero.id ? `0 0 32px ${color}40` : `0 0 32px ${color}20`,
                minHeight: '110px',
              }}
              onClick={(e) => {
                if (isAdmin) return
                if ((e.target as HTMLElement).closest('a')) return
                onEntryClick?.(hero)
              }}
            >
              {/* Label */}
              <div
                className="flex flex-col items-center justify-center px-4 shrink-0 text-center w-24"
                style={{ borderRight: `2px solid ${color}40` }}
              >
                <span className="text-2xl font-black" style={{ color }}>★</span>
                <span
                  className="text-[9px] leading-tight mt-1 font-semibold uppercase tracking-widest"
                  style={{ color }}
                >
                  {label}
                </span>
              </div>

              {/* Hero content */}
              <div className="flex-1 flex items-center gap-5 px-5 py-4">
                <div className="min-w-0">
                  <p
                    className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-1"
                    style={{ color: `${color}99` }}
                  >
                    #1 Pick
                  </p>
                  <h3 className="text-xl font-bold leading-snug flex items-center gap-1.5" style={{ color }}>
                    {heroImdb ? (
                      <a href={heroImdb} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>
                        {hero.title}
                      </a>
                    ) : hero.title}
                  </h3>
                </div>
                {heroPoster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroPoster}
                    alt={hero.title}
                    className="shrink-0 rounded-lg object-cover ml-auto"
                    style={{
                      width: '56px',
                      height: '84px',
                      boxShadow: `0 4px 20px ${color}50`,
                      border: `2px solid ${color}60`,
                    }}
                  />
                )}
              </div>
            </div>
          )
        }

        // ── Standard tier rows ─────────────────────────
        return (
          <div
            key={rank}
            className="rounded-xl overflow-hidden flex items-stretch"
            style={{ border: `1px solid ${color}22` }}
          >
            {/* Fixed-width label — same for all tiers */}
            <div
              className="flex flex-col items-center justify-center py-3 shrink-0 text-center w-24"
              style={{
                background: `${color}12`,
                borderRight: `2px solid ${color}28`,
              }}
            >
              <span className="text-sm font-bold" style={{ color }}>T{rank}</span>
              <span
                className="text-[9px] leading-tight mt-0.5 font-medium uppercase tracking-wide px-1"
                style={{ color: `${color}bb` }}
              >
                {label}
              </span>
            </div>

            {/* Movie cards */}
            <div
              className="flex flex-wrap gap-2 p-3 items-start"
              style={{ background: `${color}05` }}
            >
              {tierEntries.map((entry) => {
                const poster = entry.image_url ?? posters[entry.id]?.poster
                const imdbUrl = posters[entry.id]?.imdbUrl
                const imgEl = poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poster}
                    alt={entry.title}
                    className="rounded object-cover w-full"
                    style={{
                      height: '78px',
                      border: `1px solid ${color}30`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  />
                ) : (
                  <div
                    className="rounded w-full flex items-center justify-center"
                    style={{
                      height: '78px',
                      background: `${color}12`,
                      border: `1px solid ${color}22`,
                    }}
                  />
                )
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col items-center gap-1${!isAdmin ? ' cursor-pointer' : ''}`}
                    style={{
                      width: '56px',
                      outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none',
                      outlineOffset: '2px',
                      borderRadius: '4px',
                    }}
                    onClick={(e) => {
                      if (isAdmin) return
                      if ((e.target as HTMLElement).closest('a')) return
                      onEntryClick?.(entry)
                    }}
                  >
                    {imdbUrl ? (
                      <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                        {imgEl}
                      </a>
                    ) : imgEl}
                    <span
                      className="text-center leading-tight"
                      style={{
                        color: i <= 2 ? 'var(--foreground)' : 'var(--muted)',
                        fontSize: '0.65rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                        width: '100%',
                        textAlign: 'center',
                      }}
                    >
                      {imdbUrl ? (
                        <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>
                          {entry.title}
                        </a>
                      ) : entry.title}
                    </span>
                    {(entry.notes || isAdmin) && (
                      <div className="w-full text-center" style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                        <EditableText
                          value={entry.notes ?? ''}
                          onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()}
                          multiline
                          placeholder="Notes…"
                          className="text-[0.6rem]"
                          style={{ color: 'var(--muted)' }}
                        />
                      </div>
                    )}
                    {(commentCounts[entry.id] ?? 0) > 0 && (
                      <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                        💬 {commentCounts[entry.id]}
                      </span>
                    )}
                    {['🔥', '❤️', '😮', '😂', '👏']
                      .filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)
                      .map(e => (
                        <span key={e} style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                          {e}{entryReactions![entry.id][e]}
                        </span>
                      ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-right" style={{ color: 'var(--muted)' }}>
        {entries.length} films · Phases 1–4
      </p>
    </div>
  )
}

function TierRankedEntries({
  entries,
  tiers: tierData,
  posters,
  isTheme = false,
  isAdmin = false,
  saveEntryField,
  onEntryClick,
  commentCounts = {},
  entryReactions = {},
  selectedEntryId,
}: {
  entries: ListEntry[]
  tiers: Tier[]
  posters: Record<string, PosterInfo>
  isTheme?: boolean
  isAdmin?: boolean
  saveEntryField?: (id: string, field: string, value: string | number) => Promise<void>
  onEntryClick?: (entry: ListEntry) => void
  commentCounts?: Record<string, number>
  entryReactions?: Record<string, Record<string, number>>
  selectedEntryId?: string | null
}) {
  // New format: group by tier_id using tiers data
  if (tierData.length > 0) {
    const entriesByTier = new Map<string, ListEntry[]>()
    for (const entry of [...entries].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))) {
      const key = entry.tier_id ?? 'none'
      if (!entriesByTier.has(key)) entriesByTier.set(key, [])
      entriesByTier.get(key)!.push(entry)
    }

    return (
      <div className="space-y-10">
        {tierData.map((tier, tierIndex) => {
          const tierEntries = entriesByTier.get(tier.id) ?? []
          if (tierEntries.length === 0) return null
          const color = tier.color ?? TIER_RANKED_COLORS[tierIndex] ?? '#e8c547'

          return (
            <div key={tier.id}>
              <div
                className="relative rounded-xl overflow-hidden mb-4 px-6 py-5"
                style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`, border: `1px solid ${color}35` }}
              >
                <span
                  className="absolute right-5 top-1/2 -translate-y-1/2 font-black select-none pointer-events-none leading-none"
                  style={{ fontSize: '5rem', color: `${color}12` }}
                >
                  {tierIndex + 1}
                </span>
                <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-1" style={{ color: `${color}70` }}>
                  Tier {tierIndex + 1}
                </p>
                <h3 className="text-lg font-bold" style={{ color }}>{tier.label}</h3>
              </div>

              <div className="space-y-1.5">
                {tierEntries.map((entry) => {
                  const info = posters[entry.id]
                  const src = entry.image_url ?? info?.poster
                  const imdbUrl = info?.imdbUrl
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors${!isAdmin ? ' cursor-pointer' : ''}`}
                      style={{ background: selectedEntryId === entry.id ? `${color}10` : 'var(--surface)', border: `1px solid ${selectedEntryId === entry.id ? `${color}40` : 'var(--border)'}` }}
                      onClick={(e) => {
                        if (isAdmin) return
                        if ((e.target as HTMLElement).closest('a')) return
                        onEntryClick?.(entry)
                      }}
                    >
                      <span className="text-xs font-bold w-6 shrink-0 text-right tabular-nums mt-2.5" style={{ color: `${color}70` }}>
                        {entry.rank}
                      </span>
                      {src ? (
                        imdbUrl ? (
                          <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
                          </a>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded shrink-0 mt-1" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
                        )
                      ) : (
                        <div className="w-8 h-12 rounded shrink-0 mt-1" style={{ background: `${color}15`, border: `1px solid ${color}20` }} />
                      )}
                      <div className="flex-1 min-w-0 py-1.5">
                        <span className="font-medium text-sm">
                          {imdbUrl && !isAdmin ? (
                            <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--foreground)' }}>{entry.title}</a>
                          ) : entry.title}
                        </span>
                        {(entry.notes || isAdmin) && (
                          <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                            <EditableText value={entry.notes ?? ''} onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()} multiline placeholder="Add notes…" className="text-xs" style={{ color: 'var(--muted)' }} />
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {commentCounts[entry.id] > 0 && (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>
                          )}
                          {['🔥', '❤️', '😮', '😂', '👏']
                            .filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)
                            .map(e => (
                              <span key={e} className="text-xs" style={{ color: 'var(--muted)' }}>{e} {entryReactions![entry.id][e]}</span>
                            ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Legacy fallback: group by tier string, preserving insertion order
  const tierGroups: { tier: string; entries: ListEntry[] }[] = []
  const seen = new Map<string, ListEntry[]>()

  for (const entry of [...entries].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))) {
    const key = entry.tier ?? 'Uncategorized'
    if (!seen.has(key)) {
      const arr: ListEntry[] = []
      seen.set(key, arr)
      tierGroups.push({ tier: key, entries: arr })
    }
    seen.get(key)!.push(entry)
  }

  return (
    <div className="space-y-10">
      {tierGroups.map(({ tier, entries: tierEntries }, tierIndex) => {
        const color = TIER_RANKED_COLORS[tierIndex] ?? '#e8c547'

        return (
          <div key={tier}>
            {/* Tier Banner */}
            <div
              className="relative rounded-xl overflow-hidden mb-4 px-6 py-5"
              style={{
                background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
                border: `1px solid ${color}35`,
              }}
            >
              {/* Watermark number */}
              <span
                className="absolute right-5 top-1/2 -translate-y-1/2 font-black select-none pointer-events-none leading-none"
                style={{ fontSize: '5rem', color: `${color}12` }}
              >
                {tierIndex + 1}
              </span>
              <p
                className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-1"
                style={{ color: `${color}70` }}
              >
                Tier {tierIndex + 1}
              </p>
              <h3 className="text-lg font-bold" style={{ color }}>{tier}</h3>
            </div>

            {/* Entries */}
            <div className="space-y-1.5">
              {tierEntries.map((entry) => {
                const info = posters[entry.id]
                const src = entry.image_url ?? info?.poster
                const imdbUrl = info?.imdbUrl

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors${!isAdmin ? ' cursor-pointer' : ''}`}
                    style={{
                      background: selectedEntryId === entry.id ? `${color}10` : 'var(--surface)',
                      border: `1px solid ${selectedEntryId === entry.id ? `${color}40` : 'var(--border)'}`,
                    }}
                    onClick={(e) => {
                      if (isAdmin) return
                      if ((e.target as HTMLElement).closest('a')) return
                      onEntryClick?.(entry)
                    }}
                  >
                    {/* Global rank */}
                    <span
                      className="text-xs font-bold w-6 shrink-0 text-right tabular-nums mt-2.5"
                      style={{ color: `${color}70` }}
                    >
                      {entry.rank}
                    </span>

                    {/* Poster */}
                    {src ? (
                      imdbUrl ? (
                        <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
                        </a>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded shrink-0 mt-1" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
                      )
                    ) : (
                      <div className="w-8 h-12 rounded shrink-0 mt-1" style={{ background: `${color}15`, border: `1px solid ${color}20` }} />
                    )}

                    {/* Title + Notes */}
                    <div className="flex-1 min-w-0 py-1.5">
                      <span className="font-medium text-sm">
                        {imdbUrl && !isAdmin ? (
                          <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--foreground)' }}>
                            {entry.title}
                          </a>
                        ) : entry.title}
                      </span>
                      {(entry.notes || isAdmin) && (
                        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>
                          <EditableText
                            value={entry.notes ?? ''}
                            onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()}
                            multiline
                            placeholder="Add notes…"
                            className="text-xs"
                            style={{ color: 'var(--muted)' }}
                          />
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {commentCounts[entry.id] > 0 && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            💬 {commentCounts[entry.id]}
                          </span>
                        )}
                        {['🔥', '❤️', '😮', '😂', '👏']
                          .filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)
                          .map(e => (
                            <span key={e} className="text-xs" style={{ color: 'var(--muted)' }}>
                              {e} {entryReactions![entry.id][e]}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
