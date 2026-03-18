'use client'

import { useState, useEffect, use, useRef } from 'react'
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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  const [newEntryPosterUrl, setNewEntryPosterUrl] = useState<string | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)
  // Tiered add form
  const [addingTieredEntry, setAddingTieredEntry] = useState(false)
  const [newTieredTitle, setNewTieredTitle] = useState('')
  const [newTieredTierId, setNewTieredTierId] = useState<string | null>(null)
  const [newTieredNotes, setNewTieredNotes] = useState('')
  const [newTieredPosterUrl, setNewTieredPosterUrl] = useState<string | null>(null)
  const [savingTieredEntry, setSavingTieredEntry] = useState(false)
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
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  useEffect(() => {
    const name = localStorage.getItem('visitor_name')
    const vid = localStorage.getItem('visitor_id') ?? ''
    if (name) setVisitorName(name)
    if (vid) setVisitorId(vid)
    fetchAll(vid)
  }, [id])

  // Re-evaluate ownership whenever auth resolves (user loads after initial fetch)
  useEffect(() => {
    if (list) setIsOwner(!!user && list.owner_id === user.id)
  }, [user, list])

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
    if (!newEntryTitle.trim()) return
    setSavingEntry(true)
    const rank = newEntryRank ? Number(newEntryRank) : (Math.max(0, ...entries.map(e => e.rank ?? 0)) + 1)
    const session = await getSession()
    const res = await fetch(`/api/lists/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        rank,
        title: newEntryTitle.trim(),
        notes: newEntryNotes.trim() || null,
        image_url: newEntryPosterUrl || null,
      }),
    })
    if (res.ok) {
      const entry = await res.json()
      setEntries((prev) => [...prev, entry].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)))
      // Immediately fetch poster for the new entry
      if (list) {
        fetchPosters([entry], list.category, list.year).then(p => setPosters(prev => ({ ...prev, ...p })))
      }
      setNewEntryTitle('')
      setNewEntryRank('')
      setNewEntryNotes('')
      setNewEntryPosterUrl(null)
      setAddingEntry(false)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'Failed to add entry')
    }
    setSavingEntry(false)
  }

  async function addTieredEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!newTieredTitle.trim() || !newTieredTierId) return
    setSavingTieredEntry(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/lists/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        title: newTieredTitle.trim(),
        notes: newTieredNotes.trim() || null,
        image_url: newTieredPosterUrl || null,
        ...(newTieredTierId && isUUID(newTieredTierId)
          ? { tier_id: newTieredTierId }
          : { tier: newTieredTierId }),
      }),
    })
    if (res.ok) {
      const entry = await res.json()
      setEntries((prev) => [...prev, entry])
      if (list) fetchPosters([entry], list.category, list.year).then(p => setPosters(prev => ({ ...prev, ...p })))
      setNewTieredTitle('')
      setNewTieredNotes('')
      setNewTieredPosterUrl(null)
      // keep tier selected for rapid adding
    } else {
      const err = await res.json().catch(() => ({}))
      alert(`Failed to add entry: ${err.error ?? res.status}`)
    }
    setSavingTieredEntry(false)
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

  async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  async function handleRankedDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = entries.findIndex(e => e.id === active.id)
    const newIdx = entries.findIndex(e => e.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(entries, oldIdx, newIdx).map((e, i) => ({ ...e, rank: i + 1 }))
    setEntries(reordered)
    setSaving(true)
    const session = await getSession()
    await Promise.all(
      reordered
        .filter((e, i) => e.rank !== entries[i]?.rank)
        .map(e =>
          fetch(`/api/lists/${id}/entries/${e.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ rank: e.rank }),
          })
        )
    )
    setSaving(false)
  }

  async function moveEntryToTier(entryId: string, tierId: string) {
    setSaving(true)
    const session = await getSession()
    await fetch(`/api/lists/${id}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ tier_id: tierId }),
    })
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, tier_id: tierId } : e))
    setSaving(false)
  }

  async function addTier(label: string, color: string) {
    setSaving(true)
    const session = await getSession()
    const res = await fetch(`/api/lists/${id}/tiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ label, color, position: tiers.length }),
    })
    if (res.ok) {
      const tier = await res.json()
      setTiers(prev => [...prev, tier])
    }
    setSaving(false)
  }

  async function updateTier(tierId: string, fields: Partial<Pick<Tier, 'label' | 'color' | 'position'>>) {
    setSaving(true)
    const session = await getSession()
    await fetch(`/api/lists/${id}/tiers/${tierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify(fields),
    })
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, ...fields } : t))
    setSaving(false)
  }

  async function deleteTier(tierId: string) {
    const hasEntries = entries.some(e => e.tier_id === tierId)
    if (hasEntries) { alert('Move all entries out of this tier before deleting it.'); return }
    if (!confirm('Delete this tier?')) return
    setSaving(true)
    const session = await getSession()
    const res = await fetch(`/api/lists/${id}/tiers/${tierId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}` },
    })
    if (res.ok) setTiers(prev => prev.filter(t => t.id !== tierId))
    setSaving(false)
  }

  function isUUID(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  }

  async function handleTierItemDragEnd(tierId: string, draggedId: string, overId: string) {
    // tierId may be a DB UUID (new format) or a legacy tier string
    const tierEntries = isUUID(tierId)
      ? entries.filter(e => e.tier_id === tierId).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      : entries.filter(e => (e.tier ?? '') === tierId).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    const oldIdx = tierEntries.findIndex(e => e.id === draggedId)
    const newIdx = tierEntries.findIndex(e => e.id === overId)
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return
    const reordered = arrayMove(tierEntries, oldIdx, newIdx)
    const ranks = tierEntries.map(e => e.rank ?? 0).sort((a, b) => a - b)
    const updated = reordered.map((e, i) => ({ ...e, rank: ranks[i] }))
    setEntries(prev => {
      const ids = new Set(updated.map(e => e.id))
      return [...prev.filter(e => !ids.has(e.id)), ...updated].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    })
    setSaving(true)
    const session = await getSession()
    await Promise.all(updated.map(e =>
      fetch(`/api/lists/${id}/entries/${e.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ rank: e.rank }),
      })
    ))
    setSaving(false)
  }

  async function handleTiersDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = tiers.findIndex(t => t.id === active.id)
    const newIdx = tiers.findIndex(t => t.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(tiers, oldIdx, newIdx).map((t, i) => ({ ...t, position: i }))
    setTiers(reordered)
    setSaving(true)
    const session = await getSession()
    await Promise.all(
      reordered.map(t =>
        fetch(`/api/lists/${id}/tiers/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ position: t.position }),
        })
      )
    )
    setSaving(false)
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

  // For legacy lists (no DB tiers), derive virtual tiers from entry.tier strings
  const effectiveTiers: Tier[] = tiers.length > 0
    ? tiers
    : [...new Map(entries.filter(e => e.tier).map(e => [e.tier!, e.tier!])).keys()]
        .map((t, i) => ({ id: t, list_id: id, label: t, color: null, position: i, created_at: '' }))

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

            {/* Owner controls */}
            {(isOwner || isAdmin) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: editMode ? 'var(--accent)' : 'var(--surface)',
                    color: editMode ? '#0a0a0f' : 'var(--muted)',
                    border: `1px solid ${editMode ? 'transparent' : 'var(--border)'}`,
                  }}
                >
                  {editMode ? 'Done editing' : '✎ Edit'}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-opacity hover:opacity-70"
                    style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
                    aria-label="More options"
                  >⋯</button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[140px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
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
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Edit mode banner */}
      {editMode && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-sm font-medium" style={{ background: 'rgba(232,197,71,0.12)', borderBottom: '1px solid rgba(232,197,71,0.25)', color: 'var(--accent)' }}>
          <span>✎ Editing</span>
          <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>Drag ⠿ to reorder · ✕ to remove</span>
          <button
            onClick={() => {
              if (list?.list_format === 'ranked') {
                setAddingEntry(true)
              } else {
                setAddingTieredEntry(true)
              }
              setTimeout(() => document.getElementById('add-entry-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
            }}
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(232,197,71,0.25)', color: 'var(--accent)' }}
          >
            + Add Entry
          </button>
          {saving && <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>Saving…</span>}
        </div>
      )}

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
              editable={(isAdmin || isOwner) && editMode}
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
              editable={(isAdmin || isOwner) && editMode}
            />
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-20 space-y-12">
        {/* Entries */}
        <section>
          {list.list_format === 'tiered' ? (
            <>
              {(isOwner || isAdmin) && editMode && (
                <TierEditPanel
                  tiers={tiers}
                  sensors={sensors}
                  onDragEnd={handleTiersDragEnd}
                  onUpdate={updateTier}
                  onDelete={deleteTier}
                  onAdd={addTier}
                  hasEntries={(tierId) => entries.some(e => e.tier_id === tierId)}
                />
              )}
              <TieredEntries entries={entries} tiers={tiers} accentColor={accentColor} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} isOwner={isOwner} onDelete={editMode ? deleteEntry : undefined} onMoveTier={editMode ? moveEntryToTier : undefined} editMode={editMode} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} />
              {(isOwner || isAdmin) && editMode && <TieredAddForm tiers={effectiveTiers} category={list.category} title={newTieredTitle} setTitle={setNewTieredTitle} posterUrl={newTieredPosterUrl} setPosterUrl={setNewTieredPosterUrl} tierId={newTieredTierId} setTierId={setNewTieredTierId} notes={newTieredNotes} setNotes={setNewTieredNotes} open={addingTieredEntry} setOpen={setAddingTieredEntry} saving={savingTieredEntry} onSubmit={addTieredEntry} />}
            </>
          ) : list.list_format === 'tier-ranked' ? (
            <>
              {(isOwner || isAdmin) && editMode && (
                <TierEditPanel
                  tiers={tiers}
                  sensors={sensors}
                  onDragEnd={handleTiersDragEnd}
                  onUpdate={updateTier}
                  onDelete={deleteTier}
                  onAdd={addTier}
                  hasEntries={(tierId) => entries.some(e => e.tier_id === tierId)}
                />
              )}
              <TierRankedEntries entries={entries} tiers={tiers} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} isOwner={isOwner} onDelete={editMode ? deleteEntry : undefined} onMoveTier={editMode ? moveEntryToTier : undefined} onTierItemDragEnd={editMode ? handleTierItemDragEnd : undefined} editMode={editMode} sensors={sensors} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} />
              {(isOwner || isAdmin) && editMode && <TieredAddForm tiers={effectiveTiers} category={list.category} title={newTieredTitle} setTitle={setNewTieredTitle} posterUrl={newTieredPosterUrl} setPosterUrl={setNewTieredPosterUrl} tierId={newTieredTierId} setTierId={setNewTieredTierId} notes={newTieredNotes} setNotes={setNewTieredNotes} open={addingTieredEntry} setOpen={setAddingTieredEntry} saving={savingTieredEntry} onSubmit={addTieredEntry} />}
            </>
          ) : (
          <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRankedDragEnd}>
            <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-3">
                {entries.map((entry, i) => (
                  <SortableRankedEntry
                    key={entry.id}
                    entry={entry}
                    index={i}
                    accentColor={accentColor}
                    posters={posters}
                    editMode={editMode}
                    isAdmin={isAdmin}
                    isOwner={isOwner}
                    selectedEntryId={selectedEntry?.id ?? null}
                    commentCounts={commentCounts}
                    entryReactions={entryReactions}
                    onEntryClick={handleEntryClick}
                    onDelete={deleteEntry}
                    saveEntryField={saveEntryField}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          {/* Add Entry */}
          {(isAdmin || isOwner) && editMode && (
            <div id="add-entry-form" className="mt-4">
              {addingEntry ? (
                <form
                  onSubmit={addEntry}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--surface)', border: '1px solid var(--accent)33' }}
                >
                  <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
                    New Entry
                  </p>
                  <TmdbSearchInput
                    category={list.category}
                    value={newEntryTitle}
                    onChange={(v) => { setNewEntryTitle(v); if (!v.trim()) setNewEntryPosterUrl(null) }}
                    onSelect={(title, posterUrl) => { setNewEntryTitle(title); setNewEntryPosterUrl(posterUrl) }}
                    placeholder={list.category === 'movies' ? 'Search movies…' : 'Search TV shows…'}
                  />
                  <div className="flex items-center gap-3">
                    {newEntryPosterUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={newEntryPosterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                    )}
                    <input
                      type="number"
                      value={newEntryRank}
                      onChange={(e) => setNewEntryRank(e.target.value)}
                      placeholder={`Rank (optional, default: ${Math.max(0, ...entries.map(e => e.rank ?? 0)) + 1})`}
                      min={1}
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
                      disabled={savingEntry || !newEntryTitle.trim()}
                      className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40"
                      style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                    >
                      {savingEntry ? 'Adding…' : 'Add Entry'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingEntry(false); setNewEntryTitle(''); setNewEntryPosterUrl(null) }}
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

const SWATCH_COLORS = ['#e8c547', '#34d399', '#60a5fa', '#a78bfa', '#fb923c', '#f87171', '#f472b6', '#38bdf8', '#4ade80', '#6b7280']

// ─── SortableRankedEntry ──────────────────────────────────────────────────────

function SortableRankedEntry({
  entry, index, accentColor, posters, editMode, isAdmin, isOwner,
  selectedEntryId, commentCounts, entryReactions, onEntryClick, onDelete, saveEntryField,
}: {
  entry: ListEntry
  index: number
  accentColor: string
  posters: Record<string, PosterInfo>
  editMode: boolean
  isAdmin: boolean
  isOwner: boolean
  selectedEntryId: string | null
  commentCounts: Record<string, number>
  entryReactions: Record<string, Record<string, number>>
  onEntryClick: (e: ListEntry) => void
  onDelete: (id: string) => void
  saveEntryField: (id: string, field: string, value: string | number) => Promise<void>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const info = posters[entry.id]
  const src = entry.image_url ?? info?.poster
  const imdbUrl = info?.imdbUrl
  const pending = !(entry.id in posters)

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`rounded-xl p-4 sm:p-5 flex gap-4 items-start transition-colors${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
        style={{
          background: selectedEntryId === entry.id ? `${accentColor}08` : 'var(--surface)',
          border: `1px solid ${selectedEntryId === entry.id ? `${accentColor}40` : 'var(--border)'}`,
          borderLeft: `3px solid ${index === 0 ? accentColor : selectedEntryId === entry.id ? `${accentColor}60` : 'var(--border)'}`,
        }}
        onClick={(e) => {
          if (isAdmin || editMode) return
          if ((e.target as HTMLElement).closest('a')) return
          onEntryClick(entry)
        }}
      >
        {/* Drag handle */}
        {editMode && (
          <button
            {...listeners}
            {...attributes}
            className="shrink-0 self-center text-lg cursor-grab active:cursor-grabbing select-none"
            style={{ color: 'var(--muted)', touchAction: 'none' }}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        )}

        {/* Rank */}
        <div
          className="text-2xl font-bold w-9 shrink-0 tabular-nums leading-none mt-0.5"
          style={{ color: index === 0 ? accentColor : index < 3 ? 'var(--foreground)' : 'var(--muted)' }}
        >
          {entry.rank ?? index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-snug">
              <EditableText
                value={entry.title}
                onSave={(v) => saveEntryField(entry.id, 'title', v)}
                className="font-semibold text-base"
                editable={isAdmin && !editMode}
                renderValue={(v) =>
                  imdbUrl && !isAdmin ? (
                    <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{v}</a>
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
                editable={isAdmin && !editMode}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
              {commentCounts[entry.id] > 0 && (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>
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

          {/* Thumbnail */}
          {src ? (
            imdbUrl ? (
              <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={entry.title} className="w-12 h-[4.5rem] object-cover rounded shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={entry.title} className="w-12 h-[4.5rem] object-cover rounded shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
            )
          ) : (
            <div
              className="w-12 h-[4.5rem] rounded shrink-0 flex items-end justify-center pb-1 overflow-hidden"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: pending ? 0.4 : 1 }}
            >
              {!pending && <span className="text-[9px] text-center leading-tight px-1" style={{ color: 'var(--muted)' }}>{entry.title}</span>}
            </div>
          )}

          {(isAdmin || isOwner) && editMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
              className="shrink-0 text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: '1px solid #f87171', color: '#f87171' }}
              title="Delete entry"
            >✕</button>
          )}
        </div>
      </div>
    </li>
  )
}

// ─── TierEditPanel ────────────────────────────────────────────────────────────

function SortableTierRow({
  tier,
  onUpdate,
  onDelete,
  hasEntries,
}: {
  tier: Tier
  onUpdate: (id: string, fields: Partial<Pick<Tier, 'label' | 'color'>>) => void
  onDelete: (id: string) => void
  hasEntries: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tier.id })
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(tier.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabel(tier.label) }, [tier.label])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commitLabel() {
    setEditing(false)
    if (label.trim() && label.trim() !== tier.label) onUpdate(tier.id, { label: label.trim() })
    else setLabel(tier.label)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      className="flex items-center gap-2 rounded-lg px-2 py-2"
    >
      <button
        {...listeners}
        {...attributes}
        className="text-base cursor-grab active:cursor-grabbing select-none shrink-0"
        style={{ color: 'var(--muted)', touchAction: 'none' }}
      >⠿</button>

      {/* Color swatches */}
      <div className="flex gap-1 shrink-0">
        {SWATCH_COLORS.map(c => (
          <button
            key={c}
            onClick={() => onUpdate(tier.id, { color: c })}
            className="w-4 h-4 rounded-full transition-transform hover:scale-110"
            style={{
              background: c,
              outline: tier.color === c ? `2px solid white` : 'none',
              outlineOffset: '1px',
            }}
          />
        ))}
      </div>

      {/* Label */}
      <div
        className="flex-1 min-w-0 px-2 py-1 rounded cursor-text"
        style={{ background: 'var(--surface)', border: `1px solid ${editing ? (tier.color ?? '#e8c547') : 'transparent'}` }}
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') { setEditing(false); setLabel(tier.label) } }}
            className="w-full bg-transparent outline-none text-sm font-semibold"
            style={{ color: tier.color ?? 'var(--foreground)' }}
          />
        ) : (
          <span className="text-sm font-semibold" style={{ color: tier.color ?? 'var(--foreground)' }}>{tier.label}</span>
        )}
      </div>

      <button
        onClick={() => onDelete(tier.id)}
        disabled={hasEntries}
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs transition-opacity disabled:opacity-20 hover:opacity-70"
        style={{ color: '#f87171' }}
        title={hasEntries ? 'Move entries out first' : 'Delete tier'}
      >✕</button>
    </div>
  )
}

function TierEditPanel({
  tiers,
  sensors,
  onDragEnd,
  onUpdate,
  onDelete,
  onAdd,
  hasEntries,
}: {
  tiers: Tier[]
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (e: DragEndEvent) => void
  onUpdate: (id: string, fields: Partial<Pick<Tier, 'label' | 'color' | 'position'>>) => void
  onDelete: (id: string) => void
  onAdd: (label: string, color: string) => void
  hasEntries: (tierId: string) => boolean
}) {
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(SWATCH_COLORS[0])
  const [adding, setAdding] = useState(false)

  return (
    <div className="mb-6 rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.25)' }}>
      <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>Manage Tiers</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tiers.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tiers.map(tier => (
              <SortableTierRow
                key={tier.id}
                tier={tier}
                onUpdate={onUpdate}
                onDelete={onDelete}
                hasEntries={hasEntries(tier.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex gap-1 shrink-0">
            {SWATCH_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                style={{ background: c, outline: newColor === c ? '2px solid white' : 'none', outlineOffset: '1px' }}
              />
            ))}
          </div>
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newLabel.trim()) { onAdd(newLabel.trim(), newColor); setNewLabel(''); setAdding(false) }
              if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
            }}
            placeholder="Tier name…"
            className="flex-1 px-2 py-1 rounded text-sm outline-none"
            style={{ background: 'var(--surface-2)', border: `1px solid ${newColor}`, color: 'var(--foreground)' }}
          />
          <button
            onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim(), newColor); setNewLabel(''); setAdding(false) } }}
            disabled={!newLabel.trim()}
            className="px-3 py-1 rounded text-xs font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0a0a0f' }}
          >Add</button>
          <button onClick={() => { setAdding(false); setNewLabel('') }} className="px-2 py-1 rounded text-xs" style={{ color: 'var(--muted)' }}>✕</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent)' }}
        >+ Add tier</button>
      )}
    </div>
  )
}

