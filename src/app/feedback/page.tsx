'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function FeedbackPage() {
  const [score, setScore] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (score === null) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nps_score: score, suggestions: suggestions.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/home" className="font-bold tracking-tight text-lg" style={{ color: 'var(--foreground)' }}>
            Ranked
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
        {submitted ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">🙏</div>
            <h1 className="text-2xl font-bold">Thanks for your feedback!</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              It helps us make Ranked better for everyone.
            </p>
            <Link
              href="/home"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Beta banner */}
            <div className="space-y-1">
              <div
                className="inline-block text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded mb-3"
                style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.2)' }}
              >
                Beta
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Share your feedback</h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Ranked is in beta — we&apos;d love to hear what you think.
              </p>
            </div>

            {/* NPS */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold">
                How likely are you to recommend Ranked to a friend?
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className="w-10 h-10 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: score === n ? 'var(--accent)' : 'var(--surface)',
                      color: score === n ? '#0a0a0f' : 'var(--foreground)',
                      border: `1px solid ${score === n ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </div>

            {/* Open-ended */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold">
                What changes would you recommend?
              </label>
              <textarea
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                placeholder="Tell us what you'd improve, what's missing, or what you love…"
                rows={5}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(232,197,71,0.5)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={score === null || submitting}
              className="w-full py-3 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
