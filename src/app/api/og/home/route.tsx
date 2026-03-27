import { ImageResponse } from 'next/og'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const accent = '#e8c547'
const bg = '#0a0a0a'

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RankedApp/1.0' } })
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

export async function GET() {
  const supabase = getAdminSupabase()

  // Get 6 diverse poster images from recent entries that have images
  const { data: entries } = await supabase
    .from('list_entries')
    .select('list_id, image_url')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40)

  // Dedupe by list_id, take 6
  const seen = new Set<string>()
  const posterUrls: string[] = []
  for (const e of entries ?? []) {
    if (e.image_url && !seen.has(e.list_id) && posterUrls.length < 6) {
      seen.add(e.list_id)
      posterUrls.push(e.image_url)
    }
  }
  while (posterUrls.length < 6) posterUrls.push('')

  // Fetch all 6 as base64 with a 4s budget
  const posterSrcs = await Promise.race([
    Promise.all(posterUrls.map((url) => url ? fetchAsBase64(url) : Promise.resolve(null))),
    new Promise<null[]>((resolve) => setTimeout(() => resolve([null, null, null, null, null, null]), 4000)),
  ])

  // 3 cols × 2 rows
  const CELL_W = W / 3   // 400
  const CELL_H = H / 2   // 315

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: bg,
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* ── Background poster grid ── */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexWrap: 'wrap' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: CELL_W,
                height: CELL_H,
                overflow: 'hidden',
                display: 'flex',
                opacity: 0.22,
              }}
            >
              {posterSrcs[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posterSrcs[i]!}
                  alt=""
                  style={{ width: CELL_W, height: CELL_H, objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: CELL_W, height: CELL_H, background: '#111118', display: 'flex' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Dark vignette overlay ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0.92) 100%)',
            display: 'flex',
          }}
        />

        {/* ── Gold top accent bar ── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, display: 'flex' }} />

        {/* ── Centered content ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
          }}
        >
          {/* Bars icon */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: 28 }}>
            <div style={{ width: 18, height: 52, borderRadius: 4, background: accent }} />
            <div style={{ width: 18, height: 37, borderRadius: 4, background: accent }} />
            <div style={{ width: 18, height: 24, borderRadius: 4, background: accent }} />
          </div>

          {/* Wordmark */}
          <div
            style={{
              color: accent,
              fontSize: 80,
              fontWeight: 800,
              letterSpacing: 18,
              lineHeight: 1,
              marginBottom: 20,
            }}
          >
            RANKED
          </div>

          {/* Tagline */}
          <div
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: 3,
            }}
          >
            Your take. Ranked.
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
