'use client'

import { AppHeader } from '@/components/AppHeader'

export default function SearchPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <AppHeader />
      <div className="max-w-xl mx-auto px-4 pt-16 pb-32 text-center">
        <svg
          width="40" height="40" viewBox="0 0 40 40" fill="none"
          className="mx-auto mb-4 opacity-30"
        >
          <circle cx="18" cy="18" r="12" stroke="var(--foreground)" strokeWidth="2.5"/>
          <path d="M27 27l8 8" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <h1 className="text-xl font-bold mb-2">Search</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Coming soon — search lists, topics, and people.</p>
      </div>
    </div>
  )
}