// ─── TmdbSearchInput ──────────────────────────────────────────────────────────

type TmdbResult = { id: number; title: string; year: string; posterUrl: string | null }

function TmdbSearchInput({
  category, value, onChange, onSelect, placeholder,
}: {
  category: string
  value: string
  onChange: (v: string) => void
  onSelect: (title: string, posterUrl: string | null) => void
  placeholder?: string
}) {
  const [results, setResults] = useState<TmdbResult[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const type = category === 'movies' ? 'movie' : 'tv'

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!value.trim() || !apiKey) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(value.trim())}&api_key=${apiKey}&page=1`
        )
        if (!res.ok) return
        const data = await res.json()
        const items: TmdbResult[] = (data.results ?? []).slice(0, 6).map((r: { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string }) => ({
          id: r.id,
          title: r.title ?? r.name ?? '',
          year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4),
          posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w92${r.poster_path}` : null,
        }))
        setResults(items)
        setOpen(items.length > 0)
      } catch { /* ignore */ }
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value, type, apiKey])

  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(false) }}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
        placeholder={placeholder ?? 'Search…'}
        autoComplete="off"
        className="w-full px-3 py-2 rounded text-sm outline-none"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      />
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onSelect(r.title, r.posterUrl); setOpen(false); setResults([]) }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {r.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-8 h-12 rounded shrink-0" style={{ background: 'var(--surface-2)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.title}</p>
                  {r.year && <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.year}</p>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TieredAddForm ────────────────────────────────────────────────────────────

function TieredAddForm({
  tiers, category, title, setTitle, posterUrl, setPosterUrl, tierId, setTierId, notes, setNotes,
  open, setOpen, saving, onSubmit,
}: {
  tiers: Tier[]
  category: string
  title: string; setTitle: (v: string) => void
  posterUrl: string | null; setPosterUrl: (v: string | null) => void
  tierId: string | null; setTierId: (v: string | null) => void
  notes: string; setNotes: (v: string) => void
  open: boolean; setOpen: (v: boolean) => void
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }

  // Auto-select first tier when form opens and no tier is selected
  useEffect(() => {
    if (open && !tierId && tiers.length > 0) {
      setTierId(tiers[0].id)
    }
  }, [open, tiers])

  return (
    <div id="add-entry-form" className="mt-4">
      {open ? (
        <form onSubmit={onSubmit} className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--accent)33' }}>
          <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>Add Entry</p>
          <div className="flex items-center gap-3">
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
            )}
            <TmdbSearchInput
              category={category}
              value={title}
              onChange={(v) => { setTitle(v); if (!v.trim()) setPosterUrl(null) }}
              onSelect={(t, p) => { setTitle(t); setPosterUrl(p) }}
              placeholder={category === 'movies' ? 'Search movies…' : 'Search TV shows…'}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Tier</p>
            {tiers.length === 0 && (
              <p className="text-xs italic" style={{ color: 'var(--muted)' }}>No tiers yet — use the Manage Tiers panel above to create tiers first.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {tiers.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setTierId(tierId === tier.id ? null : tier.id)}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: tierId === tier.id ? `${tier.color ?? '#6b7280'}33` : 'var(--surface-2)',
                    border: `2px solid ${tierId === tier.id ? (tier.color ?? '#6b7280') : 'var(--border)'}`,
                    color: tierId === tier.id ? (tier.color ?? '#6b7280') : 'var(--muted)',
                  }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
            style={inputStyle}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !title.trim() || !tierId}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              {saving ? 'Adding…' : 'Add Entry'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all mt-2"
          style={{ border: '1px dashed var(--border)', color: 'var(--muted)' }}
        >
          + Add Entry
        </button>
      )}
    </div>
  )
}

