import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Image dimensions
const W = 1200
const H = 630
const HEADER_H = 56
const BOTTOM_H = 140
const POSTER_H = H - HEADER_H - BOTTOM_H  // 434px
const POSTER_W = Math.round(POSTER_H * (2 / 3)) // 289px — 2:3 poster ratio
const POSTER_GAP = 14
const POSTER_AREA_W = POSTER_W * 3 + POSTER_GAP * 2
const POSTER_PAD_X = Math.round((W - POSTER_AREA_W) / 2)

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RankedApp/1.0' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

async function tmdbPosterUrl(title: string, category: 'movies' | 'tv'): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey) return null
  const type = category === 'movies' ? 'movie' : 'tv'
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${apiKey}&page=1`,
      { headers: { 'User-Agent': 'RankedApp/1.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const hit = (data.results ?? []).find((r: { poster_path?: string }) => r.poster_path)
    return hit?.poster_path ? `https://image.tmdb.org/t/p/w342${hit.poster_path}` : null
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

  // Resolve + fetch all images with a 3.5s budget (WhatsApp crawler times out at ~5s)
  const IMAGE_BUDGET_MS = 3500
  const imageStart = Date.now()

  const resolvedPosterUrls = await Promise.race([
    Promise.all(
      topEntries.map(async (e) => {
        if (e.image_url) return e.image_url
        return tmdbPosterUrl(e.title, list.category as 'movies' | 'tv')
      })
    ),
    new Promise<null[]>((resolve) =>
      setTimeout(() => resolve([null, null, null]), IMAGE_BUDGET_MS)
    ),
  ])

  const remaining = IMAGE_BUDGET_MS - (Date.now() - imageStart)

  // Fetch all images as base64 in parallel (avatar + posters)
  const [avatarSrc, ...posterSrcs] = await Promise.race([
    Promise.all([
      owner?.avatar_url ? fetchAsBase64(owner.avatar_url) : Promise.resolve(null),
      ...resolvedPosterUrls.map((url) => url ? fetchAsBase64(url) : Promise.resolve(null)),
    ]),
    new Promise<null[]>((resolve) =>
      setTimeout(() => resolve([null, null, null, null]), Math.max(remaining, 500))
    ),
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
                  flexShrink: 0,
                  display: 'flex',
                  position: 'relative',
                  background: '#111118',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                }}
              >
                {/* Poster image — explicit px dimensions, not 100% */}
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    style={{ width: POSTER_W, height: POSTER_H, objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: POSTER_W,
                      height: POSTER_H,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(160deg, #1a1a2e 0%, #0f0f1a 100%)',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', padding: '0 16px', lineHeight: 1.4 }}>
                      {entry?.title ?? ''}
                    </span>
                  </div>
                )}

                {/* Gradient scrim */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0, left: 0,
                    width: POSTER_W, height: 100,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
                    display: 'flex',
                  }}
                />

                {/* Rank + title overlay */}
                {entry && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 10, left: 10, right: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                    }}
                  >
                    <span style={{ color: i === 0 ? accent : 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
                      #{entry.rank ?? i + 1}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
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
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Left: list title */}
          <span
            style={{
              color: '#ffffff',
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -0.5,
              flex: 1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              marginRight: 24,
            }}
          >
            {list.title}{list.year ? ` (${list.year})` : ''}
          </span>

          {/* Right: +X more (prominent) + owner */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            {extraCount > 0 && (
              <span style={{ color: accent, fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>
                +{extraCount} more
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }} />
              ) : (
                <div
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: bg,
                  }}
                >
                  {initial}
                </div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17 }}>{ownerName}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
