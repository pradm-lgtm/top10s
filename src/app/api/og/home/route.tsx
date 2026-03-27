import { ImageResponse } from 'next/og'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const CELL_W = 400  // W / 3
const CELL_H = 315  // H / 2
const accent = '#e8c547'
const bg = '#0a0a0a'

// Grid positions for 3×2 layout
const CELLS = [
  { left: 0,    top: 0    },
  { left: 400,  top: 0    },
  { left: 800,  top: 0    },
  { left: 0,    top: 315  },
  { left: 400,  top: 315  },
  { left: 800,  top: 315  },
]

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

  // Get 6 diverse posters from recent entries that have images
  const { data: entries } = await supabase
    .from('list_entries')
    .select('list_id, image_url')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const seen = new Set<string>()
  const posterUrls: string[] = []
  for (const e of entries ?? []) {
    if (e.image_url && !seen.has(e.list_id) && posterUrls.length < 6) {
      seen.add(e.list_id)
      posterUrls.push(e.image_url)
    }
  }

  // Tile if fewer than 6
  const filled: string[] = Array.from({ length: 6 }, (_, i) =>
    posterUrls.length > 0 ? posterUrls[i % posterUrls.length] : ''
  )

  // Fetch all 6 as base64 with a 4s budget
  const posterSrcs = await Promise.race([
    Promise.all(filled.map((url) => url ? fetchAsBase64(url) : Promise.resolve(null))),
    new Promise<null[]>((resolve) => setTimeout(() => resolve([null, null, null, null, null, null]), 4000)),
  ])

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
        {/* ── Poster grid: 3×2, each cell absolutely positioned ── */}
        {CELLS.map((pos, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos.left,
              top: pos.top,
              width: CELL_W,
              height: CELL_H,
              overflow: 'hidden',
              display: 'flex',
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

        {/* ── Dark overlay covering full canvas ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
          }}
        />

        {/* ── Gold top accent bar ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: 3,
            background: accent,
            display: 'flex',
          }}
        />

        {/* ── Centered content ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Descending bars icon */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 24 }}>
            <div style={{ width: 18, height: 52, borderRadius: 4, background: accent, display: 'flex' }} />
            <div style={{ width: 18, height: 37, borderRadius: 4, background: accent, display: 'flex' }} />
            <div style={{ width: 18, height: 24, borderRadius: 4, background: accent, display: 'flex' }} />
          </div>

          {/* Wordmark */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: 20,
              lineHeight: 1,
              marginBottom: 20,
              display: 'flex',
            }}
          >
            RANKED
          </div>

          {/* Tagline */}
          <div
            style={{
              color: accent,
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: 4,
              display: 'flex',
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
