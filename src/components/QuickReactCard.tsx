'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'

const EMOJIS = ['🔥', '❤️', '😮', '😂', '👏']

type EmojiReaction = { emoji: string; count: number; reacted: boolean }
type CommentPreview = { id: string; content: string; visitors: { name: string } | null }

// ── Hook: get or create visitor id ─────────────────────────────────────────

function useVisitorId() {
  const { user, profile } = useAuth()
  const [visitorId, setVisitorId] = useState<string>('')

  useEffect(() => {
    const cached = localStorage.getItem('visitor_id')
    if (cached) { setVisitorId(cached); return }

    const byUser = user ? localStorage.getItem(`visitor_id_for_${user.id}`) : null
    if (byUser) {
      localStorage.setItem('visitor_id', byUser)
      setVisitorId(byUser)
      return
    }

    // Auto-register for logged-in users with a profile
    if (user && profile) {
      const displayName = profile.display_name ?? profile.username
      supabase.from('visitors').insert({ name: displayName }).select('id').single().then(({ data }) => {
        if (data?.id) {
          localStorage.setItem('visitor_id', data.id)
          localStorage.setItem(`visitor_id_for_${user.id}`, data.id)
          localStorage.setItem('visitor_name', displayName)
          setVisitorId(data.id)
        }
      })
    }
  }, [user, profile])

  return visitorId
}

// ── Card content ─────────────────────────────────────────────────────────────

function CardContent({
  listId,
  onCommentCountChange,
  onClose,
}: {
  listId: string
  onCommentCountChange?: (delta: number) => void
  onClose: () => void
}) {
  const { user, signInWithGoogle } = useAuth()
  const visitorId = useVisitorId()
  const [reactions, setReactions] = useState<EmojiReaction[]>(
    EMOJIS.map((e) => ({ emoji: e, count: 0, reacted: false }))
  )
  const [comments, setComments] = useState<CommentPreview[]>([])
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const vid = localStorage.getItem('visitor_id') ?? ''
      const [reactRes, commentRes] = await Promise.all([
        supabase.from('reactions').select('emoji, visitor_id').eq('list_id', listId),
        supabase
          .from('comments')
          .select('id, content, visitors(name)')
          .eq('list_id', listId)
          .order('created_at', { ascending: false })
          .limit(2),
      ])
      if (reactRes.data) {
        const counts: Record<string, number> = {}
        const mine = new Set<string>()
        for (const r of reactRes.data) {
          counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
          if (r.visitor_id === vid) mine.add(r.emoji)
        }
        setReactions(EMOJIS.map((e) => ({ emoji: e, count: counts[e] ?? 0, reacted: mine.has(e) })))
      }
      if (commentRes.data) {
        // Supabase join returns visitors as object or array depending on config
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setComments(commentRes.data.map((c: any) => ({
          id: c.id,
          content: c.content,
          visitors: Array.isArray(c.visitors) ? c.visitors[0] ?? null : c.visitors,
        })))
      }
      setDataLoaded(true)
    }
    fetchData()
  }, [listId])

  async function toggleReaction(emoji: string) {
    if (!user) { signInWithGoogle(); onClose(); return }
    if (!visitorId) return
    const existing = reactions.find((r) => r.emoji === emoji)
    const hasReacted = existing?.reacted ?? false
    setReactions((prev) =>
      prev.map((r) => r.emoji === emoji ? { ...r, count: r.count + (hasReacted ? -1 : 1), reacted: !r.reacted } : r)
    )
    await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: listId, visitor_id: visitorId, emoji, action: hasReacted ? 'remove' : 'add' }),
    })
  }

  async function postComment() {
    if (!user) { signInWithGoogle(); onClose(); return }
    if (!commentText.trim() || !visitorId) return
    setSubmitting(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: listId, visitor_id: visitorId, content: commentText.trim() }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments((prev) => [
        { id: comment.id, content: comment.content, visitors: comment.visitors ?? null },
        ...prev,
      ].slice(0, 2))
      setCommentText('')
      onCommentCountChange?.(1)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-3">
      {/* Emoji reactions */}
      <div className="flex gap-1.5 flex-wrap">
        {reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={(e) => { e.stopPropagation(); toggleReaction(r.emoji) }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: r.reacted ? 'rgba(232,197,71,0.15)' : 'var(--surface-2)',
              border: `1px solid ${r.reacted ? 'rgba(232,197,71,0.5)' : 'var(--border)'}`,
              color: r.reacted ? 'var(--accent)' : 'var(--foreground)',
            }}
          >
            <span>{r.emoji}</span>
            {r.count > 0 && <span className="tabular-nums">{r.count}</span>}
          </button>
        ))}
      </div>

      {/* Comment previews */}
      {(dataLoaded && comments.length > 0) && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 min-w-0">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                {(c.visitors?.name ?? '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-medium mr-1" style={{ color: 'var(--foreground)' }}>
                  {c.visitors?.name ?? 'Someone'}
                </span>
                <span className="text-[11px] line-clamp-1" style={{ color: 'var(--muted)' }}>
                  {c.content}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
          placeholder={user ? 'Add your take…' : 'Sign in to comment…'}
          disabled={!user || submitting}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none min-w-0"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.5)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={(e) => { e.stopPropagation(); postComment() }}
          disabled={!user || submitting || !commentText.trim()}
          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          Post
        </button>
      </div>

      {/* See all link */}
      <Link
        href={`/list/${listId}`}
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="block text-[11px] text-right transition-opacity hover:opacity-70"
        style={{ color: 'var(--muted)' }}
      >
        See all comments →
      </Link>
    </div>
  )
}

