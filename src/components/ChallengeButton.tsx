'use client'

import { useState } from 'react'
import { useAuth } from '@/context/auth'

type Props = {
  topicId?: string | null  // if null/empty, will be resolved via find-or-create
  topicTitle: string
  senderListId?: string | null
}

export function ChallengeButton({ topicId, topicTitle, senderListId }: Props) {
  const { user, signInWithGoogle } = useAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function createChallenge() {
    if (!user) { signInWithGoogle(); return }
    setCreating(true)

    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    const token = session?.access_token
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    // Resolve topic_id if not provided
    let resolvedTopicId = topicId
    if (!resolvedTopicId) {
      const topicRes = await fetch('/api/topics/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ title: topicTitle }),
      })
      if (topicRes.ok) {
        const t = await topicRes.json()
        resolvedTopicId = t.id
      }
    }

    if (!resolvedTopicId) { setCreating(false); return }

    const res = await fetch('/api/challenges/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ topic_id: resolvedTopicId, message: message.trim() || null, sender_list_id: senderListId ?? null }),
    })

    if (res.ok) {
      const data = await res.json()
      setLink(data.url)
    }
    setCreating(false)
  }

  async function copyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    if (!link) return
    try {
      await navigator.share({ title: `Rank: ${topicTitle}`, url: link })
    } catch {}
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
        style={{ background: 'rgba(232,197,71,0.12)', color: 'var(--accent)', border: '1px solid rgba(232,197,71,0.25)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="10" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="10" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="3.3" y1="5.3" x2="8.7" y2="2.7" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="3.3" y1="6.7" x2="8.7" y2="9.3" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
        Challenge
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); setLink(null); setMessage('') } }}
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--accent)' }}>
                  Challenge a friend
                </p>
                <p className="text-sm font-semibold mt-0.5 truncate" style={{ maxWidth: 260 }}>{topicTitle}</p>
              </div>
              <button
                onClick={() => { setOpen(false); setLink(null); setMessage('') }}
                className="w-7 h-7 flex items-center justify-center rounded-full text-lg transition-opacity hover:opacity-60"
                style={{ color: 'var(--muted)', background: 'var(--surface-2)' }}
              >
                ×
              </button>
            </div>

            {!link ? (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a message… (optional)"
                  rows={2}
                  className="w-full text-sm px-3 py-2 rounded-lg resize-none outline-none mb-4"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <button
                  onClick={createChallenge}
                  disabled={creating}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  {creating ? 'Generating link…' : 'Get challenge link →'}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div
                  className="text-xs px-3 py-2.5 rounded-lg break-all select-all"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  {link}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    style={{ background: copied ? 'rgba(232,197,71,0.15)' : 'var(--accent)', color: copied ? 'var(--accent)' : '#0a0a0f', border: copied ? '1px solid rgba(232,197,71,0.4)' : 'none' }}
                  >
                    {copied ? '✓ Copied!' : 'Copy link'}
                  </button>
                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      onClick={nativeShare}
                      className="w-11 flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1v9M5 4l3-3 3 3M3 11v3h10v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
