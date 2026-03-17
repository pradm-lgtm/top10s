'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'
import { NavAuth } from '@/components/NavAuth'

export function AppHeader() {
  const { user, profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isHome = pathname === '/home'
  const isProfile = profile && pathname === `/${profile.username}`

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-md"
      style={{ background: 'rgba(10,10,15,0.85)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-6">
        <Link href="/home" className="text-base font-bold tracking-tight shrink-0" style={{ color: 'var(--foreground)' }}>
          Ranked
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/home"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: isHome ? 'var(--foreground)' : 'var(--muted)',
              background: isHome ? 'var(--surface)' : 'transparent',
            }}
          >
            Home
          </Link>
          {profile && (
            <Link
              href={`/${profile.username}`}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                color: isProfile ? 'var(--foreground)' : 'var(--muted)',
                background: isProfile ? 'var(--surface)' : 'transparent',
              }}
            >
              My Lists
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => user ? router.push('/create') : router.push('/')}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#0a0a0f' }}
          >
            + Create
          </button>
          <NavAuth />
        </div>
      </div>
    </header>
  )
}
