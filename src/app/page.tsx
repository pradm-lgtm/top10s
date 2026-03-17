'use client'

import Link from 'next/link'
import { useAuth } from '@/context/auth'

export default function LandingPage() {
  const { user, profile, loading, signInWithGoogle } = useAuth()

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
            by Prad
          </div>
          <h1
            className="text-5xl sm:text-6xl font-bold tracking-tight leading-none"
            style={{ color: 'var(--foreground)' }}
          >
            Ranked
          </h1>
          <p className="text-lg" style={{ color: 'var(--muted)' }}>
            The best in film &amp; TV, year by year
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-px" style={{ background: 'var(--accent)' }} />

        {!loading && (
          <div className="w-full flex flex-col gap-3">
            {user ? (
              <Link
                href="/home"
                className="w-full py-3 rounded-lg font-semibold tracking-wide text-sm text-center transition-all"
                style={{ background: 'var(--accent)', color: '#0a0a0f' }}
              >
                {profile?.display_name ? `Continue as ${profile.display_name.split(' ')[0]} →` : 'Enter →'}
              </Link>
            ) : (
              <>
                <button
                  onClick={signInWithGoogle}
                  className="w-full py-3 rounded-lg font-semibold tracking-wide text-sm text-center transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ background: 'var(--accent)', color: '#0a0a0f' }}
                >
                  Sign in with Google
                </button>
                <Link
                  href="/home"
                  className="w-full py-3 rounded-lg font-medium text-sm text-center transition-opacity hover:opacity-70"
                  style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                >
                  Browse without signing in
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
