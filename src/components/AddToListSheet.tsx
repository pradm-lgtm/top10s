'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type UserList = {
  id: string
  title: string
  list_format: 'ranked' | 'tiered' | 'tier-ranked'
  category: string
  entry_count: number
  tiers: { id: string; label: string; color: string | null; position: number }[]
}

type EntryItem = { id: string; title: string; rank: number | null; image_url: string | null }

type Props = {
  entry: { title: string; image_url: string | null }
  onClose: () => void
  onSuccess: (listTitle: string) => void
}

function SortableEntryRow({ item, isNew }: { item: EntryItem; isNew: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isNew ? 'rgba(232,197,71,0.08)' : 'transparent',
        borderLeft: isNew ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      className="flex items-center gap-3 px-4 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing shrink-0"
        style={{ color: 'var(--muted)', lineHeight: 1 }}
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="" className="w-7 h-10 object-cover rounded shrink-0" />
      )}
      <span className="text-sm truncate flex-1">{item.title}</span>
      {isNew && (
        <span className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'rgba(232,197,71,0.15)', color: 'var(--accent)' }}>
          NEW
        </span>
      )}
    </div>
  )
}

export function AddToListSheet({ entry, onClose, onSuccess }: Props) {
  const [lists, setLists] = useState<UserList[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'list' | 'tier' | 'reorder'>('list')
  const [selectedList, setSelectedList] = useState<UserList | null>(null)
  const [saving, setSaving] = useState(false)

  // Reorder state
  const [reorderEntries, setReorderEntries] = useState<EntryItem[]>([])
  const [newEntryId, setNewEntryId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    loadLists()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadLists() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setLoading(false); return }

    const { data: rawLists } = await supabase
      .from('lists')
      .select('id, title, list_format, category')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })

    if (!rawLists) { setLoading(false); return }

    const listIds = rawLists.map((l) => l.id)

    const [{ data: entryCounts }, { data: tiers }] = await Promise.all([
      supabase.from('list_entries').select('list_id').in('list_id', listIds),
      supabase.from('tiers').select('id, list_id, label, color, position').in('list_id', listIds).order('position'),
    ])

    const countMap: Record<string, number> = {}
    for (const e of entryCounts ?? []) countMap[e.list_id] = (countMap[e.list_id] ?? 0) + 1

    const tiersMap: Record<string, UserList['tiers']> = {}
    for (const t of tiers ?? []) {
      if (!tiersMap[t.list_id]) tiersMap[t.list_id] = []
      tiersMap[t.list_id].push(t)
    }

    setLists(rawLists.map((l) => ({
      ...l,
      entry_count: countMap[l.id] ?? 0,
      tiers: tiersMap[l.id] ?? [],
    })))
    setLoading(false)
  }

  async function addToList(list: UserList, tierId?: string) {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setSaving(false); return }

    const res = await fetch('/api/list-entries/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        list_id: list.id,
        title: entry.title,
        image_url: entry.image_url,
        ...(tierId ? { tier_id: tierId } : {}),
      }),
    })

    if (res.ok) {
      const newEntry = await res.json()
      posthog.capture('entry_added_from_other_list')

      // For ranked or tier-ranked (after tier selection), show reorder view
      if (list.list_format === 'ranked' || list.list_format === 'tier-ranked') {
        setNewEntryId(newEntry.id)
        await loadEntriesForReorder(list, newEntry.id, tierId)
        setSaving(false)
        return
      }

      onSuccess(list.title)
    }
    setSaving(false)
  }

  async function loadEntriesForReorder(list: UserList, newId: string, tierId?: string) {
    let query = supabase
      .from('list_entries')
      .select('id, title, rank, image_url')
      .eq('list_id', list.id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })

    if (tierId) {
      query = query.eq('tier_id', tierId)
    }

    const { data } = await query
    setReorderEntries((data ?? []) as EntryItem[])
    setStep('reorder')
  }

  async function saveOrder() {
    if (!selectedList) return
    setSavingOrder(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setSavingOrder(false); return }

    await fetch('/api/list-entries/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        list_id: selectedList.id,
        ordered_entry_ids: reorderEntries.map((e) => e.id),
      }),
    })

    setSavingOrder(false)
    onSuccess(selectedList.title)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setReorderEntries((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  function handleListSelect(list: UserList) {
    setSelectedList(list)
    if (list.list_format === 'tiered' || list.list_format === 'tier-ranked') {
      if (list.tiers.length > 0) {
        setStep('tier')
        return
      }
    }
    addToList(list)
  }

  function handleTierSelect(tier: UserList['tiers'][0]) {
    if (!selectedList) return
    if (selectedList.list_format === 'tier-ranked') {
      // Add entry then show reorder within that tier
      addToList(selectedList, tier.id)
    } else {
      // Pure tiered: just add and close
      addToList(selectedList, tier.id)
    }
  }

  const stepTitle = step === 'list' ? 'Add to list'
    : step === 'tier' ? 'Choose a tier'
    : 'Drag to reorder'

  const stepSubtitle = step === 'list' ? entry.title
    : step === 'tier' ? null
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            {step !== 'list' && (
              <button
                onClick={() => setStep(step === 'reorder' && selectedList?.list_format === 'tier-ranked' ? 'tier' : 'list')}
                className="text-xs mb-1 transition-opacity hover:opacity-60"
                style={{ color: 'var(--muted)' }}
              >
                ← Back
              </button>
            )}
            <p className="text-xs font-semibold tracking-wide uppercase mb-0.5" style={{ color: 'var(--accent)' }}>
              {stepTitle}
            </p>
            {stepSubtitle && (
              <p className="text-sm font-semibold truncate" style={{ maxWidth: 260 }}>{stepSubtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-lg transition-opacity hover:opacity-60"
            style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : step === 'list' ? (
            <>
              {lists.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  You don&apos;t have any lists yet
                </div>
              ) : (
                lists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleListSelect(list)}
                    disabled={saving}
                    className="w-full text-left px-5 py-4 flex items-center gap-3 transition-opacity hover:opacity-70 disabled:opacity-40"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{list.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {list.entry_count} {list.entry_count === 1 ? 'entry' : 'entries'} · {list.list_format}
                      </p>
                    </div>
                    <span style={{ color: 'var(--muted)' }}>›</span>
                  </button>
                ))
              )}
              <Link
                href="/create"
                onClick={onClose}
                className="block px-5 py-4 text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}
              >
                + Create a new list
              </Link>
            </>
          ) : step === 'tier' && selectedList ? (
            selectedList.tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => handleTierSelect(tier)}
                disabled={saving}
                className="w-full text-left px-5 py-4 flex items-center gap-3 transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {tier.color && (
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: tier.color }} />
                )}
                <span className="text-sm font-medium">{tier.label}</span>
                {saving && <div className="ml-auto w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />}
              </button>
            ))
          ) : step === 'reorder' ? (
            <div>
              <p className="px-5 py-3 text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                Drag to set the order, then tap Done.
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={reorderEntries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                  {reorderEntries.map((item) => (
                    <SortableEntryRow key={item.id} item={item} isNew={item.id === newEntryId} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : null}
        </div>

        {/* Footer: Done button for reorder step */}
        {step === 'reorder' && (
          <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={saveOrder}
              disabled={savingOrder}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              {savingOrder ? 'Saving…' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