function TieredEntries({
  entries,
  tiers: tierData,
  accentColor,
  posters,
  isTheme = false,
  isAdmin = false,
  isOwner = false,
  onDelete,
  onMoveTier,
  editMode = false,
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
  isOwner?: boolean
  onDelete?: (id: string) => void
  onMoveTier?: (entryId: string, tierId: string) => void
  editMode?: boolean
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

    const unassigned = entriesByTier.get('none') ?? []

    return (
      <div className="space-y-2">
        {unassigned.length > 0 && (
          <div className="rounded-xl overflow-hidden flex items-stretch" style={{ border: '1px solid var(--border)' }}>
            <div className="flex flex-col items-center justify-center py-3 shrink-0 text-center w-24" style={{ background: 'var(--surface-2)', borderRight: '2px solid var(--border)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Unassigned</span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 items-start">
              {unassigned.map((entry) => {
                const poster = entry.image_url ?? posters[entry.id]?.poster
                const imgEl = poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt={entry.title} className="rounded object-cover w-full" style={{ height: '78px' }} />
                ) : (
                  <div className="rounded w-full" style={{ height: '78px', background: 'var(--surface-2)' }} />
                )
                return (
                  <div key={entry.id} className="flex flex-col items-center gap-1" style={{ width: '56px', position: 'relative' }}>
                    {(isOwner || isAdmin) && onDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full flex items-center justify-center text-[9px]" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                    )}
                    {imgEl}
                    <span className="text-center leading-tight" style={{ color: 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%' }}>{entry.title}</span>
                    {editMode && onMoveTier && (
                      <select value={entry.tier_id ?? ''} onChange={e => { e.stopPropagation(); onMoveTier(entry.id, e.target.value) }} onClick={e => e.stopPropagation()} className="w-full rounded outline-none cursor-pointer" style={{ fontSize: '0.6rem', background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 2px' }}>
                        <option value="">Move to tier…</option>
                        {tierData.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
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
                  {(isOwner || isAdmin) && onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(hero.id) }}
                      className="shrink-0 self-start w-5 h-5 flex items-center justify-center rounded-full text-[9px]"
                      style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}
                    >✕</button>
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
                      className={`flex flex-col items-center gap-1${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
                      style={{ width: '56px', position: 'relative', outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none', outlineOffset: '2px', borderRadius: '4px' }}
                      onClick={(e) => {
                        if (isAdmin || editMode) return
                        if ((e.target as HTMLElement).closest('a')) return
                        onEntryClick?.(entry)
                      }}
                    >
                      {(isOwner || isAdmin) && onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
                          className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full flex items-center justify-center text-[9px]"
                          style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}
                        >✕</button>
                      )}
                      {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="w-full">{imgEl}</a> : imgEl}
                      <span
                        className="text-center leading-tight"
                        style={{ color: i <= 2 ? 'var(--foreground)' : 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%', textAlign: 'center' }}
                      >
                        {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                      </span>
                      {editMode && onMoveTier && (
                        <select
                          value={entry.tier_id ?? ''}
                          onChange={e => { e.stopPropagation(); onMoveTier(entry.id, e.target.value) }}
                          onClick={e => e.stopPropagation()}
                          className="w-full rounded outline-none cursor-pointer"
                          style={{ fontSize: '0.6rem', background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 2px' }}
                        >
                          {tierData.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      )}
                      {!editMode && (entry.notes || isAdmin) && (
                        <div className="w-full text-center" style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                          <EditableText value={entry.notes ?? ''} onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()} multiline placeholder="Notes…" className="text-[0.6rem]" style={{ color: 'var(--muted)' }} />
                        </div>
                      )}
                      {!editMode && (commentCounts[entry.id] ?? 0) > 0 && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>
                      )}
                      {!editMode && ['🔥', '❤️', '😮', '😂', '👏']
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
                    className={`flex flex-col items-center gap-1${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
                    style={{
                      width: '56px',
                      position: 'relative',
                      outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none',
                      outlineOffset: '2px',
                      borderRadius: '4px',
                    }}
                    onClick={(e) => {
                      if (isAdmin || editMode) return
                      if ((e.target as HTMLElement).closest('a')) return
                      onEntryClick?.(entry)
                    }}
                  >
                    {(isOwner || isAdmin) && onDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full flex items-center justify-center text-[9px]" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                    )}
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
                    {!editMode && (entry.notes || isAdmin) && (
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

function SortableTierRankedEntry({
  entry, color, editMode, isAdmin, isOwner, onDelete, onMoveTier, tiers,
  posters, onEntryClick, commentCounts, entryReactions, selectedEntryId,
}: {
  entry: ListEntry; color: string; editMode: boolean; isAdmin: boolean; isOwner: boolean
  onDelete?: (id: string) => void; onMoveTier?: (entryId: string, tierId: string) => void
  tiers: Tier[]; posters: Record<string, PosterInfo>; onEntryClick?: (e: ListEntry) => void
  commentCounts: Record<string, number>; entryReactions: Record<string, Record<string, number>>
  selectedEntryId: string | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const info = posters[entry.id]
  const src = entry.image_url ?? info?.poster
  const imdbUrl = info?.imdbUrl

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
        background: selectedEntryId === entry.id ? `${color}10` : 'var(--surface)',
        border: `1px solid ${selectedEntryId === entry.id ? `${color}40` : 'var(--border)'}`,
      }}
      className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
      onClick={(e) => {
        if (isAdmin || editMode) return
        if ((e.target as HTMLElement).closest('a')) return
        onEntryClick?.(entry)
      }}
    >
      {editMode && (
        <button {...listeners} {...attributes} className="shrink-0 self-center text-base cursor-grab active:cursor-grabbing select-none" style={{ color: 'var(--muted)', touchAction: 'none' }}>⠿</button>
      )}
      <span className="text-xs font-bold w-6 shrink-0 text-right tabular-nums mt-2.5" style={{ color: `${color}70` }}>{entry.rank}</span>
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
        {editMode && onMoveTier && (
          <select
            value={entry.tier_id ?? ''}
            onChange={e => { e.stopPropagation(); onMoveTier(entry.id, e.target.value) }}
            onClick={e => e.stopPropagation()}
            className="mt-1 w-full text-xs rounded outline-none cursor-pointer"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '2px 4px' }}
          >
            {tiers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        )}
        {!editMode && (
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {(commentCounts[entry.id] ?? 0) > 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>}
            {['🔥', '❤️', '😮', '😂', '👏'].filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0).map(e => (
              <span key={e} className="text-xs" style={{ color: 'var(--muted)' }}>{e} {entryReactions![entry.id][e]}</span>
            ))}
          </div>
        )}
      </div>
      {(isOwner || isAdmin) && onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="shrink-0 self-center w-6 h-6 flex items-center justify-center rounded-full text-xs opacity-40 hover:opacity-100 transition-opacity" style={{ border: '1px solid #f87171', color: '#f87171' }}>✕</button>
      )}
    </div>
  )
}

function TierRankedEntries({
  entries,
  tiers: tierData,
  posters,
  isTheme = false,
  isAdmin = false,
  isOwner = false,
  onDelete,
  onMoveTier,
  onTierItemDragEnd,
  editMode = false,
  sensors,
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
  isOwner?: boolean
  onDelete?: (id: string) => void
  onMoveTier?: (entryId: string, tierId: string) => void
  onTierItemDragEnd?: (tierId: string, activeId: string, overId: string) => void
  editMode?: boolean
  sensors?: ReturnType<typeof useSensors>
  saveEntryField?: (id: string, field: string, value: string | number) => Promise<void>
  onEntryClick?: (entry: ListEntry) => void
  commentCounts?: Record<string, number>
  entryReactions?: Record<string, Record<string, number>>
  selectedEntryId?: string | null
}) {
  const fallbackSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const activeSensors = sensors ?? fallbackSensors

  function handleDragEnd(event: DragEndEvent, tierId: string) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      onTierItemDragEnd?.(tierId, String(active.id), String(over.id))
    }
  }

  // New format: group by tier_id using tiers data
  if (tierData.length > 0) {
    const entriesByTier = new Map<string, ListEntry[]>()
    for (const entry of [...entries].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))) {
      const key = entry.tier_id ?? 'none'
      if (!entriesByTier.has(key)) entriesByTier.set(key, [])
      entriesByTier.get(key)!.push(entry)
    }

    const unassignedTR = entriesByTier.get('none') ?? []

    return (
      <div className="space-y-10">
        {unassignedTR.length > 0 && (
          <div>
            <div className="rounded-xl overflow-hidden mb-4 px-6 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Unassigned entries</p>
              {editMode && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Use the tier dropdown on each entry to assign it</p>}
            </div>
            <div className="space-y-1.5">
              {unassignedTR.map((entry) => (
                <SortableTierRankedEntry
                  key={entry.id}
                  entry={entry}
                  color="var(--muted)"
                  editMode={editMode}
                  isAdmin={isAdmin}
                  isOwner={isOwner}
                  onDelete={onDelete}
                  onMoveTier={onMoveTier}
                  tiers={tierData}
                  posters={posters}
                  onEntryClick={onEntryClick}
                  commentCounts={commentCounts}
                  entryReactions={entryReactions}
                  selectedEntryId={selectedEntryId ?? null}
                />
              ))}
            </div>
          </div>
        )}
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
                <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black select-none pointer-events-none leading-none" style={{ fontSize: '5rem', color: `${color}12` }}>{tierIndex + 1}</span>
                <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-1" style={{ color: `${color}70` }}>Tier {tierIndex + 1}</p>
                <h3 className="text-lg font-bold" style={{ color }}>{tier.label}</h3>
              </div>

              <DndContext sensors={activeSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, tier.id)}>
                <SortableContext items={tierEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {tierEntries.map((entry) => (
                      <SortableTierRankedEntry
                        key={entry.id}
                        entry={entry}
                        color={color}
                        editMode={editMode}
                        isAdmin={isAdmin}
                        isOwner={isOwner}
                        onDelete={onDelete}
                        onMoveTier={onMoveTier}
                        tiers={tierData}
                        posters={posters}
                        onEntryClick={onEntryClick}
                        commentCounts={commentCounts}
                        entryReactions={entryReactions}
                        selectedEntryId={selectedEntryId ?? null}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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

            {/* Entries — legacy path now uses same sortable component as new format */}
            <DndContext sensors={activeSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, tier)}>
              <SortableContext items={tierEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {tierEntries.map((entry) => (
                    <SortableTierRankedEntry
                      key={entry.id}
                      entry={entry}
                      color={color}
                      editMode={editMode}
                      isAdmin={isAdmin}
                      isOwner={isOwner}
                      onDelete={onDelete}
                      onMoveTier={undefined}
                      tiers={[]}
                      posters={posters}
                      onEntryClick={onEntryClick}
                      commentCounts={commentCounts}
                      entryReactions={entryReactions}
                      selectedEntryId={selectedEntryId ?? null}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )
      })}
    </div>
  )
}
