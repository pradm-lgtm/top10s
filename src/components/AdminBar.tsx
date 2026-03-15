'use client'

import { useRouter } from 'next/navigation'
import { useAdmin } from '@/context/admin'

export function AdminBar() {
  const { isAdmin, setIsAdmin } = useAdmin()
  const router = useRouter()

  if (!isAdmin) return null

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setIsAdmin(false)
    router.refresh()
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-2 rounded-full text-xs font-semibold shadow-lg"
      style={{
        background: 'rgba(232,197,71,0.15)',
        border: '1px solid rgba(232,197,71,0.4)',
        color: 'var(--accent)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span>✎ Admin Mode</span>
      <button
        onClick={handleLogout}
        className="px-2 py-0.5 rounded-full transition-all"
        style={{ border: '1px solid rgba(232,197,71,0.3)', color: 'var(--muted)' }}
      >
        Sign out
      </button>
    </div>
  )
}
