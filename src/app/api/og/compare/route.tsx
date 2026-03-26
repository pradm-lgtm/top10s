import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const accent = '#e8c547'
const bg = '#0a0a0a'

// 3-poster fan stack dimensions
const STACK_W = 140
const STACK_H = 210   // 2:3
const STACK_OFFSET = 20   // each poster offset from the next
// Container must fit all 3 posters with their offsets
const STACK_CONTAINER_W = STACK_W + STACK_OFFSET * 2  // 180
const STACK_CONTAINER_H = STACK_H + STACK_OFFSET * 2  // 250

// Center column fixed width (keeps it narrow so posters get more space)
const CENTER_W = 380
// Main row horizontal padding
const ROW_PAD = 40

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

// Renders one poster slot — dark placeholder if no image
function Poster({ src, w, h }: { src: string | null; w: number; h: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 8, overflow: 'hidden', background: '#1a1a2e', display: 'flex' }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: w, height: h, objectFit: 'cover' }} />
      )}
    </div>
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id1 = searchParams.get('id1')
  const id2 = searchParams.get('id2')
  if (!id1 || !id2) return new Response('Missing ids', { status: 400 })

  const supabase = getAdminSupabase()

  // Fetch ALL entries for accurate match count; lists include source_label + owner_id
  const [r1, r2, e1res, e2res] = await Promise.all([
    supabase.from('lists').select('title, category, owner_id, source_label, profiles(username, display_name)').eq('id', id1).single(),
    supabase.from('lists').select('title, category, owner_id, source_label, profiles(username, display_name)').eq('id', id2).single(),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id1).order('rank', { ascending: true }),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id2).order('rank', { ascending: true }),
  ])

  if (!r1.data || !r2.data) return new Response('Not found', { status: 404 })

  const p1 = (Array.isArray(r1.data.profiles) ? r1.data.profiles[0] : r1.data.profiles) as { username: string; display_name: string | null } | null
  const p2 = (Array.isArray(r2.data.profiles) ? r2.data.profiles[0] : r2.data.profiles) as { username: string; display_name: string | null } | null

  // Fallback chain: display_name → source_label → list title (never "Someone" or null)
  const name1 = p1?.display_name ?? r1.data.source_label ?? r1.data.title
  const name2 = p2?.display_name ?? r2.data.source_label ?? r2.data.title

  // Same-user comparison — show list titles instead of "Prad vs Prad"
  const sameUser = !!(r1.data.owner_id && r2.data.owner_id && r1.data.owner_id === r2.data.owner_id)

  const allEntries1 = (e1res.data ?? []) as Entry[]
  const allEntries2 = (e2res.data ?? []) as Entry[]

  // Accurate match count using ALL entries from both lists
  const normSet1 = new Set(allEntries1.map(e => normalizeTitle(e.title)))
  const matchedTitles = allEntries2
    .filter(e => normSet1.has(normalizeTitle(e.title)))
    .map(e => e.title)
  const matchCount = matchedTitles.length
  console.log(`[OG Compare] "${r1.data.title}" vs "${r2.data.title}" — ${matchCount} matches: ${matchedTitles.join(', ')}`)

  // Top 3 entries for poster display
  const top3_1 = allEntries1.slice(0, 3)
  const top3_2 = allEntries2.slice(0, 3)

  // Resolve and fetch poster images with budget cap
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
    Promise.all((resolved as (string | null)[]).map(url => url ? fetchAsBase64(url) : Promise.resolve(null))),
    new Promise<null[]>(res => setTimeout(() => res(new Array(6).fill(null)), Math.max(remaining, 400))),
  ])

  // b64s order: [list1 front, list1 mid, list1 back, list2 front, list2 mid, list2 back]
  const [p1a, p1b, p1c, p2a, p2b, p2c] = b64s as (string | null)[]

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, display: 'flex' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px 0', flexShrink: 0 }}>
          <span style={{ color: accent, fontSize: 12, letterSpacing: 8, fontWeight: 700 }}>RANKED</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: 3, fontWeight: 600 }}>COMPARISON</span>
        </div>

        {/* Main content row */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: `0 ${ROW_PAD}px`, justifyContent: 'space-between' }}>

          {/* ── Left poster stack (front top-left, back cascades right+down) ── */}
          <div style={{ position: 'relative', width: STACK_CONTAINER_W, height: STACK_CONTAINER_H, flexShrink: 0, display: 'flex' }}>
            {/* Back */}
            <div style={{ position: 'absolute', top: STACK_OFFSET * 2, left: STACK_OFFSET * 2, display: 'flex', opacity: 0.55, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
              <Poster src={p1c} w={STACK_W} h={STACK_H} />
            </div>
            {/* Middle */}
            <div style={{ position: 'absolute', top: STACK_OFFSET, left: STACK_OFFSET, display: 'flex', opacity: 0.8, boxShadow: '0 4px 20px rgba(0,0,0,0.55)' }}>
              <Poster src={p1b} w={STACK_W} h={STACK_H} />
            </div>
            {/* Front */}
            <div style={{ position: 'absolute', top: 0, left: 0, display: 'flex', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
              <Poster src={p1a} w={STACK_W} h={STACK_H} />
            </div>
          </div>

          {/* ── Center ── */}
          <div style={{ width: CENTER_W, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>

            {sameUser ? (
              /* Same user: show list titles as heading */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: CENTER_W }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: (CENTER_W / 2) - 20 }}>{r1.data.title}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, flexShrink: 0 }}>vs.</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 17, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: (CENTER_W / 2) - 20 }}>{r2.data.title}</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{name1}</span>
              </div>
            ) : (
              /* Different users: show owner names */
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: CENTER_W }}>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: (CENTER_W / 2) - 20 }}>{name1}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 400, flexShrink: 0 }}>vs.</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: 700, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: (CENTER_W / 2) - 20 }}>{name2}</span>
              </div>
            )}

            {/* Overlap count */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ color: accent, fontSize: 64, fontWeight: 900, lineHeight: 1 }}>{matchCount}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>titles in common</span>
            </div>

            {/* List titles (non-same-user only) */}
            {!sameUser && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, maxWidth: CENTER_W }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W }}>{r1.data.title}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W }}>{r2.data.title}</span>
              </div>
            )}

          </div>

          {/* ── Right poster stack (front top-right, back cascades left+down) ── */}
          <div style={{ position: 'relative', width: STACK_CONTAINER_W, height: STACK_CONTAINER_H, flexShrink: 0, display: 'flex' }}>
            {/* Back */}
            <div style={{ position: 'absolute', top: STACK_OFFSET * 2, left: 0, display: 'flex', opacity: 0.55, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
              <Poster src={p2c} w={STACK_W} h={STACK_H} />
            </div>
            {/* Middle */}
            <div style={{ position: 'absolute', top: STACK_OFFSET, left: STACK_OFFSET, display: 'flex', opacity: 0.8, boxShadow: '0 4px 20px rgba(0,0,0,0.55)' }}>
              <Poster src={p2b} w={STACK_W} h={STACK_H} />
            </div>
            {/* Front */}
            <div style={{ position: 'absolute', top: 0, left: STACK_OFFSET * 2, display: 'flex', boxShadow: '0 8px 32px rgba(0,0,0,0.7)' }}>
              <Poster src={p2a} w={STACK_W} h={STACK_H} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 48px 16px', flexShrink: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, letterSpacing: 3 }}>rankedhq.app</span>
        </div>

      </div>
    ),
    { width: W, height: H }
  )
}
