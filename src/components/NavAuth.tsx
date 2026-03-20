'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'

export function NavAuth() {
  const { user, profile, loading, signInWithGoogle, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    setSigningOut(true)
    setOpen(false)
    await signOut()
    router.push('/')
  }

  if (loading) return <div className="w-8 h-8" />

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        Sign in
      </button>
    )
  }

  const initials = (profile?.display_name ?? profile?.username ?? 'U')[0].toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
        aria-label="Account menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full" loading="lazy" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#0a0a0f' }}
          >
            {initials}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 rounded-xl py-1 min-w-[180px]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold">{profile?.display_name ?? profile?.username}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>@{profile?.username}</p>
            </div>
            <Link
              href={`/${profile?.username}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm transition-opacity hover:opacity-70"
              style={{ color: 'var(--foreground)' }}
            >
              My Lists
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full text-left px-4 py-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-40"
              style={{ color: 'var(--muted)' }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
