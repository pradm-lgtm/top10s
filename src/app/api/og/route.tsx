import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Image dimensions
const W = 1200
const H = 630
const HEADER_H = 56
const BOTTOM_H = 88
const POSTER_H = H - HEADER_H - BOTTOM_H  // 486px
const POSTER_W = Math.round(POSTER_H * (2 / 3)) // 324px — true 2:3 poster ratio
const POSTER_GAP = 14
const POSTER_AREA_W = POSTER_W * 3 + POSTER_GAP * 2 // 980px
const POSTER_PAD_X = Math.round((W - POSTER_AREA_W) / 2) // 110px

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })

  const supabase = getAdminSupabase()

  const [{ data: list }, { data: entries }, { count }] = await Promise.all([
    supabase
      .from('lists')
      .select('id, title, year, category, list_format, profiles(username, display_name, avatar_url)')
      .eq('id', id)
      .single(),
    supabase
      .from('list_entries')
      .select('id, title, rank, image_url')
      .eq('list_id', id)
      .order('rank', { ascending: true })
      .limit(3),
    supabase
      .from('list_entries')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', id),
  ])

  if (!list) return new Response('Not found', { status: 404 })

  const owner = (Array.isArray(list.profiles) ? list.profiles[0] : list.profiles) as {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null

  const ownerName = owner?.display_name ?? owner?.username ?? ''
  const initial = ownerName ? ownerName[0].toUpperCase() : '?'
  const isMovie = list.category === 'movies'
  const totalCount = count ?? 0
  const topEntries = entries ?? []
  const extraCount = totalCount - topEntries.length

  const categoryLabel = isMovie ? 'MOVIES' : 'TV SHOWS'
  const formatLabel =
    list.list_format === 'ranked' ? 'RANKED' :
    list.list_format === 'tiered' ? 'TIERED' : 'TIER-RANKED'

  const accent = '#e8c547'
  const bg = '#0a0a0a'
  const muted = 'rgba(255,255,255,0.45)'

  // Fetch images in parallel
  const [avatarSrc, ...posterSrcs] = await Promise.all([
    owner?.avatar_url ? fetchAsBase64(owner.avatar_url) : Promise.resolve(null),
    ...topEntries.map((e) => e.image_url ? fetchAsBase64(e.image_url) : Promise.resolve(null)),
  ])

  // Pad to 3 slots
  while (posterSrcs.length < 3) posterSrcs.push(null)

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Gold top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, display: 'flex' }} />

        {/* ── HEADER ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `18px ${POSTER_PAD_X}px 0`,
            height: HEADER_H,
            flexShrink: 0,
          }}
        >
          <span style={{ color: accent, fontSize: 12, letterSpacing: 8, fontWeight: 700 }}>
            RANKED
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(232,197,71,0.3)',
              padding: '4px 12px',
              borderRadius: 3,
              color: accent,
              fontSize: 11,
              letterSpacing: 2.5,
              fontWeight: 600,
            }}
          >
            {categoryLabel} · {formatLabel}
          </div>
        </div>

        {/* ── POSTERS ── */}
        <div
          style={{
            display: 'flex',
            gap: POSTER_GAP,
            padding: `0 ${POSTER_PAD_X}px`,
            height: POSTER_H,
            flexShrink: 0,
          }}
        >
          {[0, 1, 2].map((i) => {
            const entry = topEntries[i]
            const src = posterSrcs[i]
            return (
              <div
                key={i}
                style={{
                  width: POSTER_W,
                  height: POSTER_H,
                  borderRadius: 10,
                  overflow: 'hidden',
                  position: 'relative',
                  flexShrink: 0,
                  display: 'flex',
                  background: '#111118',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                }}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                  />
                ) : (
                  // Placeholder
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 100%)',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', padding: '0 16px', lineHeight: 1.4 }}>
                      {entry?.title ?? ''}
                    </span>
                  </div>
                )}

                {/* Gradient scrim at bottom */}
                <div
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 96,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)',
                    display: 'flex',
                  }}
                />

                {/* Entry title */}
                {entry && (
                  <div
                    style={{
                      position: 'absolute', bottom: 10, left: 10, right: 10,
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    {i === 0 && (
                      <span style={{ color: accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
                        #1
                      </span>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
                      {entry.title}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── BOTTOM STRIP ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `0 ${POSTER_PAD_X}px`,
            height: BOTTOM_H,
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* List title */}
          <span
            style={{
              color: '#ffffff',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.5,
              flex: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              marginRight: 32,
            }}
          >
            {list.title}{list.year ? ` (${list.year})` : ''}
          </span>

          {/* Owner + extra count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" style={{ width: 30, height: 30, borderRadius: 15, objectFit: 'cover' }} />
            ) : (
              <div
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: bg,
                }}
              >
                {initial}
              </div>
            )}
            <span style={{ color: muted, fontSize: 15 }}>{ownerName}</span>
            {extraCount > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                · +{extraCount} more
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
