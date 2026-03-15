'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchPosters } from '@/lib/tmdb'
import type { List, ListEntry, Comment, ReactionCount, HonorableMention, AlsoWatched } from '@/types'

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
  const [posters, setPosters] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [visitorId, setVisitorId] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const router = useRouter()

  useEffect(() => {
    const name = localStorage.getItem('visitor_name')
    const vid = localStorage.getItem('visitor_id')
    if (!name || !vid) {
      router.replace('/')
      return
    }
    setVisitorName(name)
    setVisitorId(vid)
    fetchAll(vid)
  }, [id, router])

  async function fetchAll(vid: string) {
    const [listRes, entriesRes, commentsRes, reactionsRes, hmRes, awRes] = await Promise.all([
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
    ])

    if (listRes.data) setList(listRes.data)
    if (entriesRes.data) {
      setEntries(entriesRes.data)
      // Fetch TMDB posters in parallel with the rest
      const category = listRes.data?.category ?? 'movies'
      fetchPosters(entriesRes.data, category).then(setPosters)
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

    setLoading(false)
  }

  async function toggleReaction(emoji: string) {
    if (!visitorId) return

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
        .eq('visitor_id', visitorId)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('reactions')
        .insert({ list_id: id, visitor_id: visitorId, emoji })
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !visitorId) return

    setSubmittingComment(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ list_id: id, visitor_id: visitorId, content: newComment.trim() })
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
            className="flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            ← All Lists
          </Link>
          <span
            className="text-xs tracking-[0.3em] uppercase font-semibold px-2 py-1 rounded"
            style={{
              background: isMovie ? 'rgba(232,197,71,0.12)' : 'rgba(139,92,246,0.12)',
              color: accentColor,
            }}
          >
            {isMovie ? 'Movies' : 'TV Shows'}
          </span>
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
            {list.year} · {isMovie ? 'Movies' : 'TV Shows'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            {list.title}
          </h1>
          {list.description && (
            <p className="text-base max-w-xl" style={{ color: 'var(--muted)' }}>
              {list.description}
            </p>
          )}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-20 space-y-12">
        {/* Entries */}
        <section>
          <ol className="space-y-3">
            {entries.map((entry, i) => (
              <li key={entry.id}>
                <div
                  className="rounded-xl p-4 sm:p-5 flex gap-4 items-start"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${i === 0 ? accentColor : 'var(--border)'}`,
                  }}
                >
                  {/* Rank */}
                  <div
                    className="text-2xl font-bold w-9 shrink-0 tabular-nums leading-none mt-0.5"
                    style={{
                      color: i === 0 ? accentColor : i < 3 ? 'var(--foreground)' : 'var(--muted)',
                    }}
                  >
                    {entry.rank}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-snug">
                        {entry.title}
                      </h3>
                      {entry.notes && (
                        <p
                          className="text-sm mt-1 leading-relaxed"
                          style={{ color: 'var(--muted)' }}
                        >
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    {/* Thumbnail — right aligned */}
                    {(() => {
                      const src = entry.image_url ?? posters[entry.id]
                      if (src) return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={entry.title}
                          className="w-12 h-[4.5rem] object-cover rounded shrink-0"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                        />
                      )
                      // Poster not yet loaded or not found
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
                  </div>
                </div>
              </li>
            ))}
          </ol>
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
                onClick={() => toggleReaction(r.emoji)}
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
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                Posting as{' '}
                <span style={{ color: 'var(--foreground)' }}>{visitorName}</span>
              </span>
            </div>
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
                disabled={submittingComment || !newComment.trim()}
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
