import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { getAdminSupabase } from '@/lib/supabase-admin'
import Link from 'next/link'

type FeedbackRow = {
  id: string
  nps_score: number
  suggestions: string | null
  user_id: string | null
  created_at: string
  profiles?: { username: string; display_name: string | null } | null
}

export default async function AdminFeedbackPage() {
  if (!(await isAdmin())) redirect('/admin/login')

  const supabase = getAdminSupabase()
  const { data: rows } = await supabase
    .from('feedback')
    .select('id, nps_score, suggestions, user_id, created_at')
    .order('created_at', { ascending: false })

  // Enrich with profile info for signed-in users (separate query — no FK to profiles)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))]
  const profileMap: Record<string, { username: string; display_name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds)
    for (const p of profiles ?? []) profileMap[p.id] = p
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feedback: FeedbackRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    nps_score: r.nps_score,
    suggestions: r.suggestions ?? null,
    user_id: r.user_id ?? null,
    created_at: r.created_at,
    profiles: r.user_id ? profileMap[r.user_id] ?? null : null,
  }))

  const total = feedback.length
  const avg = total > 0
    ? (feedback.reduce((sum, r) => sum + r.nps_score, 0) / total).toFixed(1)
    : '—'

  // NPS: promoters (9-10), passives (7-8), detractors (1-6)
  const promoters = feedback.filter(r => r.nps_score >= 9).length
  const detractors = feedback.filter(r => r.nps_score <= 6).length
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null

  // Score colour
  function scoreColor(n: number) {
    if (n >= 9) return '#4ade80'  // green
    if (n >= 7) return '#facc15'  // yellow
    return '#f87171'              // red
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <Link href="/home" className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>Ranked</Link>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>Feedback</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-3xl font-bold">{total}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Responses</div>
          </div>
          <div className="rounded-xl p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-3xl font-bold">{avg}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Avg score</div>
          </div>
          <div className="rounded-xl p-5 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-3xl font-bold" style={{ color: nps !== null && nps >= 0 ? '#4ade80' : '#f87171' }}>
              {nps !== null ? (nps >= 0 ? `+${nps}` : nps) : '—'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>NPS</div>
          </div>
        </div>

        {/* Score distribution */}
        {total > 0 && (
          <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>Score distribution</h2>
            <div className="flex items-end gap-1.5 h-16">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const count = feedback.filter(r => r.nps_score === n).length
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div key={n} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(pct, 4)}%`,
                        background: scoreColor(n),
                        opacity: count === 0 ? 0.15 : 1,
                      }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Individual responses */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--muted)' }}>
            Responses ({total})
          </h2>
          {total === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No feedback yet.</p>
          )}
          {feedback.map((r) => {
            const name = r.profiles?.display_name ?? r.profiles?.username ?? 'Anonymous'
            const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            return (
              <div
                key={r.id}
                className="rounded-xl p-4 flex gap-4 items-start"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {/* Score badge */}
                <div
                  className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: `${scoreColor(r.nps_score)}18`, color: scoreColor(r.nps_score), border: `1px solid ${scoreColor(r.nps_score)}40` }}
                >
                  {r.nps_score}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{date}</span>
                  </div>
                  {r.suggestions ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{r.suggestions}</p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--muted)', opacity: 0.5 }}>No comment</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </main>
    </div>
  )
}
