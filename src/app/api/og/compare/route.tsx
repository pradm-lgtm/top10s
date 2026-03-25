import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const W = 1200
const H = 630
const accent = '#e8c547'
const bg = '#0a0a0a'

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id1 = searchParams.get('id1')
  const id2 = searchParams.get('id2')
  if (!id1 || !id2) return new Response('Missing ids', { status: 400 })

  const supabase = getAdminSupabase()

  const [r1, r2, e1, e2] = await Promise.all([
    supabase.from('lists').select('title, category, profiles(username, display_name)').eq('id', id1).single(),
    supabase.from('lists').select('title, category, profiles(username, display_name)').eq('id', id2).single(),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id1).order('rank', { ascending: true }).limit(3),
    supabase.from('list_entries').select('title, image_url').eq('list_id', id2).order('rank', { ascending: true }).limit(3),
  ])

  if (!r1.data || !r2.data) return new Response('Not found', { status: 404 })

  const p1 = (Array.isArray(r1.data.profiles) ? r1.data.profiles[0] : r1.data.profiles) as { username: string; display_name: string | null } | null
  const p2 = (Array.isArray(r2.data.profiles) ? r2.data.profiles[0] : r2.data.profiles) as { username: string; display_name: string | null } | null
  const name1 = p1?.display_name ?? p1?.username ?? 'List 1'
  const name2 = p2?.display_name ?? p2?.username ?? 'List 2'

  const entries1 = (e1.data ?? []) as { title: string; image_url: string | null }[]
  const entries2 = (e2.data ?? []) as { title: string; image_url: string | null }[]

  // Match count
  const norm1 = new Set(entries1.map(e => normalizeTitle(e.title)))
  // We only have top 3 entries here so this is approximate — good enough for the card
  const matchCount = entries2.filter(e => norm1.has(normalizeTitle(e.title))).length

  // Resolve poster URLs
  const BUDGET = 3500
  const start = Date.now()

  const resolvedUrls = await Promise.race([
    Promise.all([
      ...entries1.slice(0, 2).map(e => e.image_url ? Promise.resolve(e.image_url) : tmdbPoster(e.title, r1.data!.category)),
      ...entries2.slice(0, 2).map(e => e.image_url ? Promise.resolve(e.image_url) : tmdbPoster(e.title, r2.data!.category)),
    ]),
    new Promise<null[]>(res => setTimeout(() => res([null, null, null, null]), BUDGET)),
  ])

  const remaining = BUDGET - (Date.now() - start)
  const base64s = await Promise.race([
    Promise.all((resolvedUrls as (string | null)[]).map(url => url ? fetchAsBase64(url) : Promise.resolve(null))),
    new Promise<null[]>(res => setTimeout(() => res([null, null, null, null]), Math.max(remaining, 400))),
  ])

  // base64s: [list1poster0, list1poster1, list2poster0, list2poster1]
  const [p1a, p1b, p2a, p2b] = base64s as (string | null)[]

  // Layout constants
  const STACK_W = 160
  const STACK_H = 240  // 2:3
  const STACK_OFFSET = 12
  const STACK_AREA_W = STACK_W + STACK_OFFSET
  const PAD = 70
  const CENTER_W = W - 2 * (PAD + STACK_AREA_W + 24)

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, display: 'flex' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 56px 0', flexShrink: 0 }}>
          <span style={{ color: accent, fontSize: 12, letterSpacing: 8, fontWeight: 700 }}>RANKED</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 3, fontWeight: 600 }}>COMPARISON</span>
        </div>

        {/* Main content row */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: `0 ${PAD}px`, gap: 0 }}>

          {/* Left stack — list 1 */}
          <div style={{ position: 'relative', width: STACK_AREA_W + 16, height: STACK_H + STACK_OFFSET, flexShrink: 0 }}>
            {/* Back poster (offset) */}
            <div style={{
              position: 'absolute', top: STACK_OFFSET, left: STACK_OFFSET,
              width: STACK_W, height: STACK_H, borderRadius: 8, overflow: 'hidden',
              background: '#1a1a2e', display: 'flex',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
              opacity: 0.7,
            }}>
              {p1b && <img src={p1b} alt="" style={{ width: STACK_W, height: STACK_H, objectFit: 'cover' }} />}
            </div>
            {/* Front poster */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: STACK_W, height: STACK_H, borderRadius: 8, overflow: 'hidden',
              background: '#1a1a2e', display: 'flex',
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            }}>
              {p1a && <img src={p1a} alt="" style={{ width: STACK_W, height: STACK_H, objectFit: 'cover' }} />}
            </div>
          </div>

          {/* Center: owner names + overlap count */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* vs row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, textAlign: 'right', maxWidth: (CENTER_W / 2) - 24, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name1}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 400, flexShrink: 0 }}>vs.</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 600, textAlign: 'left', maxWidth: (CENTER_W / 2) - 24, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name2}</span>
            </div>

            {/* Big overlap number */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ color: accent, fontSize: 64, fontWeight: 800, lineHeight: 1 }}>{matchCount}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' }}>titles in common</span>
            </div>

            {/* List titles */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: CENTER_W }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W }}>{r1.data!.title}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: CENTER_W }}>{r2.data!.title}</span>
            </div>
          </div>

          {/* Right stack — list 2 */}
          <div style={{ position: 'relative', width: STACK_AREA_W + 16, height: STACK_H + STACK_OFFSET, flexShrink: 0 }}>
            {/* Back poster */}
            <div style={{
              position: 'absolute', top: STACK_OFFSET, left: 0,
              width: STACK_W, height: STACK_H, borderRadius: 8, overflow: 'hidden',
              background: '#1a1a2e', display: 'flex',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
              opacity: 0.7,
            }}>
              {p2b && <img src={p2b} alt="" style={{ width: STACK_W, height: STACK_H, objectFit: 'cover' }} />}
            </div>
            {/* Front poster */}
            <div style={{
              position: 'absolute', top: 0, left: STACK_OFFSET,
              width: STACK_W, height: STACK_H, borderRadius: 8, overflow: 'hidden',
              background: '#1a1a2e', display: 'flex',
              boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            }}>
              {p2a && <img src={p2a} alt="" style={{ width: STACK_W, height: STACK_H, objectFit: 'cover' }} />}
            </div>
          </div>

        </div>

        {/* Bottom border */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex' }} />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 56px', flexShrink: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: 3 }}>rankedhq.app</span>
        </div>
      </div>
    ),
    { width: W, height: H }
  )
}
