import { ImageResponse } from 'next/og'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const accent = '#e8c547'
const bg = '#0a0a0f'

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RankedApp/1.0' } })
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

// GET /api/og/challenge?token=[token]
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new Response('Missing token', { status: 400 })

  const supabase = getAdminSupabase()

  const { data: invite } = await supabase
    .from('challenge_invites')
    .select('topic_id, sender_id, sender_list_id, message')
    .eq('token', token)
    .single()

  if (!invite) return new Response('Not found', { status: 404 })

  const { data: topic } = await supabase
    .from('topics')
    .select('title')
    .eq('id', invite.topic_id)
    .single()

  let senderName = 'Someone'
  if (invite.sender_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', invite.sender_id)
      .single()
    senderName = profile?.display_name ?? profile?.username ?? 'Someone'
  }

  // Fetch up to 3 poster images from sender's list
  let posterB64s: (string | null)[] = []
  if (invite.sender_list_id) {
    const { data: entries } = await supabase
      .from('list_entries')
      .select('image_url')
      .eq('list_id', invite.sender_list_id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true })
      .limit(3)
    if (entries) {
      posterB64s = await Promise.all(
        entries.map((e) => (e.image_url ? fetchAsBase64(e.image_url) : Promise.resolve(null)))
      )
    }
  }

  const posters = posterB64s.filter(Boolean) as string[]

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: bg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Poster strip background */}
        {posters.length > 0 && (
          <div style={{ display: 'flex', position: 'absolute', top: 0, right: 0, bottom: 0, gap: 0 }}>
            {posters.map((src, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: i * 180,
                  width: 420,
                  height: H,
                  display: 'flex',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  style={{ width: 420, height: H, objectFit: 'cover', opacity: 0.18 - i * 0.04 }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Left-side dark gradient */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          background: 'linear-gradient(90deg, rgba(10,10,15,1) 45%, rgba(10,10,15,0.6) 100%)',
        }} />

        {/* Ranked logo */}
        <div style={{
          position: 'absolute', top: 44, left: 80, display: 'flex',
          fontWeight: 900, fontSize: 22, color: accent, letterSpacing: '0.2em',
        }}>
          RANKED
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640, position: 'relative' }}>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.55)', fontWeight: 400 }}>
            {senderName} challenged you to rank:
          </div>
          <div style={{
            display: 'flex', fontSize: 52, fontWeight: 800, color: '#fff',
            lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            {topic?.title ?? 'Their top list'}
          </div>
          {invite.message && (
            <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
              &ldquo;{invite.message}&rdquo;
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: accent, marginTop: 8 }}>
            Can you beat them? →
          </div>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
