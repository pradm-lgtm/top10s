'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth'

export function OnboardingModal() {
  const { user, profile } = useAuth()
  const [show, setShow] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || !profile) return
    const key = `ranked_onboarded_${user.id}`
    if (localStorage.getItem(key)) return
    // Returning user who already has a profile — skip modal, just mark as done
    if (profile.display_name && profile.username) {
      localStorage.setItem(key, '1')
      return
    }
    setDisplayName(profile.display_name ?? '')
    setUsername(profile.username ?? '')
    setShow(true)
  }, [user, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !displayName.trim() || !username.trim()) return
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!clean) { setError('Username can only contain letters, numbers, and underscores.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), username: clean })
      .eq('id', user.id)
    if (err) {
      if (err.message.includes('unique')) {
        setError('That username is taken. Try another.')
      } else {
        setError('Something went wrong. Try again.')
      }
      setSaving(false)
      return
    }
    localStorage.setItem(`ranked_onboarded_${user.id}`, '1')
    setShow(false)
    // Reload to refresh profile in context
    window.location.reload()
  }

  if (!show) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-8 space-y-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Welcome to Ranked</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Just confirm how you'd like to appear on the site.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
                Display name
              </label>
              <input
                autoFocus
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: 'var(--muted)' }}>
                Username
              </label>
              <div className="flex items-center gap-0">
                <span
                  className="px-3 py-2.5 rounded-l-lg text-sm border-r-0"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', borderRight: 'none' }}
                >
                  @
                </span>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="username"
                  maxLength={30}
                  className="flex-1 px-3 py-2.5 rounded-r-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)', borderLeft: 'none' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
              {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
            </div>

            <button
              type="submit"
              disabled={saving || !displayName.trim() || !username.trim()}
              className="w-full py-3 rounded-lg text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              {saving ? 'Saving…' : "Let's go →"}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
