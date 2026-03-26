import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const accent = '#e8c547'
const bg = '#0a0a0a'

// 3 posters side by side per list
const POSTER_W = 112
const POSTER_H = 168   // exact 2:3
const POSTER_GAP = 6
const POSTER_ROW_W = POSTER_W * 3 + POSTER_GAP * 2  // 348px

// Narrow center so posters get horizontal room
const CENTER_W = 200
const ROW_PAD = 36

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'RankedApp/1.0' } })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`
  } catch { return null }
}

async function tmdbPoster(title: string, category: string): Promise<string | null> {
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
    return hit?.poster_path ? `https://image.tmdb.org/t/p/w185${hit.poster_path}` : null
  } catch { return null }
}

function normalizeTitle(t: string) {
  return t.toLowerCase().replace(/^(the |a |an )/i, '').replace(/[^a-z0-9 ]/g, '').trim()
}

type Entry = { title: string; image_url: string | null }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id1 = searchParams.get('id1')
  const id2 = searchParams.get('id2')
  if (!id1 || !id2) return new Response('Missing ids', { status: 400 })

  const supabase = getAdminSupabase()

  // Fetch ALL entries (no limit) for accurate match count
  // Include source_label + owner_id for featured list name resolution
  const [r1, r2, e1res, e2res] = await Promise.all([
    supabase.from('lists').select('title, category, owner_id, source_label, profiles(username, display_name)').eq('id', id1).single(),
    supabase.from('lists').select('title, category, owner_id, source_label, profiles(username, display_name)').eq('id', id2).single(),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id1).order('rank', { ascending: true }),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id2).order('rank', { ascending: true }),
  ])

  if (!r1.data || !r2.data) return new Response('Not found', { status: 404 })

  const p1 = (Array.isArray(r1.data.profiles) ? r1.data.profiles[0] : r1.data.profiles) as { username: string; display_name: string | null } | null
  const p2 = (Array.isArray(r2.data.profiles) ? r2.data.profiles[0] : r2.data.profiles) as { username: string; display_name: string | null } | null

  // Fallback chain: display_name → source_label → list title (never null/"Someone")
  const name1 = p1?.display_name ?? r1.data.source_label ?? r1.data.title
  const name2 = p2?.display_name ?? r2.data.source_label ?? r2.data.title

  // Same-user: show list titles instead of "Prad vs Prad"
  const sameUser = !!(r1.data.owner_id && r2.data.owner_id && r1.data.owner_id === r2.data.owner_id)

  const allEntries1 = (e1res.data ?? []) as Entry[]
  const allEntries2 = (e2res.data ?? []) as Entry[]

  // Accurate match count using all entries
  const normSet1 = new Set(allEntries1.map(e => normalizeTitle(e.title)))
  const matchedTitles = allEntries2.filter(e => normSet1.has(normalizeTitle(e.title))).map(e => e.title)
  const matchCount = matchedTitles.length
  console.log(`[OG Compare] "${r1.data.title}" vs "${r2.data.title}" — ${matchCount} matches: ${matchedTitles.join(', ')}`)

  // Top 3 per list for poster display
  const top3_1 = allEntries1.slice(0, 3)
  const top3_2 = allEntries2.slice(0, 3)

  // Resolve + fetch poster images within budget
  const BUDGET = 3500
  const start = Date.now()

  const resolved = await Promise.race([
    Promise.all([
      ...top3_1.map(e => e.image_url ? Promise.resolve(e.image_url) : tmdbPoster(e.title, r1.data!.category)),
      ...top3_2.map(e => e.image_url ? Promise.resolve(e.image_url) : tmdbPoster(e.title, r2.data!.category)),
    ]),
    new Promise<null[]>(res => setTimeout(() => res(new Array(6).fill(null)), BUDGET)),
  ])

  const remaining = BUDGET - (Date.now() - start)
  const b64s = await Promise.race([
    Promise.all((resolved as (string | null)[]).map(u => u ? fetchAsBase64(u) : Promise.resolve(null))),
    new Promise<null[]>(res => setTimeout(() => res(new Array(6).fill(null)), Math.max(remaining, 400))),
  ])

  // [list1: p0, p1, p2] [list2: p0, p1, p2]
  const [p1a, p1b, p1c, p2a, p2b, p2c] = b64s as (string | null)[]

  // ── Poster slot ────────────────────────────────────────────────────────────
  function PosterSlot({ src }: { src: string | null }) {
    return (
      <div style={{
        width: POSTER_W, height: POSTER_H,
        borderRadius: 6, overflow: 'hidden',
        background: '#111122',
        display: 'flex',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        flexShrink: 0,
      }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ width: POSTER_W, height: POSTER_H, objectFit: 'cover' }} />
        )}
      </div>
    )
  }

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Gold accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, display: 'flex' }} />

        {/* Header: RANKED label */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px 0', flexShrink: 0 }}>
          <span style={{ color: accent, fontSize: 12, letterSpacing: 8, fontWeight: 700 }}>RANKED</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, letterSpacing: 3 }}>COMPARISON</span>
        </div>

        {/* ── Main content row ── */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: `0 ${ROW_PAD}px`, justifyContent: 'space-between' }}>

          {/* Left: 3 posters in a row, left-aligned */}
          <div style={{ display: 'flex', gap: POSTER_GAP, width: POSTER_ROW_W, flexShrink: 0, justifyContent: 'flex-start' }}>
            <PosterSlot src={p1a} />
            <PosterSlot src={p1b} />
            <PosterSlot src={p1c} />
          </div>

          {/* Center: names + count + list titles */}
          <div style={{ width: CENTER_W, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {sameUser ? (
              /* Same user: show list titles as heading */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 700, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{r1.data.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>vs.</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 700, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{r2.data.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>{name1}</span>
              </div>
            ) : (
              /* Different users: owner names */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: 600, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{name1}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>vs.</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: 600, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{name2}</span>
              </div>
            )}

            {/* Divider */}
            <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />

            {/* Overlap count */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ color: accent, fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{matchCount}</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' }}>in common</span>
            </div>

            {/* Divider */}
            <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.12)', display: 'flex' }} />

            {/* List titles */}
            {!sameUser && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{r1.data.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W - 8 }}>{r2.data.title}</span>
              </div>
            )}

          </div>

          {/* Right: 3 posters in a row, right-aligned */}
          <div style={{ display: 'flex', gap: POSTER_GAP, width: POSTER_ROW_W, flexShrink: 0, justifyContent: 'flex-end' }}>
            <PosterSlot src={p2a} />
            <PosterSlot src={p2b} />
            <PosterSlot src={p2c} />
          </div>

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 48px 16px', flexShrink: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, letterSpacing: 3 }}>rankedhq.app</span>
        </div>

      </div>
    ),
    { width: W, height: H }
  )
}
