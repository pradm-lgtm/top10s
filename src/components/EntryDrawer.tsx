'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { ListEntry } from '@/types'

const EMOJIS = ['🔥', '❤️', '😮', '😂', '👏']

type EntryComment = {
  id: string
  content: string
  created_at: string
  visitor_id: string
  visitors?: { name: string }
}

type ReactionCount = {
  emoji: string
  count: number
  reacted: boolean
}

type Props = {
  entry: ListEntry | null
  visitorId: string
  visitorName: string
  accentColor: string
  onClose: () => void
  onCommentPosted: (entryId: string) => void
}

export function EntryDrawer({ entry, visitorId, visitorName, accentColor, onClose, onCommentPosted }: Props) {
  const [comments, setComments] = useState<EntryComment[]>([])
  const [reactions, setReactions] = useState<ReactionCount[]>(
    EMOJIS.map(e => ({ emoji: e, count: 0, reacted: false }))
  )
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!entry) return
    setLoading(true)
    setComments([])
    setNewComment('')
    setReactions(EMOJIS.map(e => ({ emoji: e, count: 0, reacted: false })))
    loadData(entry.id)
  }, [entry?.id])

  async function loadData(entryId: string) {
    const [commentsRes, reactionsRes] = await Promise.all([
      supabase
        .from('entry_comments')
        .select('*, visitors(name)')
        .eq('list_entry_id', entryId)
        .order('created_at', { ascending: false }),
      supabase
        .from('entry_reactions')
        .select('emoji, visitor_id')
        .eq('list_entry_id', entryId),
    ])

    if (commentsRes.data) setComments(commentsRes.data as EntryComment[])
    if (reactionsRes.data) {
      const counts: Record<string, { count: number; reacted: boolean }> = {}
      for (const e of EMOJIS) counts[e] = { count: 0, reacted: false }
      for (const r of reactionsRes.data) {
        if (counts[r.emoji]) {
          counts[r.emoji].count++
          if (r.visitor_id === visitorId) counts[r.emoji].reacted = true
        }
      }
      setReactions(EMOJIS.map(e => ({ emoji: e, ...counts[e] })))
    }
    setLoading(false)
  }

  async function toggleReaction(emoji: string) {
    if (!entry || !visitorId) return
    const hasReacted = reactions.find(r => r.emoji === emoji)?.reacted ?? false
    setReactions(prev =>
      prev.map(r =>
        r.emoji === emoji
          ? { ...r, count: r.count + (hasReacted ? -1 : 1), reacted: !hasReacted }
          : r
      )
    )
    if (hasReacted) {
      await supabase
        .from('entry_reactions')
        .delete()
        .eq('list_entry_id', entry.id)
        .eq('visitor_id', visitorId)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('entry_reactions')
        .insert({ list_entry_id: entry.id, visitor_id: visitorId, emoji })
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !entry || !visitorId) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('entry_comments')
      .insert({ list_entry_id: entry.id, visitor_id: visitorId, content: newComment.trim() })
      .select('*, visitors(name)')
      .single()
    if (!error && data) {
      setComments(prev => [data as EntryComment, ...prev])
      onCommentPosted(entry.id)
      setNewComment('')
    }
    setSubmitting(false)
  }

  const open = entry !== null

  return (
    <>
      {/* Mobile backdrop only */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Drawer: bottom sheet on mobile, right panel on desktop */}
      <div
        className={`fixed z-50 flex flex-col transition-transform duration-300
          bottom-0 left-0 right-0 h-[85vh] rounded-t-2xl
          lg:top-0 lg:right-0 lg:left-auto lg:bottom-auto lg:h-full lg:w-[360px] lg:rounded-none
          ${open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full lg:translate-y-0'}`}
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)' }}
      >
        {entry && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="pr-6 min-w-0">
                <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-1" style={{ color: accentColor }}>
                  #{entry.rank}
                </p>
                <h3 className="font-bold text-base leading-snug">{entry.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-sm transition-colors hover:opacity-70"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
              {/* Reactions */}
              <div>
                <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                  Reactions
                </p>
                <div className="flex flex-wrap gap-2">
                  {reactions.map(r => (
                    <button
                      key={r.emoji}
                      onClick={() => toggleReaction(r.emoji)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: r.reacted ? `${accentColor}18` : 'var(--surface-2)',
                        border: `1px solid ${r.reacted ? accentColor : 'var(--border)'}`,
                        color: r.reacted ? accentColor : 'var(--foreground)',
                      }}
                    >
                      <span>{r.emoji}</span>
                      {r.count > 0 && <span className="tabular-nums text-xs">{r.count}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                  Comments{comments.length > 0 ? ` (${comments.length})` : ''}
                </p>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div
                      className="w-5 h-5 rounded-full border-2 animate-spin"
                      style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
                    />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--muted)' }}>
                    No comments yet. Be the first!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map(comment => (
                      <div
                        key={comment.id}
                        className="rounded-lg p-3"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-sm">{comment.visitors?.name ?? 'Anonymous'}</span>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment input — pinned at bottom */}
            <form
              onSubmit={submitComment}
              className="p-4 border-t shrink-0 space-y-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Posting as <span style={{ color: 'var(--foreground)' }}>{visitorName}</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment…"
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: accentColor, color: '#0a0a0f' }}
                >
                  {submitting ? '…' : 'Post'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  )
}
