'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/auth'
import { useNavigation } from '@/context/navigation'
import { NavAuth } from '@/components/NavAuth'
import { NotificationBell } from '@/components/NotificationBell'
import { SearchOverlay } from '@/components/SearchOverlay'

export function AppHeader() {
  const { user, profile } = useAuth()
  const { showSearch, setShowSearch } = useNavigation()
  const pathname = usePathname()
  const router = useRouter()

  const isHome = pathname === '/home'
  const isProfile = profile && pathname === `/${profile.username}`

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-6">
          {/* Brand */}
          <Link
            href="/home"
            className="shrink-0 font-bold tracking-tight"
            style={{ color: 'var(--foreground)', fontSize: 18 }}
          >
            Ranked
          </Link>

          {/* Nav links — hidden on mobile (use bottom nav instead) */}
          <nav className="hidden sm:flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/home"
              className="px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
              style={{
                fontSize: 12,
                color: isHome ? 'var(--foreground)' : 'var(--muted)',
                background: isHome ? 'var(--surface)' : 'transparent',
              }}
            >
              Home
            </Link>
            {profile && (
              <Link
                href={`/${profile.username}`}
                className="px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                style={{
                  fontSize: 12,
                  color: isProfile ? 'var(--foreground)' : 'var(--muted)',
                  background: isProfile ? 'var(--surface)' : 'transparent',
                }}
              >
                My Lists
              </Link>
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Search icon */}
            <button
              onClick={() => setShowSearch(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7"/>
                <path d="M13.5 13.5l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </button>

            <button
              onClick={() => user ? router.push('/create') : router.push('/')}
              className="rounded-lg font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{
                background: 'var(--accent)',
                color: '#0a0a0f',
                fontSize: 12,
                padding: '6px 10px',
              }}
            >
              + Create
            </button>
            <NotificationBell />
            <NavAuth />
          </div>
        </div>
      </header>

      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
    </>
  )
}
