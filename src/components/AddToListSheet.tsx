'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type UserList = {
  id: string
  title: string
  list_format: 'ranked' | 'tiered' | 'tier-ranked'
  category: string
  entry_count: number
  tiers: { id: string; label: string; color: string | null; position: number }[]
}

type Props = {
  entry: { title: string; image_url: string | null }
  onClose: () => void
  onSuccess: (listTitle: string) => void
}

export function AddToListSheet({ entry, onClose, onSuccess }: Props) {
  const [lists, setLists] = useState<UserList[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'list' | 'tier'>('list')
  const [selectedList, setSelectedList] = useState<UserList | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadLists()
  }, [])

  // Close on backdrop click
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
      onSuccess(list.title)
    }
    setSaving(false)
  }

  function handleListSelect(list: UserList) {
    if (list.list_format === 'tiered' || list.list_format === 'tier-ranked') {
      if (list.tiers.length > 0) {
        setSelectedList(list)
        setStep('tier')
        return
      }
    }
    addToList(list)
  }

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
            {step === 'list' ? (
              <>
                <p className="text-xs font-semibold tracking-wide uppercase mb-0.5" style={{ color: 'var(--accent)' }}>Add to list</p>
                <p className="text-sm font-semibold truncate" style={{ maxWidth: 260 }}>{entry.title}</p>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep('list')}
                  className="text-xs mb-1 transition-opacity hover:opacity-60"
                  style={{ color: 'var(--muted)' }}
                >
                  ← Back
                </button>
                <p className="text-sm font-semibold">Choose a tier</p>
              </>
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
          ) : selectedList ? (
            selectedList.tiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => addToList(selectedList, tier.id)}
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