// ── Mobile bottom sheet ───────────────────────────────────────────────────────

function BottomSheet({
  listId,
  listTitle,
  onCommentCountChange,
  onClose,
}: {
  listId: string
  listTitle: string
  onCommentCountChange?: (delta: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={(e) => { e.stopPropagation(); onClose() }}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl p-5 pb-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 -8px 40px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>
        <p className="text-sm font-semibold mb-4 truncate" style={{ color: 'var(--foreground)' }}>
          {listTitle}
        </p>
        <CardContent listId={listId} onCommentCountChange={onCommentCountChange} onClose={onClose} />
      </div>
    </>,
    document.body
  )
}

// ── Desktop floating popover ──────────────────────────────────────────────────

function FloatingPopover({
  listId,
  anchorRect,
  onCommentCountChange,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  listId: string
  anchorRect: DOMRect
  onCommentCountChange?: (delta: number) => void
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const CARD_WIDTH = 300
  const CARD_HEIGHT_ESTIMATE = 260
  const GAP = 8

  const viewportH = window.innerHeight
  const spaceAbove = anchorRect.top
  const showAbove = spaceAbove > CARD_HEIGHT_ESTIMATE + GAP

  const top = showAbove
    ? anchorRect.top - CARD_HEIGHT_ESTIMATE - GAP
    : anchorRect.bottom + GAP

  // Center horizontally on the anchor, clamped to viewport
  let left = anchorRect.left + anchorRect.width / 2 - CARD_WIDTH / 2
  left = Math.max(8, Math.min(left, window.innerWidth - CARD_WIDTH - 8))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed z-50 rounded-xl p-4"
      style={{
        top,
        left,
        width: CARD_WIDTH,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <CardContent listId={listId} onCommentCountChange={onCommentCountChange} onClose={onClose} />
    </div>,
    document.body
  )
}

// ── Public component ──────────────────────────────────────────────────────────

export type QuickReactCardProps = {
  listId: string
  listTitle: string
  /** Required for desktop popover; undefined triggers bottom sheet */
  anchorRect?: DOMRect
  onCommentCountChange?: (delta: number) => void
  onClose: () => void
  onPopoverMouseEnter?: () => void
  onPopoverMouseLeave?: () => void
}

export function QuickReactCard({
  listId,
  listTitle,
  anchorRect,
  onCommentCountChange,
  onClose,
  onPopoverMouseEnter,
  onPopoverMouseLeave,
}: QuickReactCardProps) {
  if (!anchorRect) {
    return (
      <BottomSheet
        listId={listId}
        listTitle={listTitle}
        onCommentCountChange={onCommentCountChange}
        onClose={onClose}
      />
    )
  }

  return (
    <FloatingPopover
      listId={listId}
      anchorRect={anchorRect}
      onCommentCountChange={onCommentCountChange}
      onClose={onClose}
      onMouseEnter={onPopoverMouseEnter ?? (() => {})}
      onMouseLeave={onPopoverMouseLeave ?? (() => {})}
    />
  )
}

// ── Trigger hook for hover / long-press ──────────────────────────────────────

export function useQuickReactTrigger(enabled: boolean) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [showMobile, setShowMobile] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const open = anchorRect !== null || showMobile
  const isTouchDevice = useCallback(() => window.matchMedia('(hover: none)').matches, [])

  const handleMouseEnterTrigger = useCallback(() => {
    if (!enabled || isTouchDevice()) return
    clearTimeout(closeTimerRef.current)
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect())
    }
  }, [enabled, isTouchDevice])

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setAnchorRect(null)
      setShowMobile(false)
    }, 150)
  }, [])

  const handleMouseLeaveTrigger = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  const handlePopoverMouseEnter = useCallback(() => {
    clearTimeout(closeTimerRef.current)
  }, [])

  const handlePopoverMouseLeave = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  const handleTouchStart = useCallback(() => {
    if (!enabled) return
    longPressTimerRef.current = setTimeout(() => {
      setShowMobile(true)
    }, 400)
  }, [enabled])

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const close = useCallback(() => {
    setAnchorRect(null)
    setShowMobile(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(closeTimerRef.current)
      clearTimeout(longPressTimerRef.current)
    }
  }, [])

  return {
    triggerRef,
    open,
    anchorRect: anchorRect ?? undefined,
    showMobile,
    close,
    triggerProps: {
      onMouseEnter: handleMouseEnterTrigger,
      onMouseLeave: handleMouseLeaveTrigger,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove,
    },
    popoverProps: {
      onPopoverMouseEnter: handlePopoverMouseEnter,
      onPopoverMouseLeave: handlePopoverMouseLeave,
    },
  }
}
