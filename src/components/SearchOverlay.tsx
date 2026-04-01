'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type ListResult = { id: string; title: string; category: string; profiles: { username: string; display_name: string | null } | null }
type ProfileResult = { id: string; username: string; display_name: string | null; avatar_url: string | null }

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [lists, setLists] = useState<ListResult[]>([])
  const [profiles, setProfiles] = useState<ProfileResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (!q) { setLists([]); setProfiles([]); return }

    const timer = setTimeout(async () => {
      setSearching(true)
      const [listRes, profileRes] = await Promise.all([
        supabase
          .from('lists')
          .select('id, title, category, profiles(username, display_name)')
          .ilike('title', `%${q}%`)
          .limit(6),
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
          .limit(4),
      ])
      setLists((listRes.data ?? []) as unknown as ListResult[])
      setProfiles(profileRes.data ?? [])
      setSearching(false)
    }, 280)

    return () => clearTimeout(timer)
  }, [query])

  const hasResults = lists.length > 0 || profiles.length > 0
  const showEmpty = query.trim() && !searching && !hasResults

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: 'var(--muted)', flexShrink: 0 }}>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M12.5 12.5l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lists, people…"
          className="flex-1 bg-transparent outline-none text-base"
          style={{ color: 'var(--foreground)' }}
        />
        {searching && (
          <div className="w-4 h-4 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        )}
        <button
          onClick={onClose}
          className="shrink-0 text-sm font-medium px-2 py-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)' }}
        >
          Cancel
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!query.trim() && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Search lists and people</p>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center h-48">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No results for &ldquo;{query.trim()}&rdquo;</p>
          </div>
        )}

        {profiles.length > 0 && (
          <div>
            <p className="px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
              People
            </p>
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/${p.username}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                  >
                    {(p.display_name ?? p.username)[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.display_name ?? p.username}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>@{p.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {lists.length > 0 && (
          <div>
            <p className="px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
              Lists
            </p>
            {lists.map((l) => (
              <Link
                key={l.id}
                href={`/list/${l.id}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {l.category === 'movies' ? (
                    <svg width="16" height="15" viewBox="0 0 14 13" fill="none" style={{ color: 'var(--accent)' }}>
                      <rect x="1" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 2l1 3.5M7.5 2l1 3.5M11 2l1 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="15" viewBox="0 0 14 13" fill="none" style={{ color: '#a78bfa' }}>
                      <rect x="1" y="1" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M5 9.5v2M9 9.5v2M3.5 11.5h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{l.title}</p>
                  {l.profiles && (
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>@{l.profiles.username}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
