'use client'

import { useState, useEffect } from 'react'
import posthog from 'posthog-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'
import { AppHeader } from '@/components/AppHeader'
import { InviteButton } from '@/components/InviteButton'

type TopicEntry = { id: string; list_id: string; title: string; rank: number | null; image_url: string | null }
type TopicList = {
  id: string
  title: string
  list_format: string
  category: string
  year: number | null
  created_at: string
  owner_id: string | null
  entries: TopicEntry[]
  reactionCount: number
  profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
}
type RelatedTopic = { id: string; slug: string; title: string }
type TopicData = {
  topic: { id: string; slug: string; title: string; category: string }
  lists: TopicList[]
  relatedTopics: RelatedTopic[]
}

type Comment = { id: string; content: string; created_at: string; visitors?: { name: string } | null }

function ExpandedCard({
  list,
  userListId,
  onCompare,
}: {
  list: TopicList
  userListId: string | null
  onCompare: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    supabase
      .from('comments')
      .select('id, content, created_at, visitors(name)')
      .eq('list_id', list.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setComments((data ?? []) as unknown as Comment[])
        setLoadingComments(false)
      })
  }, [list.id])

  async function postComment() {
    if (!commentText.trim()) return
    setSubmitting(true)

    let visitorId: string | null = null
    const stored = localStorage.getItem('visitor_id')
    if (stored) {
      visitorId = stored
    } else {
      const { data } = await supabase
        .from('visitors')
        .insert({ name: user ? (user.email ?? 'Anonymous') : 'Anonymous' })
        .select('id')
        .single()
      if (data) {
        visitorId = data.id
        localStorage.setItem('visitor_id', data.id)
      }
    }

    if (visitorId) {
      const { data: newComment } = await supabase
        .from('comments')
        .insert({ list_id: list.id, visitor_id: visitorId, content: commentText.trim() })
        .select('id, content, created_at')
        .single()
      if (newComment) {
        setComments((prev) => [newComment as Comment, ...prev])
        setCommentText('')
      }
    }
    setSubmitting(false)
  }

  const visibleComments = showAll ? comments : comments.slice(0, 3)
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
      {/* Entries */}
      <div className="px-4 py-4">
        <ol className="space-y-2">
          {list.entries.slice(0, 10).map((entry) => (
            <li key={entry.id} className="flex items-center gap-3">
              {entry.rank != null && (
                <span className="text-xs font-bold w-5 text-right shrink-0" style={{ color: accent }}>
                  {entry.rank}
                </span>
              )}
              {entry.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.image_url} alt="" className="w-7 h-10 object-cover rounded shrink-0" />
              )}
              <span className="text-sm truncate">{entry.title}</span>
            </li>
          ))}
        </ol>

        {userListId && (
          <button
            onClick={onCompare}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="0.5" y="1" width="4.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="7" y="1" width="4.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Compare with your list →
          </button>
        )}
      </div>

      {/* Inline comments */}
      <div className="px-4 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide mt-3 mb-2" style={{ color: 'var(--muted)' }}>
          Comments
        </p>
        {loadingComments ? (
          <div className="py-2 flex justify-center">
            <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {comments.length === 0 && (
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>No comments yet.</p>
            )}
            {visibleComments.map((c) => (
              <div key={c.id} className="text-sm py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-medium text-xs mr-1.5">{c.visitors?.name ?? 'Anonymous'}</span>
                <span style={{ color: 'var(--muted)' }}>{c.content}</span>
              </div>
            ))}
            {comments.length > 3 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs mt-1.5 transition-opacity hover:opacity-70"
                style={{ color: 'var(--muted)' }}
              >
                Show {comments.length - 3} more…
              </button>
            )}
            <div className="flex gap-2 mt-3">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }}
                placeholder="Add your take…"
                className="flex-1 text-sm px-3 py-2 rounded-lg outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              />
              <button
                onClick={postComment}
                disabled={submitting || !commentText.trim()}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#0a0a0f' }}
              >
                Post
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TopicListCard({
  list,
  userListId,
  expanded,
  onToggle,
  onCompare,
}: {
  list: TopicList
  userListId: string | null
  expanded: boolean
  onToggle: () => void
  onCompare: () => void
}) {
  const isMovie = list.category === 'movies'
  const accent = isMovie ? 'var(--accent)' : '#a78bfa'
  const owner = list.profiles

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Card header — always visible */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {owner && (
              <Link
                href={`/${owner.username}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 mb-2 w-fit"
              >
                {owner.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={owner.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                    style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                  >
                    {(owner.display_name ?? owner.username)[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{owner.display_name ?? owner.username}</span>
              </Link>
            )}
            <h3 className="text-sm font-semibold leading-snug">{list.title}</h3>
          </div>

          {/* Top 3 poster stack */}
          <div className="flex gap-1 shrink-0">
            {list.entries.slice(0, 3).map((entry) =>
              entry.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={entry.id}
                  src={entry.image_url}
                  alt={entry.title}
                  className="rounded object-cover"
                  style={{ width: 32, height: 48 }}
                  loading="lazy"
                />
              ) : null
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {list.reactionCount > 0 && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                🔥 {list.reactionCount}
              </span>
            )}
            <span className="text-[11px]" style={{ color: accent }}>
              {list.entries.length} entries
            </span>
          </div>
          <span className="text-xs transition-transform duration-200 inline-block" style={{ color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <ExpandedCard list={list} userListId={userListId} onCompare={onCompare} />
      )}
    </div>
  )
}

export function TopicClient({ data }: { data: TopicData }) {
  const { topic, lists: initialLists, relatedTopics } = data
  const { user, profile } = useAuth()
  const router = useRouter()
  const [sort, setSort] = useState<'recent' | 'reactions'>('recent')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<{ title: string; poster_url: string | null }[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Find the logged-in user's own list for this topic (for compare button)
  const userList = user ? initialLists.find((l) => l.owner_id === user.id) ?? null : null

  // Sort lists based on selection
  const sortedLists = sort === 'reactions'
    ? [...initialLists].sort((a, b) => b.reactionCount - a.reactionCount)
    : initialLists // already sorted by created_at desc from server

  useEffect(() => {
    posthog.capture('topic_page_viewed', { topic_slug: topic.slug })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch suggestions for empty state / general use
  useEffect(() => {
    if (lists.length > 0) return
    setLoadingSuggestions(true)
    fetch(`/api/weekly-prompt?title=${encodeURIComponent(topic.title)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.suggestions) setSuggestions(d.suggestions) })
      .finally(() => setLoadingSuggestions(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleCompare(list: TopicList) {
    if (!userList) return
    router.push(`/compare/${userList.id}/${list.id}`)
  }

  const lists = sortedLists

  return (
    <div className="min-h-screen pb-24 sm:pb-0" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{topic.title}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              {lists.length === 0
                ? 'No lists yet — be the first'
                : `${lists.length} ${lists.length === 1 ? 'person has' : 'people have'} shared their take`}
            </p>
          </div>
          <InviteButton topicTitle={topic.title} senderListId={userList?.id ?? null} />
        </div>

        {/* Related topics */}
        {relatedTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs self-center" style={{ color: 'var(--muted)' }}>Related:</span>
            {relatedTopics.map((t) => (
              <Link
                key={t.id}
                href={`/topic/${t.slug}`}
                className="px-3 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-70"
                style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                {t.title}
              </Link>
            ))}
          </div>
        )}

        {/* Sort pills */}
        {lists.length > 1 && (
          <div className="flex gap-2 mb-6">
            {(['recent', 'reactions'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize"
                style={sort === s
                  ? { background: 'var(--accent)', color: '#0a0a0f' }
                  : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }
                }
              >
                {s === 'recent' ? 'Most Recent' : 'Most Reactions'}
              </button>
            ))}
          </div>
        )}

        {/* Lists */}
        {lists.length > 0 ? (
          <div className="space-y-3">
            {lists.map((list) => (
              <TopicListCard
                key={list.id}
                list={list}
                userListId={userList?.id ?? null}
                expanded={expandedId === list.id}
                onToggle={() => setExpandedId((prev) => prev === list.id ? null : list.id)}
                onCompare={() => handleCompare(list)}
              />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-16">
            {loadingSuggestions ? (
              <div className="flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  No lists for this topic yet.
                </p>
                {suggestions.length > 0 && (
                  <div className="flex gap-2 justify-center mb-6">
                    {suggestions.map((s, i) => s.poster_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={s.poster_url} alt={s.title} title={s.title}
                        className="rounded-lg object-cover opacity-60"
                        style={{ width: 52, height: 78 }}
                      />
                    ) : null)}
                  </div>
                )}
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ title: topic.title })
                    if (topic.category !== 'any') params.set('category', topic.category)
                    router.push(`/create?${params.toString()}`)
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  Be the first to rank this →
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
