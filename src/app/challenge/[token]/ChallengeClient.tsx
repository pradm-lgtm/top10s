'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { AppHeader } from '@/components/AppHeader'

type ChallengeData = {
  id: string
  topic: { id: string; slug: string; title: string; category: string }
  sender: { username: string; display_name: string | null; avatar_url: string | null } | null
  senderList: { id: string; title: string; entries: { title: string; image_url: string | null }[] } | null
  message: string | null
  accepted: boolean
}

export function ChallengeClient({ challenge, token }: { challenge: ChallengeData; token: string }) {
  const { user, signInAnonymously } = useAuth()
  const router = useRouter()

  // Sign in anonymously when a guest lands on a challenge page
  useEffect(() => {
    if (!user) {
      signInAnonymously()
    }
  }, [user, signInAnonymously])

  function startList() {
    // Store challenge context for the create flow
    sessionStorage.setItem('challenge_token', token)
    sessionStorage.setItem('challenge_topic_id', challenge.topic.id)
    sessionStorage.setItem('challenge_topic_title', challenge.topic.title)

    const params = new URLSearchParams({
      title: challenge.topic.title,
      challengeToken: token,
      ...(challenge.topic.category !== 'any' ? { category: challenge.topic.category } : {}),
    })
    router.push(`/create?${params.toString()}`)
  }

  const senderName = challenge.sender?.display_name ?? challenge.sender?.username ?? 'Someone'
  const hasSenderList = challenge.senderList && challenge.senderList.entries.length > 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-24">
        {/* Challenge card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(232,197,71,0.25)', boxShadow: '0 0 60px rgba(232,197,71,0.06)' }}
        >
          {/* Header */}
          <div className="px-6 pt-8 pb-6" style={{ background: 'var(--surface)' }}>
            {challenge.sender && (
              <div className="flex items-center gap-2.5 mb-5">
                {challenge.sender.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={challenge.sender.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                  >
                    {senderName[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-sm font-semibold">{senderName}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}> challenged you to rank:</span>
                </div>
              </div>
            )}

            <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
              {challenge.topic.title}
            </h1>

            {challenge.message && (
              <p className="text-sm italic mb-5" style={{ color: 'var(--muted)' }}>
                &ldquo;{challenge.message}&rdquo;
              </p>
            )}

            <button
              onClick={startList}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              Make your {challenge.topic.title} list →
            </button>
          </div>

          {/* Sender's teaser */}
          {hasSenderList && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: 'var(--muted)' }}>
                  {senderName}&apos;s list — make yours first to see it
                </p>
                <div className="flex gap-3 relative">
                  {challenge.senderList!.entries.map((entry, i) => (
                    <div key={i} className="relative shrink-0" style={{ width: 72, height: 108 }}>
                      {entry.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.image_url}
                          alt={entry.title}
                          className="w-full h-full object-cover rounded-lg"
                          style={{ filter: 'blur(6px)', opacity: 0.5 }}
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded-lg flex items-center justify-center text-[10px] text-center px-1"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)', filter: 'blur(2px)' }}
                        >
                          {entry.title}
                        </div>
                      )}
                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.4)' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M9 3v6M9 12h.01M3.5 14.5C2.6 13.3 2 11.7 2 10c0-3.9 3.1-7 7-7s7 3.1 7 7c0 1.7-.6 3.3-1.5 4.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                  <div className="flex-1 flex items-center justify-center text-xs text-center px-3" style={{ color: 'var(--muted)' }}>
                    Complete your list to reveal their picks
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Topic page link */}
        <div className="mt-6 text-center">
          <Link
            href={`/topic/${challenge.topic.slug}`}
            className="text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            See what everyone else ranked →
          </Link>
        </div>
      </div>
    </div>
  )
}
