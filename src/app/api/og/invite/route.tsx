import { ImageResponse } from 'next/og'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const GOLD = '#f59e0b'
const LOGO_GOLD = '#e8c547'

// Strip common filler words from user-created list titles so TMDB search
// finds actual movies/TV.
// "My Best Miyazaki films"  → "Miyazaki"
// "Top 10 Horror Movies 80s" → "Horror 80s"
const STOP = new Set([
  'best', 'top', 'my', 'worst', 'favorite', 'favourite', 'all', 'time', 'ever',
  'great', 'good', 'most', 'underrated', 'overrated', 'ranked',
  'of', 'the', 'a', 'an', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by',
  'films', 'movies', 'shows', 'series', 'tv', 'picks', 'list', 'lists',
])

function extractKeywords(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
    .slice(0, 3)
  return words.length ? words.join(' ') : title
}

async function fetchTmdbPosterUrls(topicTitle: string, count: number): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey || apiKey === 'your-tmdb-api-key') return []

  const query = extractKeywords(topicTitle)
  console.log(`[og/invite] TMDB search: "${query}" (from "${topicTitle}")`)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&page=1`,
      { signal: controller.signal }
    )
    clearTimeout(timer)
    if (!res.ok) {
      console.log(`[og/invite] TMDB ${res.status}`)
      return []
    }
    const data = await res.json()
    const urls = (data.results ?? [])
      .filter(
        (r: Record<string, unknown>) =>
          r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv')
      )
      .slice(0, count)
      .map(
        (r: Record<string, unknown>) =>
          `https://image.tmdb.org/t/p/w342${r.poster_path as string}`
      )
    console.log(`[og/invite] TMDB returned ${urls.length} poster URLs`)
    return urls
  } catch (e) {
    console.log('[og/invite] TMDB error:', (e as Error).message)
    return []
  }
}

// GET /api/og/invite?token=[token]
export async function GET(req: Request) {
  const start = Date.now()
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

  // Fetch topic + sender in parallel
  const [topicRes, senderRes] = await Promise.all([
    supabase.from('topics').select('title, category').eq('id', invite.topic_id).single(),
    invite.sender_id
      ? supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', invite.sender_id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const topic = topicRes.data
  const senderProfile = senderRes.data
  const senderName = senderProfile?.display_name ?? senderProfile?.username ?? 'Someone'

  console.log(`[og/invite] topic="${topic?.title}" sender="${senderName}"`)

  // Always use TMDB search for posters — never pull from the sender's list,
  // as that would reveal their picks before the recipient has made their own list.
  const posterUrls = topic?.title ? await fetchTmdbPosterUrls(topic.title, 6) : []

  console.log(`[og/invite] total posters: ${posterUrls.length} (${Date.now() - start}ms)`)

  // Pass URLs directly to Satori — no base64 needed, Satori fetches externals natively.
  // This avoids base64 encoding failures and is faster.
  const posters = posterUrls

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
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              display: 'flex',
            }}
          >
            {posters.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" style={{ flex: 1, height: H, objectFit: 'cover' }} />
            ))}
          </div>
        ) : (
          /* Cinematic gradient fallback — visible purple-to-blue tones */
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              display: 'flex',
              background: 'linear-gradient(135deg, #2d0a3e 0%, #0d1535 50%, #0a2210 100%)',
            }}
          />
        )}

        {/* Dark overlay for text legibility */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            background: 'rgba(0,0,0,0.68)',
          }}
        />

        {/* Vignette */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.45) 100%)',
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
          {senderProfile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={senderProfile.avatar_url}
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
          <span
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 500,
              display: 'flex',
            }}
          >
            {senderName}
          </span>
        </div>

        {/* Topic title + CTA — centered */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
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
