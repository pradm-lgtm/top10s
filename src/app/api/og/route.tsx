import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

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

  if (!list) {
    return new Response('Not found', { status: 404 })
  }

  const owner = (Array.isArray(list.profiles) ? list.profiles[0] : list.profiles) as { username: string; display_name: string | null; avatar_url: string | null } | null
  const ownerName = owner?.display_name ?? owner?.username ?? ''
  const initial = ownerName ? ownerName[0].toUpperCase() : '?'
  const isMovie = list.category === 'movies'
  const accent = '#e8c547'
  const totalCount = count ?? 0

  const formatLabel = list.list_format === 'ranked' ? 'Ranked' : list.list_format === 'tiered' ? 'Tiered' : 'Tier-Ranked'
  const categoryEmoji = isMovie ? '🎬' : '📺'
  const categoryLabel = isMovie ? 'Movies' : 'TV Shows'

  // Fetch avatar as base64 if available to avoid CORS issues in ImageResponse
  let avatarSrc: string | null = null
  if (owner?.avatar_url) {
    try {
      const res = await fetch(owner.avatar_url)
      const buf = await res.arrayBuffer()
      const mime = res.headers.get('content-type') ?? 'image/jpeg'
      avatarSrc = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
    } catch {
      // fall back to initial
    }
  }

  // Fetch poster images as base64
  const posterSrcs: (string | null)[] = await Promise.all(
    (entries ?? []).slice(0, 3).map(async (entry) => {
      if (!entry.image_url) return null
      try {
        const res = await fetch(entry.image_url)
        const buf = await res.arrayBuffer()
        const mime = res.headers.get('content-type') ?? 'image/jpeg'
        return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
      } catch {
        return null
      }
    })
  )

  const topEntries = entries ?? []
  const hasPosters = posterSrcs.some(Boolean)

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#0a0a0f',
          display: 'flex',
          flexDirection: 'column',
          padding: '52px 64px 44px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, display: 'flex' }} />

        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            left: '50%',
            width: 800,
            height: 400,
            background: 'radial-gradient(ellipse, rgba(232,197,71,0.07) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Header row: RANKED wordmark + category badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <span style={{ color: accent, fontSize: 13, letterSpacing: 7, fontWeight: 700 }}>
            RANKED
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(232,197,71,0.3)',
              padding: '5px 14px',
              borderRadius: 4,
              color: accent,
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            <span>{categoryEmoji}</span>
            <span>{categoryLabel.toUpperCase()} · {formatLabel.toUpperCase()}</span>
          </div>
        </div>

        {/* Main area */}
        <div style={{ display: 'flex', flex: 1, gap: 48 }}>

          {/* Left: title + entries + owner */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Title */}
              <div
                style={{
                  color: '#ffffff',
                  fontSize: topEntries.length > 0 ? 50 : 68,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: -1,
                  marginBottom: 28,
                  maxWidth: hasPosters ? 640 : '100%',
                }}
              >
                {list.title}
              </div>

              {/* Top entries list */}
              {topEntries.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topEntries.map((entry, i) => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span
                        style={{
                          color: i === 0 ? accent : 'rgba(255,255,255,0.35)',
                          fontSize: 20,
                          fontWeight: 800,
                          width: 28,
                          textAlign: 'right',
                          display: 'flex',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {entry.rank ?? i + 1}
                      </span>
                      <span style={{ color: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)', fontSize: 20, fontWeight: 500 }}>
                        {entry.title}
                      </span>
                    </div>
                  ))}
                  {totalCount > 3 && (
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, marginLeft: 42, marginTop: 2, display: 'flex' }}>
                      +{totalCount - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Owner row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }} alt="" />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#0a0a0f',
                  }}
                >
                  {initial}
                </div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18 }}>{ownerName}</span>
              {list.year && (
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>· {list.year}</span>
              )}
            </div>
          </div>

          {/* Right: poster stack */}
          {hasPosters && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'flex-end',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {posterSrcs.map((src, i) =>
                src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    style={{
                      width: 110,
                      height: 165,
                      objectFit: 'cover',
                      borderRadius: 8,
                      opacity: i === 0 ? 1 : i === 1 ? 0.75 : 0.5,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
                    }}
                    alt=""
                  />
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Bottom border */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(232,197,71,0.15)', display: 'flex' }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
