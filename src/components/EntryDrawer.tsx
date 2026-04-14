'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { parseNotes, tiptapToHtml } from '@/lib/notes'
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
  onReactionToggled?: (entryId: string, emoji: string, delta: number) => void
  onRegisterVisitor?: (name: string) => Promise<string>
  rarePct?: number
  category?: 'movies' | 'tv'
}

export function EntryDrawer({ entry, visitorId, visitorName, accentColor, onClose, onCommentPosted, onReactionToggled, onRegisterVisitor, rarePct, category }: Props) {
  const [comments, setComments] = useState<EntryComment[]>([])
  const [reactions, setReactions] = useState<ReactionCount[]>(
    EMOJIS.map(e => ({ emoji: e, count: 0, reacted: false }))
  )
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  // Local visitor state — syncs from props, can be updated on registration
  const [localVisitorId, setLocalVisitorId] = useState(visitorId)
  const [localVisitorName, setLocalVisitorName] = useState(visitorName)
  // Inline name prompts
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
  const [reactionNameInput, setReactionNameInput] = useState('')
  const [commentNameInput, setCommentNameInput] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionSuggestions, setMentionSuggestions] = useState<{ id: string; username: string; display_name: string | null }[]>([])
  const commentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLocalVisitorId(visitorId)
    setLocalVisitorName(visitorName)
  }, [visitorId, visitorName])

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

  async function ensureRegistered(name: string): Promise<string> {
    const newId = await onRegisterVisitor?.(name) ?? crypto.randomUUID()
    setLocalVisitorId(newId)
    setLocalVisitorName(name)
    return newId
  }

  async function doToggleReaction(emoji: string, vid: string) {
    if (!entry) return
    const hasReacted = reactions.find(r => r.emoji === emoji)?.reacted ?? false
    setReactions(prev =>
      prev.map(r =>
        r.emoji === emoji
          ? { ...r, count: r.count + (hasReacted ? -1 : 1), reacted: !hasReacted }
          : r
      )
    )
    onReactionToggled?.(entry.id, emoji, hasReacted ? -1 : 1)
    if (hasReacted) {
      await supabase.from('entry_reactions').delete()
        .eq('list_entry_id', entry.id).eq('visitor_id', vid).eq('emoji', emoji)
    } else {
      await supabase.from('entry_reactions').insert({ list_entry_id: entry.id, visitor_id: vid, emoji })
    }
  }

  async function handleReactionClick(emoji: string) {
    if (!localVisitorId) {
      setPendingEmoji(emoji)
      return
    }
    await doToggleReaction(emoji, localVisitorId)
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
    const input = commentInputRef.current
    const cursor = input?.selectionStart ?? newComment.length
    const before = newComment.slice(0, mentionStart)
    const after = newComment.slice(cursor)
    const next = `${before}@${username} ${after}`
    setNewComment(next)
    setMentionSuggestions([])
    setTimeout(() => {
      if (input) {
        const pos = mentionStart + username.length + 2
        input.focus()
        input.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !entry) return
    let vid = localVisitorId
    if (!vid) {
      if (!commentNameInput.trim()) return
      vid = await ensureRegistered(commentNameInput.trim())
      setCommentNameInput('')
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('entry_comments')
      .insert({ list_entry_id: entry.id, visitor_id: vid, content: newComment.trim() })
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
              {/* Full description */}
              {entry.notes && (() => {
                const doc = parseNotes(entry.notes)
                const html = doc ? tiptapToHtml(doc) : entry.notes
                if (!html.trim()) return null
                return (
                  <div
                    className="entry-notes"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                )
              })()}

              {/* Reactions */}
              <div>
                <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                  Reactions
                </p>
                <div className="flex flex-wrap gap-2">
                  {reactions.map(r => (
                    <button
                      key={r.emoji}
                      onClick={() => handleReactionClick(r.emoji)}
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
                {pendingEmoji && !localVisitorId && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!reactionNameInput.trim()) return
                      const newId = await ensureRegistered(reactionNameInput.trim())
                      await doToggleReaction(pendingEmoji, newId)
                      setPendingEmoji(null)
                      setReactionNameInput('')
                    }}
                    className="mt-2 flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={reactionNameInput}
                      onChange={e => setReactionNameInput(e.target.value)}
                      placeholder="Your name to react…"
                      maxLength={50}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--surface-2)', border: `1px solid var(--border)`, color: 'var(--foreground)' }}
                      onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                    />
                    <button type="submit" disabled={!reactionNameInput.trim()} className="px-2 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: accentColor, color: '#0a0a0f' }}>
                      {pendingEmoji}
                    </button>
                    <button type="button" onClick={() => { setPendingEmoji(null); setReactionNameInput('') }} className="text-xs px-2 py-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>✕</button>
                  </form>
                )}
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
                          {renderMentions(comment.content)}
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
              {localVisitorName ? (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Posting as <span style={{ color: 'var(--foreground)' }}>{localVisitorName}</span>
                </span>
              ) : (
                <input
                  value={commentNameInput}
                  onChange={e => setCommentNameInput(e.target.value)}
                  placeholder="Your name…"
                  maxLength={50}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={commentInputRef}
                    type="text"
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
                    placeholder="Add a comment… use @ to mention"
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    onFocus={e => (e.currentTarget.style.borderColor = accentColor)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim() || (!localVisitorName && !commentNameInput.trim())}
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
