import { ImageResponse } from 'next/og'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const GOLD = '#f59e0b'
const LOGO_GOLD = '#e8c547'

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

async function fetchTmdbPosterUrls(topicTitle: string, count: number): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || apiKey === 'your-tmdb-api-key') return []
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(topicTitle)}&api_key=${apiKey}&page=1`,
      { signal: controller.signal }
    )
    clearTimeout(timer)
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? [])
      .filter((r: Record<string, unknown>) => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv'))
      .slice(0, count)
      .map((r: Record<string, unknown>) => `https://image.tmdb.org/t/p/w342${r.poster_path as string}`)
  } catch {
    return []
  }
}

// GET /api/og/invite?token=[token]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new Response('Missing token', { status: 400 })

  const supabase = getAdminSupabase()

  const { data: invite } = await supabase
    .from('invites')
    .select('topic_id, sender_id, sender_list_id, message')
    .eq('token', token)
    .single()

  if (!invite) return new Response('Not found', { status: 404 })

  // Fetch topic and sender profile in parallel
  const [topicRes, senderRes] = await Promise.all([
    supabase.from('topics').select('title, category').eq('id', invite.topic_id).single(),
    invite.sender_id
      ? supabase.from('profiles').select('display_name, username, avatar_url').eq('id', invite.sender_id).single()
      : Promise.resolve({ data: null }),
  ])

  const topic = topicRes.data
  const senderProfile = senderRes.data
  const senderName = senderProfile?.display_name ?? senderProfile?.username ?? 'Someone'

  // Collect poster image URLs: sender's list first, then TMDB for the topic
  let posterUrls: string[] = []
  if (invite.sender_list_id) {
    const { data: entries } = await supabase
      .from('list_entries')
      .select('image_url')
      .eq('list_id', invite.sender_list_id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })
      .limit(6)
    posterUrls = (entries ?? []).map((e) => e.image_url).filter(Boolean) as string[]
  }

  // Supplement with TMDB if not enough from sender's list
  if (posterUrls.length < 4 && topic?.title) {
    const tmdbUrls = await fetchTmdbPosterUrls(topic.title, 6 - posterUrls.length)
    posterUrls = [...posterUrls, ...tmdbUrls].slice(0, 6)
  }

  // Fetch everything as base64 in parallel
  const [posterB64s, senderAvatarB64] = await Promise.all([
    Promise.all(posterUrls.map(fetchAsBase64)),
    senderProfile?.avatar_url ? fetchAsBase64(senderProfile.avatar_url) : Promise.resolve(null),
  ])

  const posters = posterB64s.filter(Boolean) as string[]

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          position: 'relative',
          background: '#0a0a0f',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Poster grid — full bleed background */}
        {posters.length > 0 ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            {posters.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" style={{ flex: 1, height: H, objectFit: 'cover' }} />
            ))}
          </div>
        ) : (
          /* Cinematic gradient fallback when no posters */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              background: 'linear-gradient(135deg, #1a0520 0%, #0d0d1a 50%, #0a1a0a 100%)',
            }}
          />
        )}

        {/* Dark overlay for text legibility */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'rgba(0,0,0,0.72)' }} />

        {/* Vignette for cinematic depth */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)',
          }}
        />

        {/* Sender — top left */}
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 80,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {senderAvatarB64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={senderAvatarB64}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: LOGO_GOLD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 800,
                color: '#0a0a0f',
              }}
            >
              {senderName[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', fontWeight: 500, display: 'flex' }}>
            {senderName}
          </span>
        </div>

        {/* Topic title + CTA — centered */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
              textAlign: 'center',
              display: 'flex',
              maxWidth: 960,
            }}
          >
            {topic?.title ?? 'Share your take'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: GOLD, display: 'flex' }}>
            Share your take →
          </div>
        </div>

        {/* Ranked logo — bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            right: 80,
            display: 'flex',
            fontSize: 18,
            fontWeight: 900,
            color: LOGO_GOLD,
            letterSpacing: '0.2em',
          }}
        >
          RANKED
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
