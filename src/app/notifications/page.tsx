'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'
import { AppHeader } from '@/components/AppHeader'

type EnrichedNotification = {
  id: string
  type: 'new_follower' | 'new_comment' | 'new_reaction' | 'new_list_from_following' | 'mention'
  actor_name: string
  actor_username: string | null
  list_id: string | null
  list_title: string | null
  read: boolean
  created_at: string
}

function notifText(n: EnrichedNotification): string {
  switch (n.type) {
    case 'new_follower': return `${n.actor_name} started following you`
    case 'new_comment': return `${n.actor_name} commented on ${n.list_title ?? 'your list'}`
    case 'new_reaction': return `${n.actor_name} reacted to ${n.list_title ?? 'your list'}`
    case 'new_list_from_following': return `${n.actor_name} published ${n.list_title ?? 'a new list'}`
    case 'mention': return `${n.actor_name} mentioned you in a comment on ${n.list_title ?? 'a list'}`
  }
}

function notifHref(n: EnrichedNotification): string {
  if (n.type === 'new_follower' && n.actor_username) return `/${n.actor_username}`
  if (n.list_id) return `/list/${n.list_id}`
  return '/home'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    if (user === null) {
      router.replace('/home')
    }
  }, [user, router])

  useEffect(() => {
    if (!user) return
    loadPage(0)
  }, [user])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  async function loadPage(pageNum: number) {
    const token = await getToken()
    if (!token) return
    if (pageNum === 0) setLoading(true)
    else setLoadingMore(true)

    const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data: EnrichedNotification[] = await res.json()
      if (pageNum === 0) {
        setNotifications(data)
      } else {
        setNotifications((prev) => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
      setPage(pageNum)
    }
    setLoading(false)
    setLoadingMore(false)
  }

  async function markAllRead() {
    const token = await getToken()
    if (!token) return
    setMarkingAll(true)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setMarkingAll(false)
  }

  async function markRead(id: string) {
    const token = await getToken()
    if (!token) return
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  if (!user) return null

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="text-sm font-medium transition-opacity hover:opacity-60 disabled:opacity-40"
              style={{ color: 'var(--accent)' }}
            >
              {markingAll ? 'Marking…' : 'Mark all as read'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No notifications yet — start engaging with lists to get the conversation going
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={notifHref(n)}
                onClick={() => markRead(n.id)}
                className="block px-5 py-4 transition-opacity hover:opacity-80"
                style={{
                  background: n.read ? 'var(--surface)' : 'rgba(232,197,71,0.04)',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid var(--accent)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <p className="text-sm leading-snug">{notifText(n)}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{timeAgo(n.created_at)}</p>
              </Link>
            ))}

            {hasMore && (
              <div className="p-4 text-center" style={{ background: 'var(--surface)' }}>
                <button
                  onClick={() => loadPage(page + 1)}
                  disabled={loadingMore}
                  className="text-sm font-medium transition-opacity hover:opacity-60 disabled:opacity-40"
                  style={{ color: 'var(--accent)' }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
