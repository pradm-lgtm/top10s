'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('visitor_name')
    if (saved) {
      router.replace('/home')
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setLoading(true)
    setError('')

    try {
      const { data, error: dbError } = await supabase
        .from('visitors')
        .insert({ name: trimmed })
        .select('id, name')
        .single()

      if (dbError) throw dbError

      localStorage.setItem('visitor_id', data.id)
      localStorage.setItem('visitor_name', data.name)
      router.push('/home')
    } catch (err) {
      console.error(err)
      // Fallback: store locally even if DB fails
      localStorage.setItem('visitor_id', crypto.randomUUID())
      localStorage.setItem('visitor_name', trimmed)
      router.push('/home')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Cinematic background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,197,71,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-10">
        {/* Logo / Title */}
        <div className="text-center space-y-3">
          <div
            className="text-xs tracking-[0.4em] uppercase font-medium"
            style={{ color: 'var(--accent)' }}
          >
            A curated collection
          </div>
          <h1
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-none"
            style={{ color: 'var(--foreground)' }}
          >
            Top 10
          </h1>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            Movies &amp; TV Shows
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-px" style={{ background: 'var(--accent)' }} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="block text-sm tracking-wide"
              style={{ color: 'var(--muted)' }}
            >
              What should I call you?
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name..."
              maxLength={50}
              required
              className="w-full px-4 py-3 rounded-lg text-base outline-none transition-all"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'var(--accent)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'var(--border)')
              }
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#f87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-lg font-semibold tracking-wide text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--accent)',
              color: '#0a0a0f',
            }}
          >
            {loading ? 'Loading…' : 'Enter the Lists →'}
          </button>
        </form>

        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          No account needed — just your name.
        </p>
      </div>
    </div>
  )
}
