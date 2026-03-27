'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'

type EnrichedNotification = {
  id: string
  type: 'new_follower' | 'new_comment' | 'new_reaction' | 'new_list_from_following'
  actor_name: string
  actor_username: string | null
  list_id: string | null
  list_title: string | null
  read: boolean
  created_at: string
}

function notifText(n: EnrichedNotification): string {
  switch (n.type) {
    case 'new_follower':
      return `${n.actor_name} started following you`
    case 'new_comment':
      return `${n.actor_name} commented on ${n.list_title ?? 'your list'}`
    case 'new_reaction':
      return `${n.actor_name} reacted to ${n.list_title ?? 'your list'}`
    case 'new_list_from_following':
      return `${n.actor_name} published ${n.list_title ?? 'a new list'}`
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

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<EnrichedNotification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/notifications', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) setNotifications(await res.json())
  }

  async function markAllRead() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  if (!user) return null

  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
        aria-label="Notifications"
        style={{ background: open ? 'var(--surface)' : 'transparent' }}
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--foreground)' }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full border"
            style={{ background: '#ef4444', borderColor: 'var(--background)' }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            width: 300,
            maxHeight: 440,
            overflowY: 'auto',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 sticky top-0"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs transition-opacity hover:opacity-60"
                style={{ color: 'var(--muted)' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={notifHref(n)}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 transition-opacity hover:opacity-80"
                style={{
                  background: n.read ? 'transparent' : 'rgba(232,197,71,0.05)',
                  borderLeft: n.read ? '2px solid transparent' : '2px solid var(--accent)',
                }}
              >
                <p className="text-sm leading-snug">{notifText(n)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{timeAgo(n.created_at)}</p>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
