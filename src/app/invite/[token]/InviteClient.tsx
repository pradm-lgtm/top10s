'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { AppHeader } from '@/components/AppHeader'

type InviteData = {
  id: string
  topic: { id: string; slug: string; title: string; category: string }
  sender: { username: string; display_name: string | null; avatar_url: string | null } | null
  senderList: {
    id: string; title: string
    list_format: string; category: string
    year: number | null; year_from: number | null; year_to: number | null
    entries: { title: string; image_url: string | null }[]
  } | null
  message: string | null
  accepted: boolean
}

export function InviteClient({ invite, token }: { invite: InviteData; token: string }) {
  const { user, signInAnonymously } = useAuth()
  const router = useRouter()

  // Sign in anonymously when a guest lands on an invite page
  useEffect(() => {
    if (!user) {
      signInAnonymously()
    }
  }, [user, signInAnonymously])

  function startList() {
    // Store invite context for the create flow
    sessionStorage.setItem('invite_token', token)
    sessionStorage.setItem('invite_topic_id', invite.topic.id)
    sessionStorage.setItem('invite_topic_title', invite.topic.title)

    // Derive category and format from sender's list if available, else from topic
    const effectiveCategory = invite.senderList?.category ?? (invite.topic.category !== 'any' ? invite.topic.category : null)
    const format = invite.senderList?.list_format
    const year = invite.senderList?.year
    const yearFrom = invite.senderList?.year_from
    const yearTo = invite.senderList?.year_to

    const params = new URLSearchParams({
      title: invite.topic.title,
      inviteToken: token,
      ...(effectiveCategory && ['movies', 'tv'].includes(effectiveCategory) ? { category: effectiveCategory } : {}),
      ...(format && ['ranked', 'tiered', 'tier-ranked'].includes(format) ? { format } : {}),
      ...(year ? { year: String(year) } : {}),
      ...(yearFrom ? { yearFrom: String(yearFrom) } : {}),
      ...(yearTo ? { yearTo: String(yearTo) } : {}),
    })
    router.push(`/create?${params.toString()}`)
  }

  const senderName = invite.sender?.display_name ?? invite.sender?.username ?? 'Someone'
  const hasSenderList = invite.senderList && invite.senderList.entries.length > 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-24">
        {/* Invite card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px solid rgba(232,197,71,0.25)', boxShadow: '0 0 60px rgba(232,197,71,0.06)' }}
        >
          {/* Header */}
          <div className="px-6 pt-8 pb-6" style={{ background: 'var(--surface)' }}>
            {invite.sender && (
              <div className="flex items-center gap-2.5 mb-5">
                {invite.sender.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={invite.sender.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                  >
                    {senderName[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold">{senderName}</span>
              </div>
            )}

            <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
              {invite.topic.title}
            </h1>

            {invite.message && (
              <p className="text-sm italic mb-5" style={{ color: 'var(--muted)' }}>
                &ldquo;{invite.message}&rdquo;
              </p>
            )}

            <button
              onClick={startList}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-opacity hover:opacity-80"
              style={{ background: 'var(--accent)', color: '#0a0a0f' }}
            >
              Share your take →
            </button>
          </div>

          {/* Sender's teaser */}
          {hasSenderList && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--background)' }}>
              <div className="px-6 py-4">
                <p className="text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: 'var(--muted)' }}>
                  {senderName}&apos;s list — share your take first to see it
                </p>
                <div className="flex gap-3 relative">
                  {invite.senderList!.entries.map((entry, i) => (
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
            href={`/topic/${invite.topic.slug}`}
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
