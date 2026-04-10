import Link from 'next/link'

export function AppFooter() {
  return (
    <div className="text-center py-8 flex items-center justify-center gap-4">
      <a href="/privacy" className="text-xs transition-opacity hover:opacity-60" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Privacy Policy
      </a>
      <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
      <Link href="/feedback" className="text-xs transition-opacity hover:opacity-60" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Share feedback
      </Link>
    </div>
  )
}
