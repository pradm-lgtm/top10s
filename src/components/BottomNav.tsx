'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { useNavigation } from '@/context/navigation'

export function BottomNav() {
  const { profile } = useAuth()
  const { setNavPill, setShowSearch } = useNavigation()
  const pathname = usePathname()
  const router = useRouter()

  const isHome = pathname === '/home'
  const isSearch = pathname === '/search'
  const isMyLists = profile ? pathname === `/${profile.username}` : false

  function goHome() {
    if (isHome) {
      setNavPill('all')
    } else {
      setNavPill('all')
      router.push('/home')
    }
  }

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      active: isHome,
      onClick: goHome,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M3 10.5L11 3l8 7.5V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.5 20V14h5v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      active: isSearch,
      onClick: () => setShowSearch(true),
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M15 15l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: 'mylists',
      label: 'My Lists',
      active: isMyLists,
      href: profile ? `/${profile.username}` : null,
      onClick: !profile ? () => router.push('/') : undefined,
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="12" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="3" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="12" y="12" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        </svg>
      ),
    },
  ]

  // Don't show on pages where it doesn't make sense
  const hiddenPaths = ['/create', '/auth/callback']
  if (hiddenPaths.some((p) => pathname.startsWith(p))) return null

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
      style={{
        background: 'rgba(10,10,15,0.95)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {tabs.map((tab) => {
        const content = (
          <div className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0">
            <span style={{ color: tab.active ? 'var(--accent)' : 'var(--muted)' }}>{tab.icon}</span>
            <span
              className="text-[10px] font-medium truncate"
              style={{ color: tab.active ? 'var(--accent)' : 'var(--muted)' }}
            >
              {tab.label}
            </span>
          </div>
        )

        if (tab.href) {
          return (
            <Link key={tab.id} href={tab.href} className="flex-1">
              {content}
            </Link>
          )
        }

        return (
          <button key={tab.id} onClick={tab.onClick} className="flex-1">
            {content}
          </button>
        )
      })}
    </nav>
  )
}
