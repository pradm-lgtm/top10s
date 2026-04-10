'use client'

import { useState, useEffect, use, useRef } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { entryRarityKey, type RarityResponse } from '@/app/api/entries/rarity/route'
import { fetchPosters } from '@/lib/tmdb'
import { useAdmin } from '@/context/admin'
import { useAuth } from '@/context/auth'
import { EditableText } from '@/components/EditableText'
import { EntryDrawer } from '@/components/EntryDrawer'
import ShareSheet from '@/components/ShareSheet'
import { RichTextEditor } from '@/components/RichTextEditor'
import { parseNotes, tiptapToHtml, notesToPlainText } from '@/lib/notes'
import { AddToListSheet } from '@/components/AddToListSheet'
import { InviteButton } from '@/components/InviteButton'
import type { TiptapDoc } from '@/lib/notes'
import type { PosterInfo } from '@/lib/tmdb'
import type { List, ListEntry, Tier, Comment, ReactionCount, HonorableMention, AlsoWatched, Topic } from '@/types'
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

// ── Rare pick badge ───────────────────────────────────────────────────────────

// RarePickBadge intentionally hidden — tracking continues in backend (/api/entries/rarity)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RarePickBadge({ pct, category }: { pct: number; category: 'movies' | 'tv' }) {
  return null
}

function IconTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block z-10"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        {label}
      </span>
    </div>
  )
}

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
  const [newEntryNotes, setNewEntryNotes] = useState<TiptapDoc | null>(null)
  const [newEntryPosterUrl, setNewEntryPosterUrl] = useState<string | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)
  // Tiered add form
  const [addingTieredEntry, setAddingTieredEntry] = useState(false)
  const [newTieredTitle, setNewTieredTitle] = useState('')
  const [newTieredTierId, setNewTieredTierId] = useState<string | null>(null)
  const [newTieredNotes, setNewTieredNotes] = useState<TiptapDoc | null>(null)
  const [newTieredPosterUrl, setNewTieredPosterUrl] = useState<string | null>(null)
  const [savingTieredEntry, setSavingTieredEntry] = useState(false)
  const [commentNameInput, setCommentNameInput] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; username: string; display_name: string | null }[]>([])
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [pendingListReaction, setPendingListReaction] = useState<string | null>(null)
  const [listReactionNameInput, setListReactionNameInput] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<ListEntry | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [entryReactions, setEntryReactions] = useState<Record<string, Record<string, number>>>({})
  const { isAdmin } = useAdmin()
  const { user, profile } = useAuth()
  const [isOwner, setIsOwner] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [descriptionDoc, setDescriptionDoc] = useState<TiptapDoc | null>(null)
  const entriesSnap = useRef<ListEntry[]>([])
  const tiersSnap = useRef<Tier[]>([])
  const [savingDescription, setSavingDescription] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [addToListEntry, setAddToListEntry] = useState<{ title: string; image_url: string | null } | null>(null)
  const [addToListToast, setAddToListToast] = useState<string | null>(null)
  const [similarLists, setSimilarLists] = useState<{ id: string; title: string; overlap: number; is_version: boolean; owner: { username: string; display_name: string | null; avatar_url: string | null } | null }[]>([])
  const [rarePicks, setRarePicks] = useState<Map<string, number>>(new Map())
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromCompare = searchParams.get('from')

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

  // Initialize descriptionDoc once when list loads (skip if user has already started editing)
  useEffect(() => {
    if (descriptionDoc !== null || !list?.description) return
    const doc = parseNotes(list.description)
    setDescriptionDoc(doc ?? {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: list.description }] }],
    })
  }, [list?.description])

  // Auto-register auth users as visitors so they don't get name-prompted on fresh devices
  useEffect(() => {
    if (!user || !profile) return
    // Already has a visitor ID on this device
    if (localStorage.getItem('visitor_id')) return
    const userKey = `visitor_id_for_${user.id}`
    const cached = localStorage.getItem(userKey)
    if (cached) {
      const displayName = profile.display_name ?? profile.username
      localStorage.setItem('visitor_id', cached)
      localStorage.setItem('visitor_name', displayName)
      setVisitorId(cached)
      setVisitorName(displayName)
    } else {
      const displayName = profile.display_name ?? profile.username
      supabase.from('visitors').insert({ name: displayName }).select('id').single().then(({ data }) => {
        const newId = data?.id ?? crypto.randomUUID()
        localStorage.setItem('visitor_id', newId)
        localStorage.setItem(`visitor_id_for_${user.id}`, newId)
        localStorage.setItem('visitor_name', displayName)
        setVisitorId(newId)
        setVisitorName(displayName)
      })
    }
  }, [user, profile])

  async function fetchAll(vid: string) {
    const [listRes, entriesRes, commentsRes, reactionsRes, hmRes, awRes, tiersRes] = await Promise.all([
      supabase.from('lists').select('*, profiles(username, display_name, avatar_url), topics(slug, title)').eq('id', id).single(),
      supabase.from('list_entries').select('*').eq('list_id', id).order('rank'),
      supabase
        .from('comments')
        .select('*, visitors(name)')
        .eq('list_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('reactions').select('emoji, visitor_id, visitors(name)').eq('list_id', id),
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
      if (entryIds.length > 0) {
        const [{ data: commentData }, { data: reactionData }] = await Promise.all([
          supabase.from('entry_comments').select('list_entry_id').in('list_entry_id', entryIds),
          supabase.from('entry_reactions').select('list_entry_id, emoji').in('list_entry_id', entryIds),
        ])
        const counts: Record<string, number> = {}
        for (const row of commentData ?? []) {
          counts[row.list_entry_id] = (counts[row.list_entry_id] ?? 0) + 1
        }
        setCommentCounts(counts)
        const reacs: Record<string, Record<string, number>> = {}
        for (const row of reactionData ?? []) {
          if (!reacs[row.list_entry_id]) reacs[row.list_entry_id] = {}
          reacs[row.list_entry_id][row.emoji] = (reacs[row.list_entry_id][row.emoji] ?? 0) + 1
        }
        setEntryReactions(reacs)
      }
    }
    if (commentsRes.data) setComments(commentsRes.data as Comment[])

    if (reactionsRes.data) {
      const counts: Record<string, { count: number; reacted: boolean; names: string[] }> = {}
      for (const emoji of EMOJIS) {
        counts[emoji] = { count: 0, reacted: false, names: [] }
      }
      for (const r of reactionsRes.data) {
        if (counts[r.emoji]) {
          counts[r.emoji].count++
          if (r.visitor_id === vid) counts[r.emoji].reacted = true
          const name = (r as { visitors?: { name?: string } }).visitors?.name
          if (name) counts[r.emoji].names.push(name)
        }
      }
      setReactions(EMOJIS.map((e) => ({ emoji: e, ...counts[e] })))
    }

    if (hmRes.data) setHonorableMentions(hmRes.data)
    if (awRes.data) setAlsoWatched(awRes.data)
    if (tiersRes.data) setTiers(tiersRes.data)

    setLoading(false)

    // Fetch similar lists + rarity data lazily after main content renders
    const listCategory = listRes.data?.category
    const listFeatured = listRes.data?.featured
    setTimeout(async () => {
      try {
        const [similarRes, rarityRes] = await Promise.all([
          fetch(`/api/lists/similar?listId=${id}`),
          // Only fetch rarity for user-created lists; featured/editorial skip
          listCategory && !listFeatured
            ? fetch(`/api/entries/rarity?category=${listCategory}`)
            : Promise.resolve(null),
        ])
        if (similarRes.ok) setSimilarLists(await similarRes.json())
        if (rarityRes?.ok) {
          const data: RarityResponse = await rarityRes.json()
          if (data.minListsMet) {
            setRarePicks(new Map(Object.entries(data.rare)))
          }
        }
      } catch { /* non-fatal */ }
    }, 500)
  }

  async function saveListField(field: string, value: string | boolean) {
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
    if (isAdmin) {
      await fetch(`/api/admin/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    } else if (isOwner) {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/lists/${id}/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ [field]: value }),
      })
    }
    setEntries((prev) => {
      const updated = prev.map((e) => e.id === entryId ? { ...e, [field]: value } : e)
      entriesSnap.current = updated
      return updated
    })
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!newEntryTitle.trim()) return
    setSavingEntry(true)
    const rank = Math.max(0, ...entries.map(e => e.rank ?? 0)) + 1
    const session = await getSession()
    const res = await fetch(`/api/lists/${id}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        rank,
        title: newEntryTitle.trim(),
        notes: newEntryNotes ? JSON.stringify(newEntryNotes) : null,
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
      setNewEntryNotes(null)
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
        notes: newTieredNotes ? JSON.stringify(newTieredNotes) : null,
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
      setNewTieredNotes(null)
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

  // ── Tier editing is staged: all changes are local-only until "Save" ──────────

  function moveEntryToTier(entryId: string, tierId: string) {
    const isRealTier = tiers.some(t => t.id === tierId)
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e
      return isRealTier
        ? { ...e, tier_id: tierId || null, tier: null }
        : { ...e, tier: tierId || null, tier_id: null }
    }))
  }

  function addTier(label: string, color: string) {
    const tempId = crypto.randomUUID()
    setTiers(prev => [...prev, { id: tempId, list_id: id, label, color, position: prev.length, created_at: '' }])
  }

  function updateTier(tierId: string, fields: Partial<Pick<Tier, 'label' | 'color' | 'position'>>) {
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, ...fields } : t))
  }

  function deleteTier(tierId: string) {
    const hasEntries = entries.some(e => e.tier_id === tierId || e.tier === tierId)
    if (hasEntries) { alert('Move all entries out of this tier before deleting it.'); return }
    setTiers(prev => prev.filter(t => t.id !== tierId))
  }

  async function saveAndExitEdit() {
    setSaving(true)
    const session = await getSession()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }
    const origTierIds = new Set(tiersSnap.current.map(t => t.id))
    const tempIdToReal = new Map<string, string>()

    // 1. Create new tiers (IDs not in snapshot)
    for (const tier of tiers) {
      if (!origTierIds.has(tier.id)) {
        const res = await fetch(`/api/lists/${id}/tiers`, {
          method: 'POST', headers,
          body: JSON.stringify({ label: tier.label, color: tier.color, position: tier.position }),
        })
        if (res.ok) { const created = await res.json(); tempIdToReal.set(tier.id, created.id) }
      }
    }

    // 2. Update changed tiers
    const origTierMap = new Map(tiersSnap.current.map(t => [t.id, t]))
    for (const tier of tiers) {
      if (origTierIds.has(tier.id)) {
        const orig = origTierMap.get(tier.id)!
        if (orig.label !== tier.label || orig.color !== tier.color || orig.position !== tier.position) {
          await fetch(`/api/lists/${id}/tiers/${tier.id}`, {
            method: 'PATCH', headers,
            body: JSON.stringify({ label: tier.label, color: tier.color, position: tier.position }),
          })
        }
      }
    }

    // 3. Delete removed tiers
    const currTierIds = new Set(tiers.map(t => t.id))
    for (const orig of tiersSnap.current) {
      if (!currTierIds.has(orig.id)) {
        await fetch(`/api/lists/${id}/tiers/${orig.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } })
      }
    }

    // 4. Persist changed entry tier assignments (resolve temp IDs → real IDs)
    const origEntryMap = new Map(entriesSnap.current.map(e => [e.id, e]))
    await Promise.all(entries.map(entry => {
      const orig = origEntryMap.get(entry.id)
      if (!orig) return Promise.resolve()
      const resolvedTierId = entry.tier_id ? (tempIdToReal.get(entry.tier_id) ?? entry.tier_id) : null
      const tierIdChanged = orig.tier_id !== resolvedTierId
      const tierChanged = orig.tier !== entry.tier
      if (tierIdChanged || tierChanged) {
        return fetch(`/api/lists/${id}/entries/${entry.id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ tier_id: resolvedTierId, tier: entry.tier ?? null }),
        })
      }
      return Promise.resolve()
    }))

    // Also persist rank changes (from drag-reorder within tiers)
    await Promise.all(entries.map(entry => {
      const orig = origEntryMap.get(entry.id)
      if (!orig) return Promise.resolve()
      if (orig.rank !== entry.rank) {
        return fetch(`/api/lists/${id}/entries/${entry.id}`, {
          method: 'PATCH', headers,
          body: JSON.stringify({ rank: entry.rank }),
        })
      }
      return Promise.resolve()
    }))

    // Update local state with real IDs for newly created tiers
    if (tempIdToReal.size > 0) {
      setTiers(prev => prev.map(t => ({ ...t, id: tempIdToReal.get(t.id) ?? t.id })))
      setEntries(prev => prev.map(e => ({ ...e, tier_id: e.tier_id ? (tempIdToReal.get(e.tier_id) ?? e.tier_id) : null })))
    }

    setSaving(false)
    setEditMode(false)
  }

  function cancelEdit() {
    setEntries(entriesSnap.current)
    setTiers(tiersSnap.current)
    setEditMode(false)
  }

  // Warn / auto-discard when navigating away with unsaved tier changes
  useEffect(() => {
    if (!editMode) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      // Auto-discard staged changes when component unmounts while in edit mode
      setEntries(entriesSnap.current)
      setTiers(tiersSnap.current)
    }
  }, [editMode])

  function isUUID(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  }

  function handleTierItemDragEnd(tierId: string, draggedId: string, overId: string) {
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
  }

  function handleTiersDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = tiers.findIndex(t => t.id === active.id)
    const newIdx = tiers.findIndex(t => t.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    setTiers(arrayMove(tiers, oldIdx, newIdx).map((t, i) => ({ ...t, position: i })))
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
          ? {
              ...r,
              count: r.count + (hasReacted ? -1 : 1),
              reacted: !r.reacted,
              names: hasReacted
                ? r.names.filter((n) => n !== visitorName)
                : visitorName ? [...r.names, visitorName] : r.names,
            }
          : r
      )
    )

    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: id, visitor_id: vid, emoji, action: hasReacted ? 'remove' : 'add' }),
    })
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
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: id, visitor_id: vid, content: newComment.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setComments((prev) => [data as Comment, ...prev])
      setNewComment('')
    }
    setSubmittingComment(false)
  }

  function renderMentions(text: string) {
    return text.split(/(@\w+)/g).map((part, i) =>
      /^@\w+$/.test(part)
        ? <span key={i} style={{ color: '#e8c547', fontWeight: 600 }}>{part}</span>
        : <span key={i}>{part}</span>
    )
  }

  async function fetchMentionSuggestions(q: string) {
    const res = await fetch(`/api/profiles/mention-search?q=${encodeURIComponent(q)}`)
    if (res.ok) setMentionSuggestions(await res.json())
    else setMentionSuggestions([])
  }

  function selectMention(username: string) {
    if (mentionStart === null) return
    const textarea = commentTextareaRef.current
    const cursor = textarea?.selectionStart ?? newComment.length
    const before = newComment.slice(0, mentionStart)
    const after = newComment.slice(cursor)
    const next = `${before}@${username} ${after}`
    setNewComment(next)
    setMentionSuggestions([])
    setTimeout(() => {
      if (textarea) {
        const pos = mentionStart + username.length + 2
        textarea.focus()
        textarea.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  function formatReactorNames(names: string[]): string {
    if (names.length === 0) return ''
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`
  }

  const isMovie = list?.category === 'movies'
  const accentColor = isMovie ? 'var(--accent)' : '#a78bfa'

  // For legacy lists (no DB tiers), derive virtual tiers from entry.tier strings.
  // When DB tiers exist, also include any legacy entry.tier strings not covered by DB tier labels
  // (e.g. if tiers were added before some entries had tier_id set, or older entries predate the tiers table).
  // Legacy tiers are placed before DB tiers to preserve original ordering.
  const effectiveTiers: Tier[] = (() => {
    if (tiers.length === 0) {
      return [...new Map(entries.filter(e => e.tier).map(e => [e.tier!, e.tier!])).keys()]
        .map((t, i) => ({ id: t, list_id: id, label: t, color: null, position: i, created_at: '' }))
    }
    const tierByLabel = new Map(tiers.map(t => [t.label, t]))
    const legacyLabels = [...new Set(
      entries.filter(e => e.tier && !e.tier_id && !tierByLabel.has(e.tier)).map(e => e.tier!)
    )]
    if (legacyLabels.length === 0) return tiers
    const minPos = Math.min(...tiers.map(t => t.position ?? 0))
    const legacy: Tier[] = legacyLabels.map((lbl, i) => ({
      id: lbl, list_id: id, label: lbl, color: null,
      position: minPos - legacyLabels.length + i, created_at: '',
    }))
    return [...legacy, ...tiers]
  })()

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
            className="flex items-center text-sm transition-colors group"
            style={{ color: 'var(--muted)' }}
            onClick={(e) => {
              if (editMode) {
                e.preventDefault()
                if (confirm('Leave without saving? Your unsaved changes will be discarded.')) {
                  cancelEdit()
                  router.push('/home')
                }
              }
            }}
          >
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>Ranked</span>
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

            {/* Owner controls — hidden for featured/editorial lists */}
            {(isOwner || isAdmin) && !list.featured && (
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <button
                      onClick={saveAndExitEdit}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { entriesSnap.current = entries; tiersSnap.current = tiers; setEditMode(true) }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  >
                    ✎ Edit
                  </button>
                )}
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

      {/* Breadcrumb */}
      {list.profiles && (
        <div style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-3xl mx-auto px-4 py-2 flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12 }}>
            <Link href="/home" className="transition-opacity hover:opacity-70" style={{ color: 'var(--muted)' }}>
              Home
            </Link>
            <span style={{ color: 'var(--border)' }}>›</span>
            <Link href={`/${list.profiles.username}`} className="transition-opacity hover:opacity-70" style={{ color: 'var(--muted)' }}>
              {isOwner ? 'My Lists' : `${list.profiles.display_name ?? list.profiles.username}'s Lists`}
            </Link>
            <span style={{ color: 'var(--border)' }}>›</span>
            <span className="truncate" style={{ color: 'var(--foreground)', maxWidth: '60%' }}>{list.title}</span>
          </div>
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div className="px-4 py-2.5 flex items-center gap-3 text-sm font-medium" style={{ background: 'rgba(232,197,71,0.12)', borderBottom: '1px solid rgba(232,197,71,0.25)', color: 'var(--accent)' }}>
          <span>✎ Editing</span>
          <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>Drag ⠿ to reorder · ✕ to remove · changes save when you click Save</span>
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
          {fromCompare && (
            <Link
              href={fromCompare}
              className="inline-flex items-center gap-1.5 text-sm mb-6"
              style={{ color: 'var(--muted)' }}
            >
              ← Back to comparison
            </Link>
          )}
          <div
            className="text-xs tracking-[0.3em] uppercase font-medium mb-3"
            style={{ color: accentColor }}
          >
            {list.list_type === 'theme'
              ? (list.genre ?? 'All-Time')
              : `${list.year} · ${isMovie ? 'Movies' : 'TV Shows'}`}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            <EditableText
              value={list.title}
              onSave={(v) => saveListField('title', v)}
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              editable={(isAdmin || isOwner) && editMode}
            />
          </h1>
          {similarLists.length > 0 && list.topics?.slug && (
            <Link
              href={`/topic/${list.topics.slug}`}
              className="inline-block text-xs mb-3 transition-opacity hover:opacity-100 opacity-50"
              style={{ color: 'var(--foreground)' }}
            >
              Similar lists →
            </Link>
          )}
          <div className="flex items-center gap-3 mb-4">
            {list.featured ? (
              /* Source badge for featured/editorial lists */
              list.source_label && (
                list.source_url ? (
                  <a
                    href={list.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                      style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}
                    >
                      {list.source_label}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>↗</span>
                  </a>
                ) : (
                  <div
                    className="text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded"
                    style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}
                  >
                    {list.source_label}
                  </div>
                )
              )
            ) : (
              list.profiles && (
                <Link
                  href={`/${list.profiles.username}`}
                  className="flex items-center gap-2 w-fit"
                >
                  {list.profiles.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={list.profiles.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                    >
                      {(list.profiles.display_name ?? list.profiles.username)[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {list.profiles.display_name ?? list.profiles.username}
                  </span>
                </Link>
              )
            )}
            {/* Icon-only action buttons */}
            <div className="flex items-center gap-1">
              <IconTooltip label="Compare lists">
                <button
                  onClick={() => setShowCompare(true)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                  style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  aria-label="Compare lists"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="9" y="2" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                </button>
              </IconTooltip>
              <IconTooltip label="Share">
                <button
                  onClick={() => setShowShare(true)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                  style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  aria-label="Share"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 4l3-3 3 3M2 10v2.5h10V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </IconTooltip>
              {user && !list.featured && (
                <IconTooltip label="Invite a friend">
                  <InviteButton
                    topicTitle={list.title}
                    senderListId={isOwner ? list.id : null}
                    icon
                  />
                </IconTooltip>
              )}
              {user && !isOwner && (
                <IconTooltip label="Make your own version">
                  <button
                    onClick={() => {
                      posthog.capture('make_own_version_clicked', { list_id: list.id })
                      const params = new URLSearchParams({
                        title: list.title,
                        format: list.list_format,
                        category: list.category,
                        ...(list.year ? { year: String(list.year) } : {}),
                        originalListId: list.id,
                      })
                      router.push(`/create?${params.toString()}`)
                    }}
                    className="w-11 h-11 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
                    style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                    aria-label="Make your own version"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </IconTooltip>
              )}
            </div>
          </div>

          <div className="text-base max-w-xl mt-1">
            {(isAdmin || isOwner) && editMode ? (
              <div className="space-y-2">
                <RichTextEditor
                  value={list.description ?? null}
                  onChange={setDescriptionDoc}
                  placeholder="Add a description…"
                  minHeight={56}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!descriptionDoc) return
                    setSavingDescription(true)
                    await saveListField('description', JSON.stringify(descriptionDoc))
                    setSavingDescription(false)
                  }}
                  disabled={savingDescription || !descriptionDoc}
                  className="text-xs px-3 py-1 rounded font-semibold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  {savingDescription ? '…' : 'Save description'}
                </button>
              </div>
            ) : list.description ? (
              parseNotes(list.description) ? (
                <div
                  className="[&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-1"
                  style={{ color: 'var(--muted)', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: tiptapToHtml(parseNotes(list.description)!) }}
                />
              ) : (
                <p style={{ color: 'var(--muted)' }}>{list.description}</p>
              )
            ) : null}
          </div>


          {/* Admin: featured toggle + source fields */}
          {isAdmin && (
            <div className="mt-5 pt-4 flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={async () => {
                  await saveListField('featured', !list.featured)
                  setList((prev) => prev ? { ...prev, featured: !prev.featured } : prev)
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{
                  background: list.featured ? 'rgba(232,197,71,0.15)' : 'var(--surface)',
                  color: list.featured ? 'var(--accent)' : 'var(--muted)',
                  border: `1px solid ${list.featured ? 'rgba(232,197,71,0.4)' : 'var(--border)'}`,
                }}
              >
                {list.featured ? '★ Featured' : '☆ Mark as featured'}
              </button>
              <input
                type="text"
                defaultValue={list.source_label ?? ''}
                placeholder="Source label (e.g. IMDB)"
                onBlur={(e) => { if (e.target.value !== (list.source_label ?? '')) saveListField('source_label', e.target.value) }}
                className="text-xs px-3 py-1.5 rounded-lg outline-none flex-1 min-w-[140px] max-w-[200px]"
                style={{ background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
              <input
                type="text"
                defaultValue={list.source_url ?? ''}
                placeholder="Source URL"
                onBlur={(e) => { if (e.target.value !== (list.source_url ?? '')) saveListField('source_url', e.target.value) }}
                className="text-xs px-3 py-1.5 rounded-lg outline-none flex-1 min-w-[180px]"
                style={{ background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-20 space-y-12">
        {/* Entries */}
        <section>
          {list.list_format === 'tiered' ? (
            <>
              {(isOwner || isAdmin) && editMode && (
                <TierEditPanel
                  tiers={effectiveTiers}
                  sensors={sensors}
                  onDragEnd={handleTiersDragEnd}
                  onUpdate={updateTier}
                  onDelete={deleteTier}
                  onAdd={addTier}
                  hasEntries={(tierId) => entries.some(e => e.tier_id === tierId || e.tier === tierId)}
                />
              )}
              <TieredEntries entries={entries} tiers={effectiveTiers} accentColor={accentColor} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} isOwner={isOwner} onDelete={editMode ? deleteEntry : undefined} onMoveTier={editMode ? moveEntryToTier : undefined} editMode={editMode} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} rarePicks={rarePicks} category={list.category} />
              {(isOwner || isAdmin) && editMode && <TieredAddForm tiers={effectiveTiers} category={list.category} title={newTieredTitle} setTitle={setNewTieredTitle} posterUrl={newTieredPosterUrl} setPosterUrl={setNewTieredPosterUrl} tierId={newTieredTierId} setTierId={setNewTieredTierId} notes={newTieredNotes} setNotes={setNewTieredNotes} open={addingTieredEntry} setOpen={setAddingTieredEntry} saving={savingTieredEntry} onSubmit={addTieredEntry} />}
            </>
          ) : list.list_format === 'tier-ranked' ? (
            <>
              {(isOwner || isAdmin) && editMode && (
                <TierEditPanel
                  tiers={effectiveTiers}
                  sensors={sensors}
                  onDragEnd={handleTiersDragEnd}
                  onUpdate={updateTier}
                  onDelete={deleteTier}
                  onAdd={addTier}
                  hasEntries={(tierId) => entries.some(e => e.tier_id === tierId || e.tier === tierId)}
                />
              )}
              <TierRankedEntries entries={entries} tiers={effectiveTiers} posters={posters} isTheme={list.list_type === 'theme'} isAdmin={isAdmin} isOwner={isOwner} onDelete={editMode ? deleteEntry : undefined} onMoveTier={editMode ? moveEntryToTier : undefined} onTierItemDragEnd={editMode ? handleTierItemDragEnd : undefined} editMode={editMode} sensors={sensors} saveEntryField={saveEntryField} onEntryClick={handleEntryClick} commentCounts={commentCounts} entryReactions={entryReactions} selectedEntryId={selectedEntry?.id ?? null} visitorId={visitorId} rarePicks={rarePicks} category={list.category} />
              {(isOwner || isAdmin) && editMode && <TieredAddForm tiers={effectiveTiers} category={list.category} title={newTieredTitle} setTitle={setNewTieredTitle} posterUrl={newTieredPosterUrl} setPosterUrl={setNewTieredPosterUrl} tierId={newTieredTierId} setTierId={setNewTieredTierId} notes={newTieredNotes} setNotes={setNewTieredNotes} open={addingTieredEntry} setOpen={setAddingTieredEntry} saving={savingTieredEntry} onSubmit={addTieredEntry} />}
            </>
          ) : (
          <>
          {editMode ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRankedDragEnd}>
            <SortableContext items={entries.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
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
          ) : (
            <RankedRowList
              entries={entries}
              posters={posters}
              entryReactions={entryReactions}
              commentCounts={commentCounts}
              onEntryClick={handleEntryClick}
              onAddToList={user && !isOwner ? (e) => setAddToListEntry({ title: e.title, image_url: e.image_url ?? null }) : undefined}
              rarePicks={rarePicks}
              category={list.category}
            />
          )}

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
                  {newEntryPosterUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={newEntryPosterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" loading="lazy" />
                  )}
                  <RichTextEditor
                    value={newEntryNotes}
                    onChange={setNewEntryNotes}
                    placeholder="Notes (optional)"
                    minHeight={56}
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
              <div key={r.emoji} className="relative group">
                <button
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
                {r.names.length > 0 && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                  >
                    {formatReactorNames(r.names)}
                  </div>
                )}
              </div>
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
            <div className="relative">
              <textarea
                ref={commentTextareaRef}
                value={newComment}
                onChange={(e) => {
                  const val = e.target.value
                  setNewComment(val)
                  const cursor = e.target.selectionStart ?? val.length
                  let i = cursor - 1
                  let found = false
                  while (i >= 0 && /\S/.test(val[i])) {
                    if (val[i] === '@') {
                      const q = val.slice(i + 1, cursor)
                      if (q.length > 0) {
                        setMentionStart(i)
                        fetchMentionSuggestions(q)
                        found = true
                      }
                      break
                    }
                    i--
                  }
                  if (!found) setMentionSuggestions([])
                }}
                placeholder="Share your thoughts… use @ to mention someone"
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
              {mentionSuggestions.length > 0 && (
                <div
                  className="absolute z-50 bottom-full left-0 right-0 mb-1 rounded-lg overflow-hidden shadow-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {mentionSuggestions.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectMention(p.username) }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-opacity hover:opacity-75"
                      style={{ borderBottom: idx < mentionSuggestions.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span style={{ color: '#e8c547', fontWeight: 600 }}>@{p.username}</span>
                      {p.display_name && <span style={{ color: 'var(--muted)' }}>{p.display_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                    {renderMentions(comment.content)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Similar Lists */}
        {similarLists.length > 0 && (
          <section>
            {list.topics?.slug ? (
              <Link
                href={`/topic/${list.topics.slug}`}
                className="inline-block text-xs tracking-[0.3em] uppercase font-semibold mb-4 transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted)' }}
              >
                Similar Lists →
              </Link>
            ) : (
              <h2 className="text-xs tracking-[0.3em] uppercase font-semibold mb-4" style={{ color: 'var(--muted)' }}>
                Similar Lists
              </h2>
            )}
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {similarLists.map((s) => (
                <div
                  key={s.id}
                  className="shrink-0 rounded-xl p-4 flex flex-col gap-2"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', width: 220 }}
                >
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{s.title}</p>
                  {s.owner && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {s.owner.display_name ?? s.owner.username}
                    </p>
                  )}
                  {s.overlap > 0 && (
                    <p className="text-xs" style={{ color: 'var(--accent)' }}>
                      {s.overlap} {s.overlap === 1 ? 'title' : 'titles'} in common
                    </p>
                  )}
                  {s.is_version && (
                    <p className="text-xs" style={{ color: 'var(--accent)' }}>Version of this list</p>
                  )}
                  <Link
                    href={`/compare/${list.id}/${s.id}`}
                    className="mt-auto text-xs font-semibold px-3 py-1.5 rounded-lg text-center transition-opacity hover:opacity-80"
                    style={{ background: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                  >
                    Compare →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}
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
        rarePct={selectedEntry ? rarePicks.get(entryRarityKey(selectedEntry)) : undefined}
        category={list.category}
      />

      {showShare && (
        <ShareSheet
          listId={list.id}
          listTitle={list.title}
          url={typeof window !== 'undefined' ? window.location.href : ''}
          onClose={() => setShowShare(false)}
        />
      )}

      {showCompare && (
        <ComparePicker
          currentListId={list.id}
          category={list.category}
          onClose={() => setShowCompare(false)}
        />
      )}

      {addToListEntry && (
        <AddToListSheet
          entry={addToListEntry}
          onClose={() => setAddToListEntry(null)}
          onSuccess={(listTitle) => {
            setAddToListEntry(null)
            setAddToListToast(`Added to ${listTitle} ✓`)
            setTimeout(() => setAddToListToast(null), 3000)
          }}
        />
      )}

      {addToListToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)', whiteSpace: 'nowrap' }}
        >
          {addToListToast}
        </div>
      )}
    </div>
  )
}

// ── Compare Picker ───────────────────────────────────────────────────────────

type SearchResult = {
  id: string
  title: string
  year: number | null
  category: string
  list_type: string
  owner_id: string | null
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
}

function ComparePicker({
  currentListId,
  category,
  onClose,
}: {
  currentListId: string
  category: 'movies' | 'tv'
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await fetch(`/api/lists/search?category=${category}&q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults((data as SearchResult[]).filter((l: SearchResult) => l.id !== currentListId))
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, category, currentListId])

  function pick(listId: string) {
    onClose()
    router.push(`/compare/${currentListId}/${listId}`)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          maxHeight: '80vh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        <div className="px-5 pb-3 shrink-0">
          <h3 className="font-bold text-base mb-3">Compare with…</h3>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${category} lists…`}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 px-5 pb-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div
                className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>
              {query ? 'No lists found.' : 'Start typing to search lists…'}
            </p>
          ) : (
            <div className="space-y-1">
              {results.map(list => {
                const owner = list.profiles
                const label = owner?.display_name ?? owner?.username ?? 'Unknown'
                const initial = label[0]?.toUpperCase() ?? '?'
                return (
                  <button
                    key={list.id}
                    onClick={() => pick(list.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:opacity-80"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                  >
                    {owner?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={owner.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{list.title}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                        {label}{list.year ? ` · ${list.year}` : ''}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Collapsible section ──────────────────────────────────────────────────────

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
function tierLabelStyle(label: string): React.CSSProperties {
  const len = (label || '').length
  const fontSize = len <= 6 ? '16px' : len <= 12 ? '13px' : '11px'
  const fontWeight = len <= 6 ? 800 : 700
  return {
    fontSize,
    fontWeight,
    lineHeight: 1.2,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    wordBreak: 'break-word',
    padding: '0 6px',
    textAlign: 'center',
  }
}

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

// ─── RankedRowList ────────────────────────────────────────────────────────────

function RankedRowList({
  entries,
  posters,
  entryReactions,
  commentCounts,
  onEntryClick,
  onAddToList,
  rarePicks,
  category,
}: {
  entries: ListEntry[]
  posters: Record<string, PosterInfo>
  entryReactions: Record<string, Record<string, number>>
  commentCounts: Record<string, number>
  onEntryClick: (e: ListEntry) => void
  onAddToList?: (e: ListEntry) => void
  rarePicks?: Map<string, number>
  category?: 'movies' | 'tv'
}) {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const posterW = isDesktop ? 100 : 90
  const posterH = isDesktop ? 150 : 135
  const titleSize = isDesktop ? 17 : 16
  const descSize = isDesktop ? 13 : 12

  const REACTION_EMOJIS = ['🔥', '❤️', '😮', '😂', '👏']

  return (
    <div>
      {entries.map((entry, i) => {
        const rank = entry.rank ?? (i + 1)
        const isTop3 = rank <= 3
        const src = entry.image_url ?? posters[entry.id]?.poster
        const plainNotes = notesToPlainText(entry.notes)
        const hasNotes = plainNotes.trim().length > 0

        // Split first sentence for pull-quote styling
        const sentenceEnd = plainNotes.search(/[.!?](\s|$)/)
        const firstSentence = sentenceEnd >= 0 ? plainNotes.slice(0, sentenceEnd + 1) : ''
        const restText = sentenceEnd >= 0 ? plainNotes.slice(sentenceEnd + 1).trimStart() : plainNotes
        const showReadMore = plainNotes.length > 120

        // Non-zero reactions + comment count
        const activeReactions = REACTION_EMOJIS.filter(e => (entryReactions[entry.id]?.[e] ?? 0) > 0)
        const commentCount = commentCounts[entry.id] ?? 0
        const hasCounts = activeReactions.length > 0 || commentCount > 0

        return (
          <div key={entry.id}>
            {i > 0 && <div style={{ height: '0.5px', background: '#1a1a1a', margin: '0 16px' }} />}
            <div
              className="group"
              style={{ display: 'flex', gap: 10, padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => onEntryClick(entry)}
            >
              {/* Rank number */}
              <div
                style={{
                  width: 36,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  fontSize: rank <= 3 ? 28 : rank <= 9 ? 24 : 20,
                  fontWeight: rank <= 3 ? 800 : 700,
                  color: rank <= 3 ? '#f59e0b' : '#fff',
                  opacity: rank <= 3 ? 1 : rank <= 9 ? 0.5 : 0.35,
                  lineHeight: 1,
                  paddingBottom: 2,
                }}
              >
                {rank}
              </div>

              {/* Poster */}
              <div
                style={{
                  flexShrink: 0,
                  width: posterW,
                  height: posterH,
                  borderRadius: 5,
                  overflow: 'hidden',
                  background: '#111118',
                }}
              >
                {src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              {/* Text side */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {/* Title + rare badge */}
                <div style={{ marginBottom: hasNotes ? 4 : 0 }}>
                  <span
                    style={{
                      fontSize: titleSize,
                      fontWeight: 600,
                      color: '#fff',
                      lineHeight: 1.3,
                      marginRight: 6,
                    }}
                  >
                    {entry.title}
                  </span>
                  {(() => {
                    const pct = rarePicks?.get(entryRarityKey(entry))
                    return pct !== undefined && category
                      ? <RarePickBadge pct={pct} category={category} />
                      : null
                  })()}
                </div>

                {/* Description teaser */}
                {hasNotes && (
                  <>
                    <div
                      style={{
                        fontSize: descSize,
                        lineHeight: 1.6,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                      }}
                    >
                      {firstSentence && (
                        <span style={{ color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>
                          {firstSentence}{restText ? ' ' : ''}
                        </span>
                      )}
                      {restText && (
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {restText}
                        </span>
                      )}
                    </div>
                    {showReadMore && (
                      <span style={{ color: '#f59e0b', fontSize: 11, marginTop: 3, display: 'block' }}>
                        read more →
                      </span>
                    )}
                  </>
                )}

                {/* Reaction + comment counts */}
                {hasCounts && (
                  <div
                    style={{
                      display: 'flex', gap: 8, flexWrap: 'wrap',
                      marginTop: 'auto', paddingTop: 6,
                      fontSize: 11, color: '#555',
                    }}
                  >
                    {commentCount > 0 && <span>💬 {commentCount}</span>}
                    {activeReactions.map(e => (
                      <span key={e}>{e} {entryReactions[entry.id][e]}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* + Add to list button — desktop: hover only, mobile: always visible */}
              {onAddToList && (
                <button
                  onClick={(ev) => { ev.stopPropagation(); onAddToList(entry) }}
                  className="shrink-0 self-center w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                  title="Add to my list"
                >
                  +
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
        className={`rounded-xl p-3 sm:p-4 transition-colors${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
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
        {/* Top row: drag · rank · poster · title · delete */}
        <div className="flex items-start gap-3">
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
          <div
            className="text-xl font-bold w-7 shrink-0 tabular-nums leading-none mt-0.5"
            style={{ color: index === 0 ? accentColor : index < 3 ? 'var(--foreground)' : 'var(--muted)' }}
          >
            {entry.rank ?? index + 1}
          </div>
          {/* Poster — left side */}
          {src ? (
            imdbUrl ? (
              <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded" loading="lazy" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded shrink-0" loading="lazy" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }} />
            )
          ) : (
            <div
              className="w-8 h-12 rounded shrink-0 flex items-end justify-center pb-1 overflow-hidden"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: pending ? 0.4 : 1 }}
            >
              {!pending && <span className="text-[9px] text-center leading-tight px-1" style={{ color: 'var(--muted)' }}>{entry.title}</span>}
            </div>
          )}
          {/* Title + reactions */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-semibold text-sm leading-snug">
              <EditableText
                value={entry.title}
                onSave={(v) => saveEntryField(entry.id, 'title', v)}
                className="font-semibold text-sm"
                editable={isAdmin && !editMode}
                renderValue={(v) =>
                  imdbUrl && !isAdmin ? (
                    <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{v}</a>
                  ) : <>{v}</>
                }
              />
            </h3>
            <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
              {commentCounts[entry.id] > 0 && (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>
              )}
              {['🔥', '❤️', '😮', '😂', '👏']
                .filter(e => (entryReactions[entry.id]?.[e] ?? 0) > 0)
                .map(e => (
                  <span key={e} className="text-xs" style={{ color: 'var(--muted)' }}>{e} {entryReactions[entry.id][e]}</span>
                ))}
            </div>
          </div>
          {(isAdmin || isOwner) && editMode && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
              className="shrink-0 text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ border: '1px solid #f87171', color: '#f87171' }}
              title="Delete entry"
            >✕</button>
          )}
        </div>
        {/* Bottom row: notes full width */}
        {(entry.notes || (isAdmin && !editMode) || (editMode && (isOwner || isAdmin))) && (
          <div className="mt-3">
            <ExpandableNotes
              value={entry.notes ?? ''}
              onSave={(v) => saveEntryField(entry.id, 'notes', v)}
              editable={(isAdmin && !editMode) || (editMode && (isOwner || isAdmin))}
              placeholder="Add a note…"
            />
          </div>
        )}
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbResult[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? ''
  const type = category === 'movies' ? 'movie' : 'tv'

  // Sync reset when parent clears the value (e.g. after form submission)
  useEffect(() => { if (!value) setQuery('') }, [value])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim() || !apiKey) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query.trim())}&api_key=${apiKey}&page=1`
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
  }, [query, type, apiKey])

  return (
    <div className="relative flex-1">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(false) }}
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
                onClick={() => { onSelect(r.title, r.posterUrl); setQuery(''); setOpen(false); setResults([]) }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {r.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" loading="lazy" />
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
  notes: TiptapDoc | null; setNotes: (v: TiptapDoc | null) => void
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
              <img src={posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0" loading="lazy" />
            )}
            <TmdbSearchInput
              category={category}
              value={title}
              onChange={(v) => { setTitle(v); if (!v.trim()) setPosterUrl(null) }}
              onSelect={(t, p) => { setTitle(t); setPosterUrl(p) }}
              placeholder={category === 'movies' ? 'Search movies…' : 'Search TV shows…'}
            />
          </div>
          <RichTextEditor
            value={notes}
            onChange={setNotes}
            placeholder="Notes (optional)"
            minHeight={56}
          />
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

function ExpandableNotes({ value, onSave, editable = false, placeholder }: {
  value: string
  onSave?: (v: string) => Promise<void>
  editable?: boolean
  placeholder?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDoc, setEditDoc] = useState<TiptapDoc | null>(null)
  const [saving, setSaving] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const doc = parseNotes(value)
  const isJson = !!doc
  const html = isJson ? tiptapToHtml(doc) : null

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setOverflows(el.scrollHeight > el.clientHeight + 2)
  }, [value, expanded])

  // Pre-seed editDoc when entering editing mode so Save works even if the
  // user doesn't type anything (Tiptap's onUpdate only fires on changes).
  function startEditing() {
    setEditDoc(doc ?? { type: 'doc', content: [{ type: 'paragraph' }] })
    setEditing(true)
  }

  if (!value && !editable) return null

  if (editing) {
    return (
      <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
        <RichTextEditor
          value={doc ?? value}
          onChange={setEditDoc}
          placeholder={placeholder}
          autoFocus
          minHeight={72}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              if (!editDoc) return
              setSaving(true)
              await onSave?.(JSON.stringify(editDoc))
              setSaving(false)
              setEditing(false)
            }}
            className="px-3 py-1 rounded text-xs font-semibold"
            style={{ background: 'var(--accent)', color: '#0a0a0f' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(false) }}
            className="px-3 py-1 rounded text-xs"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const CLAMP_HEIGHT = '2.8rem' // ≈ 2 lines at 14px/1.6

  if (!value && editable) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); startEditing() }}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded"
        style={{ color: 'var(--accent)', border: '1px dashed var(--accent)', opacity: 0.6 }}
      >
        <span>✎</span> Add a note
      </button>
    )
  }

  return (
    <div className="w-full">
      <div
        ref={contentRef}
        className={isJson ? 'rich-notes' : undefined}
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--muted)',
          ...(isJson ? {
            maxHeight: expanded ? 'none' : CLAMP_HEIGHT,
            overflow: expanded ? 'visible' : 'hidden',
          } : {
            overflow: expanded || value.length <= 120 ? 'visible' : 'hidden',
            display: expanded || value.length <= 120 ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded || value.length <= 120 ? undefined : 2,
            WebkitBoxOrient: 'vertical' as const,
            whiteSpace: 'pre-wrap',
          }),
          cursor: editable ? 'pointer' : 'default',
        }}
        onClick={editable ? (e) => { e.stopPropagation(); startEditing() } : undefined}
      >
        {isJson ? (
          <div dangerouslySetInnerHTML={{ __html: html! }} />
        ) : value}
      </div>
      {editable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); startEditing() }}
          className="flex items-center gap-1 text-xs mt-1"
          style={{ color: 'var(--muted)', opacity: 0.4 }}
          title="Edit note"
        >
          ✎ Edit note
        </button>
      )}
      {(isJson ? overflows || expanded : value.length > 120) && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          className="text-xs mt-1"
          style={{ color: 'var(--muted)', opacity: 0.6 }}
        >
          {expanded ? 'show less' : 'read more'}
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
  rarePicks,
  category,
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
  rarePicks?: Map<string, number>
  category?: 'movies' | 'tv'
}) {
  // New format: group by tier_id using tiers data
  if (tierData.length > 0) {
    // tier label → DB tier id (for entries that match by label but lack tier_id)
    const tierByLabel = new Map(tierData.map(t => [t.label, t.id]))
    const entriesByTier = new Map<string, ListEntry[]>()
    for (const entry of entries) {
      // 1. tier_id  2. matching label  3. legacy tier string (own bucket)  4. unassigned
      const key = entry.tier_id ?? tierByLabel.get(entry.tier ?? '') ?? entry.tier ?? 'none'
      if (!entriesByTier.has(key)) entriesByTier.set(key, [])
      entriesByTier.get(key)!.push(entry)
    }

    // Virtual tier groups: legacy tier strings that don't map to any DB tier
    const dbTierIds = new Set(tierData.map(t => t.id))
    const virtualLabels = [...new Set(
      entries.filter(e => e.tier && !e.tier_id && !tierByLabel.has(e.tier)).map(e => e.tier!)
    )]
    const allDisplayTiers = [
      ...tierData.map((t, i) => ({ id: t.id, label: t.label, color: t.color ?? TIER_COLORS[i] ?? accentColor })),
      ...virtualLabels.map((lbl, vi) => ({ id: lbl, label: lbl, color: TIER_COLORS[tierData.length + vi] ?? accentColor })),
    ]
    void dbTierIds // suppress unused-var lint

    const unassigned = entriesByTier.get('none') ?? []

    return (
      <div className="space-y-2">
        {unassigned.length > 0 && (
          <div className="rounded-xl overflow-hidden flex items-stretch" style={{ border: '1px solid var(--border)' }}>
            <div className="flex flex-col items-center justify-center py-3 shrink-0 text-center overflow-hidden" style={{ width: 88, minWidth: 88, background: 'var(--surface-2)', borderRight: '2px solid var(--border)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Unassigned</span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 items-end">
              {unassigned.map((entry) => {
                const poster = entry.image_url ?? posters[entry.id]?.poster
                const imgEl = poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt={entry.title} className="rounded object-cover w-full" loading="lazy" style={{ height: '78px' }} />
                ) : (
                  <div className="rounded w-full" style={{ height: '78px', background: 'var(--surface-2)' }} />
                )
                return (
                  <div key={entry.id} className="flex flex-col items-center gap-1" style={{ width: '56px', position: 'relative' }}>
                    {(isOwner || isAdmin) && onDelete && (
                      <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                    )}
                    {imgEl}
                    <span className="text-center leading-tight" style={{ color: 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%', minHeight: '1.625rem' }}>{entry.title}</span>
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
        {allDisplayTiers.map((tier, i) => {
          const tierEntries = entriesByTier.get(tier.id) ?? []
          const color = tier.color
          const label = tier.label

          return (
            <div
              key={tier.id}
              className="rounded-xl overflow-hidden flex items-stretch"
              style={{ border: `1px solid ${color}22` }}
            >
              <div
                className="flex flex-col items-center justify-center py-3 shrink-0 text-center overflow-hidden"
                style={{ width: 80, minWidth: 80, maxWidth: 80, background: `${color}12`, borderRight: `2px solid ${color}28` }}
              >
                <span
                  title={label}
                  style={{
                    color,
                    ...tierLabelStyle(label),
                  }}
                >
                  {label}
                </span>
              </div>
              <div className={editMode ? 'flex flex-col gap-2 p-3' : 'flex flex-wrap gap-2 p-3 items-end'} style={{ background: `${color}05`, flex: 1 }}>
                {tierEntries.length === 0 && (
                  <span className="text-xs italic self-center py-1 px-2 rounded" style={{ color: 'var(--muted)', opacity: 0.5 }}>Empty</span>
                )}
                {tierEntries.map((entry) => {
                  const poster = entry.image_url ?? posters[entry.id]?.poster
                  const imdbUrl = posters[entry.id]?.imdbUrl
                  const imgEl = poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt={entry.title} className="rounded object-cover w-full" loading="lazy" style={{ height: '78px', border: `1px solid ${color}30`, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
                  ) : (
                    <div className="rounded w-full flex items-center justify-center" style={{ height: '78px', background: `${color}12`, border: `1px solid ${color}22` }} />
                  )
                  const hasNotes = !!entry.notes || (isAdmin && !editMode) || (editMode && (isOwner || isAdmin))
                  if (hasNotes) {
                    return (
                      <div
                        key={entry.id}
                        className={`w-full flex flex-col gap-2 rounded-lg p-2${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
                        style={{ position: 'relative', outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none', outlineOffset: '2px', background: `${color}08`, border: `1px solid ${color}18` }}
                        onClick={(e) => {
                          if (isAdmin || editMode) return
                          if ((e.target as HTMLElement).closest('a')) return
                          onEntryClick?.(entry)
                        }}
                      >
                        {(isOwner || isAdmin) && onDelete && (
                          <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                        )}
                        {/* Top row: poster + title */}
                        <div className="flex items-start gap-2">
                          <div className="shrink-0" style={{ width: 52 }}>
                            {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="block w-full">{imgEl}</a> : imgEl}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <span className="font-medium leading-snug" style={{ fontSize: '0.8rem', color: i <= 2 ? 'var(--foreground)' : 'var(--muted)' }}>
                              {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                            </span>
                            {!editMode && (() => {
                              const pct = rarePicks?.get(entryRarityKey(entry))
                              return pct !== undefined && category ? <span className="ml-1.5"><RarePickBadge pct={pct} category={category} /></span> : null
                            })()}
                            {!editMode && ((commentCounts[entry.id] ?? 0) > 0 || ['🔥','❤️','😮','😂','👏'].some(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)) && (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {(commentCounts[entry.id] ?? 0) > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>}
                                {['🔥','❤️','😮','😂','👏'].filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0).map(e => (
                                  <span key={e} style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{e}{entryReactions![entry.id][e]}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Notes */}
                        <ExpandableNotes
                          value={entry.notes ?? ''}
                          onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()}
                          editable={(isAdmin && !editMode) || (editMode && (isOwner || isAdmin))}
                          placeholder="Add a note…"
                        />
                        {/* Move-tier dropdown (edit mode) */}
                        {editMode && onMoveTier && (
                          <select
                            value={entry.tier_id ?? entry.tier ?? ''}
                            onChange={e => { e.stopPropagation(); onMoveTier(entry.id, e.target.value) }}
                            onClick={e => e.stopPropagation()}
                            className="w-full rounded outline-none cursor-pointer"
                            style={{ fontSize: '0.7rem', background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '3px 4px' }}
                          >
                            {tierData.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        )}
                      </div>
                    )
                  }
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
                        <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                      )}
                      {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="w-full">{imgEl}</a> : imgEl}
                      <span
                        className="text-center leading-tight"
                        style={{ color: i <= 2 ? 'var(--foreground)' : 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%', textAlign: 'center', minHeight: '1.625rem' }}
                      >
                        {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                      </span>
                      {editMode && onMoveTier && (
                        <select
                          value={entry.tier_id ?? entry.tier ?? ''}
                          onChange={e => { e.stopPropagation(); onMoveTier(entry.id, e.target.value) }}
                          onClick={e => e.stopPropagation()}
                          className="w-full rounded outline-none cursor-pointer"
                          style={{ fontSize: '0.6rem', background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 2px' }}
                        >
                          {tierData.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
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
              className="flex flex-col items-center justify-center py-3 shrink-0 text-center overflow-hidden"
              style={{ width: 88, minWidth: 88, background: `${color}12`, borderRight: `2px solid ${color}28` }}
            >
              <span className="text-sm font-bold" style={{ color }}>T{rank}</span>
              <span
                title={label.length > 15 ? label : undefined}
                style={{
                  color: `${color}bb`,
                  fontSize: label.length > 12 ? '0.6rem' : '0.7rem',
                  lineHeight: 1.2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  padding: '0 6px',
                  marginTop: 2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 500,
                }}
              >
                {label}
              </span>
            </div>

            {/* Movie cards */}
            <div
              className="flex flex-wrap gap-2 p-3 items-end"
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
                const hasNotes = !editMode && (!!entry.notes || isAdmin)
                if (hasNotes) {
                  return (
                    <div
                      key={entry.id}
                      className={`w-full flex flex-col gap-2 rounded-lg p-2${!isAdmin && !editMode ? ' cursor-pointer' : ''}`}
                      style={{ position: 'relative', outline: selectedEntryId === entry.id ? `2px solid ${color}` : 'none', outlineOffset: '2px', background: `${color}08`, border: `1px solid ${color}18` }}
                      onClick={(e) => {
                        if (isAdmin || editMode) return
                        if ((e.target as HTMLElement).closest('a')) return
                        onEntryClick?.(entry)
                      }}
                    >
                      {(isOwner || isAdmin) && onDelete && (
                        <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                      )}
                      <div className="flex items-start gap-2">
                        <div className="shrink-0" style={{ width: 52 }}>
                          {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="block w-full">{imgEl}</a> : imgEl}
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <span className="font-medium leading-snug" style={{ fontSize: '0.8rem', color: i <= 2 ? 'var(--foreground)' : 'var(--muted)' }}>
                            {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                          </span>
                          {((commentCounts[entry.id] ?? 0) > 0 || ['🔥','❤️','😮','😂','👏'].some(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0)) && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              {(commentCounts[entry.id] ?? 0) > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>💬 {commentCounts[entry.id]}</span>}
                              {['🔥','❤️','😮','😂','👏'].filter(e => (entryReactions?.[entry.id]?.[e] ?? 0) > 0).map(e => (
                                <span key={e} style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{e}{entryReactions![entry.id][e]}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <ExpandableNotes
                        value={entry.notes ?? ''}
                        onSave={(v) => saveEntryField ? saveEntryField(entry.id, 'notes', v) : Promise.resolve()}
                        editable={isAdmin && !editMode}
                        placeholder="Notes…"
                      />
                    </div>
                  )
                }
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
                      <button onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }} className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: '#ef4444', color: '#fff', border: '1px solid rgba(0,0,0,0.3)' }}>✕</button>
                    )}
                    {imdbUrl ? (
                      <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="w-full">{imgEl}</a>
                    ) : imgEl}
                    <span
                      className="text-center leading-tight"
                      style={{ color: i <= 2 ? 'var(--foreground)' : 'var(--muted)', fontSize: '0.65rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden', width: '100%', textAlign: 'center', minHeight: '1.625rem' }}
                    >
                      {imdbUrl ? <a href={imdbUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'inherit' }}>{entry.title}</a> : entry.title}
                    </span>
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
        {entries.length} films · Phases 1–4
      </p>
    </div>
  )
}

function SortableTierRankedEntry({
  entry, color, editMode, isAdmin, isOwner, onDelete, onMoveTier, tiers,
  posters, onEntryClick, commentCounts, entryReactions, selectedEntryId, saveEntryField,
}: {
  entry: ListEntry; color: string; editMode: boolean; isAdmin: boolean; isOwner: boolean
  onDelete?: (id: string) => void; onMoveTier?: (entryId: string, tierId: string) => void
  tiers: Tier[]; posters: Record<string, PosterInfo>; onEntryClick?: (e: ListEntry) => void
  commentCounts: Record<string, number>; entryReactions: Record<string, Record<string, number>>
  selectedEntryId: string | null
  saveEntryField?: (id: string, field: string, value: string | number) => Promise<void>
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
            <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded" loading="lazy" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={entry.title} className="w-8 h-12 object-cover rounded shrink-0 mt-1" loading="lazy" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
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
        {!editMode && entry.notes && (
          <div className="mt-1.5">
            <ExpandableNotes value={entry.notes} />
          </div>
        )}
        {editMode && saveEntryField && (
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <ExpandableNotes
              value={entry.notes ?? ''}
              onSave={(v) => saveEntryField(entry.id, 'notes', v)}
              editable
              placeholder="Add a description…"
            />
          </div>
        )}
        {editMode && onMoveTier && (
          <select
            value={entry.tier_id ?? entry.tier ?? ''}
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

// ─── TierRankedPosterGrid ─────────────────────────────────────────────────────

const TIER_GRID_COLS = 4
const TIER_REACTION_EMOJIS = ['🔥', '❤️', '😮', '😂', '👏']

function TierRankedPosterGrid({
  entries,
  posters,
  entryReactions,
  commentCounts,
  visitorId,
  onEntryClick,
  rarePicks,
  category,
}: {
  entries: ListEntry[]
  posters: Record<string, PosterInfo>
  entryReactions: Record<string, Record<string, number>>
  commentCounts: Record<string, number>
  visitorId: string
  onEntryClick?: (entry: ListEntry) => void
  rarePicks?: Map<string, number>
  category?: 'movies' | 'tv'
}) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [expandedReactions, setExpandedReactions] = useState<Record<string, { emoji: string; count: number; reacted: boolean }[]>>({})

  const rows: ListEntry[][] = []
  for (let i = 0; i < entries.length; i += TIER_GRID_COLS) {
    rows.push(entries.slice(i, i + TIER_GRID_COLS))
  }

  async function handleExpandClick(entry: ListEntry) {
    if (expandedEntryId === entry.id) {
      setExpandedEntryId(null)
      return
    }
    setExpandedEntryId(entry.id)
    if (!expandedReactions[entry.id]) {
      const { data } = await supabase
        .from('entry_reactions')
        .select('emoji, visitor_id')
        .eq('list_entry_id', entry.id)
      if (data) {
        const counts: Record<string, { count: number; reacted: boolean }> = {}
        for (const e of TIER_REACTION_EMOJIS) counts[e] = { count: 0, reacted: false }
        for (const r of data) {
          if (counts[r.emoji]) {
            counts[r.emoji].count++
            if (r.visitor_id === visitorId) counts[r.emoji].reacted = true
          }
        }
        setExpandedReactions(prev => ({
          ...prev,
          [entry.id]: TIER_REACTION_EMOJIS.map(e => ({ emoji: e, ...counts[e] })),
        }))
      }
    }
  }

  async function toggleReaction(entry: ListEntry, emoji: string) {
    if (!visitorId) return
    const current = expandedReactions[entry.id]
    if (!current) return
    const rx = current.find(r => r.emoji === emoji)!
    const hasReacted = rx.reacted
    setExpandedReactions(prev => ({
      ...prev,
      [entry.id]: current.map(r =>
        r.emoji === emoji ? { ...r, count: r.count + (hasReacted ? -1 : 1), reacted: !hasReacted } : r
      ),
    }))
    if (hasReacted) {
      await supabase.from('entry_reactions').delete()
        .eq('list_entry_id', entry.id).eq('visitor_id', visitorId).eq('emoji', emoji)
    } else {
      await supabase.from('entry_reactions').insert({ list_entry_id: entry.id, visitor_id: visitorId, emoji })
    }
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {rows.map((row, rowIdx) => {
        const expandedEntry = expandedEntryId ? (row.find(e => e.id === expandedEntryId) ?? null) : null
        const isOpen = expandedEntry !== null

        return (
          <div key={rowIdx} style={{ marginBottom: 14 }}>
            {/* 4-column poster grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, alignItems: 'start' }}>
              {row.map((entry, colIdx) => {
                const rank = entry.rank ?? (rowIdx * TIER_GRID_COLS + colIdx + 1)
                const isTop3 = rank <= 3
                const src = entry.image_url ?? posters[entry.id]?.poster
                const plainNotes = notesToPlainText(entry.notes)
                const hasNotes = plainNotes.trim().length > 0
                const teaser = plainNotes.slice(0, 55) + (plainNotes.length > 55 ? '…' : '')
                const isExpanded = expandedEntryId === entry.id

                return (
                  <div key={entry.id}>
                    {/* Poster — padding-bottom trick keeps 2/3 ratio regardless of grid stretching */}
                    <div
                      style={{ position: 'relative', paddingBottom: '150%', borderRadius: 5, overflow: 'hidden', background: '#111118', cursor: 'pointer' }}
                      onClick={() => onEntryClick?.(entry)}
                    >
                      {src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>

                    {/* Below poster */}
                    <div style={{ marginTop: 4, minWidth: 0 }}>
                      {/* Rank + title on same line */}
                      <div
                        style={{
                          display: 'flex', alignItems: 'baseline', gap: 4,
                          overflow: 'hidden',
                          lineHeight: 1.3,
                          marginBottom: hasNotes ? 2 : 0,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: isTop3 ? 700 : 600, color: isTop3 ? '#f59e0b' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{rank}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{entry.title}</span>
                      </div>
                      {hasNotes && (
                        <>
                          {!isExpanded && (
                            <div
                              style={{
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.45)',
                                fontStyle: 'italic',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                lineHeight: 1.4,
                                marginBottom: 2,
                              }}
                            >
                              {teaser}
                            </div>
                          )}
                          <button
                            onClick={(ev) => { ev.stopPropagation(); handleExpandClick(entry) }}
                            style={{
                              fontSize: 11, color: '#f59e0b',
                              background: 'none', border: 'none',
                              cursor: 'pointer', padding: 0,
                            }}
                          >
                            {isExpanded ? '… less' : '… more'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Expanding description card */}
            <div
              style={{
                overflow: 'hidden',
                maxHeight: isOpen ? 900 : 0,
                transition: 'max-height 250ms ease',
                marginTop: isOpen ? 8 : 0,
              }}
            >
              {expandedEntry && (() => {
                const doc = parseNotes(expandedEntry.notes ?? '')
                const html = doc ? tiptapToHtml(doc) : (expandedEntry.notes ?? '')
                const reactions = expandedReactions[expandedEntry.id]
                  ?? TIER_REACTION_EMOJIS.map(e => ({ emoji: e, count: entryReactions[expandedEntry.id]?.[e] ?? 0, reacted: false }))
                const commentCount = commentCounts[expandedEntry.id] ?? 0

                return (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 10, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      {expandedEntry.title}
                      {(() => {
                        const pct = rarePicks?.get(entryRarityKey(expandedEntry))
                        return pct !== undefined && category ? <RarePickBadge pct={pct} category={category} /> : null
                      })()}
                    </div>

                    <div
                      className="entry-notes"
                      style={{ fontSize: 13, marginBottom: 14 }}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />

                    {/* Reactions */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
                      {reactions.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(expandedEntry, r.emoji)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
                            color: r.reacted ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                            background: 'none', border: 'none',
                            cursor: visitorId ? 'pointer' : 'default', padding: 0,
                          }}
                        >
                          <span>{r.emoji}</span>
                          {r.count > 0 && (
                            <span style={{ fontSize: 12, color: r.reacted ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>
                              {r.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Comment count → opens drawer */}
                    <button
                      onClick={() => onEntryClick?.(expandedEntry)}
                      style={{
                        fontSize: 12, color: 'rgba(255,255,255,0.35)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}
                    >
                      💬 {commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Leave a comment'}
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })}
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
  visitorId = '',
  rarePicks,
  category,
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
  visitorId?: string
  rarePicks?: Map<string, number>
  category?: 'movies' | 'tv'
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
    const tierByLabelTR = new Map(tierData.map(t => [t.label, t.id]))
    const entriesByTier = new Map<string, ListEntry[]>()
    for (const entry of [...entries].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))) {
      const key = entry.tier_id ?? tierByLabelTR.get(entry.tier ?? '') ?? entry.tier ?? 'none'
      if (!entriesByTier.has(key)) entriesByTier.set(key, [])
      entriesByTier.get(key)!.push(entry)
    }

    const virtualLabelsTR = [...new Set(
      entries.filter(e => e.tier && !e.tier_id && !tierByLabelTR.has(e.tier)).map(e => e.tier!)
    )]
    const allDisplayTiersTR = [
      ...tierData.map((t, i) => ({ id: t.id, label: t.label, color: t.color ?? TIER_RANKED_COLORS[i] ?? '#e8c547' })),
      ...virtualLabelsTR.map((lbl, vi) => ({ id: lbl, label: lbl, color: TIER_RANKED_COLORS[tierData.length + vi] ?? '#e8c547' })),
    ]

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
                  saveEntryField={saveEntryField}
                />
              ))}
            </div>
          </div>
        )}
        {allDisplayTiersTR.map((tier, tierIndex) => {
          const tierEntries = entriesByTier.get(tier.id) ?? []
          if (tierEntries.length === 0 && !editMode) return null
          const color = tier.color

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

              {editMode ? (
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
                        saveEntryField={saveEntryField}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              ) : (
                <TierRankedPosterGrid
                  entries={tierEntries}
                  posters={posters}
                  entryReactions={entryReactions ?? {}}
                  commentCounts={commentCounts ?? {}}
                  visitorId={visitorId}
                  onEntryClick={(e) => onEntryClick?.(e)}
                  rarePicks={rarePicks}
                  category={category}
                />
              )}
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
                      saveEntryField={saveEntryField}
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
