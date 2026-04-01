import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

function titleCase(s: string) {
  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

async function getPostersForListIds(supabase: ReturnType<typeof import('@/lib/supabase-admin').getAdminSupabase>, listIds: string[]): Promise<string[]> {
  if (listIds.length === 0) return []
  const { data } = await supabase
    .from('list_entries')
    .select('image_url')
    .in('list_id', listIds)
    .not('image_url', 'is', null)
    .order('rank', { ascending: true })
    .limit(9)
  const seen = new Set<string>()
  const posters: string[] = []
  for (const e of data ?? []) {
    if (e.image_url && !seen.has(e.image_url)) {
      seen.add(e.image_url)
      posters.push(e.image_url)
    }
    if (posters.length === 3) break
  }
  return posters
}

// GET /api/search?q=...&full=true
// Returns: { topics, lists, profiles }
// full=true returns more results (for /search page); default is overlay-sized
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json({ topics: [], lists: [], profiles: [] })

  const full = req.nextUrl.searchParams.get('full') === 'true'
  const supabase = getAdminSupabase()

  const [topicsRes, listsRes, profilesRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, slug, title, category')
      .ilike('title', `%${q}%`)
      .limit(3),
    supabase
      .from('lists')
      .select('id, title, category, topic_id, profiles(username, display_name, avatar_url)')
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(full ? 20 : 8),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(full ? 10 : 4),
  ])

  const topicsRaw = topicsRes.data ?? []

  // Normalize profiles join (Supabase returns array for relations)
  const lists = (listsRes.data ?? []).map((l: Record<string, unknown>) => ({
    ...l,
    profiles: Array.isArray(l.profiles) ? (l.profiles[0] ?? null) : l.profiles,
  }))

  const profiles = profilesRes.data ?? []

  // Enrich topics: list count + top 3 poster images
  // Use both topic_id (exact) and title keyword match (fallback for pre-topic lists)
  const topics = await Promise.all(
    topicsRaw.map(async (topic) => {
      const [{ data: exactLists }, { data: titleLists }] = await Promise.all([
        supabase.from('lists').select('id').eq('topic_id', topic.id).limit(100),
        supabase.from('lists').select('id').ilike('title', `${topic.title}%`).is('topic_id', null).limit(50),
      ])

      const allIdSet = new Set([
        ...(exactLists ?? []).map((l) => l.id),
        ...(titleLists ?? []).map((l) => l.id),
      ])
      const allIds = [...allIdSet]
      const posters = await getPostersForListIds(supabase, allIds.slice(0, 5))

      return {
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        category: topic.category,
        listCount: allIds.length,
        posters,
        isImplicit: false,
      }
    })
  )

  // No matching topic but 3+ lists match — surface an implicit topic suggestion
  const finalTopics =
    topics.length === 0 && lists.length >= 3
      ? [
          {
            id: null as string | null,
            slug: toSlug(q),
            title: titleCase(q),
            category: 'any',
            listCount: lists.length,
            posters: await getPostersForListIds(supabase, lists.slice(0, 5).map((l: Record<string, unknown>) => l.id as string)),
            isImplicit: true,
          },
        ]
      : topics

  return NextResponse.json({ topics: finalTopics, lists, profiles })
}
