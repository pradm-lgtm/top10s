import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// GET /api/topics/[slug]?sort=recent|reactions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const sort = new URL(req.url).searchParams.get('sort') ?? 'recent'
  const supabase = getAdminSupabase()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, title, category, cluster_id')
    .eq('slug', slug)
    .single()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // Fetch all lists for this topic (and same cluster if cluster_id exists)
  let listQuery = supabase
    .from('lists')
    .select('id, title, list_format, category, year, created_at, owner_id, profiles(id, username, display_name, avatar_url)')
    .eq('topic_id', topic.id)

  if (sort === 'recent') {
    listQuery = listQuery.order('created_at', { ascending: false })
  }

  const { data: lists } = await listQuery

  if (!lists || lists.length === 0) {
    return NextResponse.json({ topic, lists: [] })
  }

  const listIds = lists.map((l) => l.id)

  // Fetch top entries + reactions for each list
  const [{ data: topEntries }, { data: reactions }] = await Promise.all([
    supabase
      .from('list_entries')
      .select('id, list_id, title, rank, image_url')
      .in('list_id', listIds)
      .not('rank', 'is', null)
      .lte('rank', 5)
      .order('rank', { ascending: true }),
    supabase
      .from('reactions')
      .select('list_id, emoji')
      .in('list_id', listIds),
  ])

  const entryMap: Record<string, typeof topEntries> = {}
  for (const e of topEntries ?? []) {
    if (!entryMap[e.list_id]) entryMap[e.list_id] = []
    entryMap[e.list_id]!.push(e)
  }

  const reactionMap: Record<string, number> = {}
  for (const r of reactions ?? []) {
    reactionMap[r.list_id] = (reactionMap[r.list_id] ?? 0) + 1
  }

  let enrichedLists = lists.map((l) => ({
    ...l,
    entries: entryMap[l.id] ?? [],
    reactionCount: reactionMap[l.id] ?? 0,
    profiles: Array.isArray(l.profiles) ? l.profiles[0] ?? null : l.profiles,
  }))

  if (sort === 'reactions') {
    enrichedLists = enrichedLists.sort((a, b) => b.reactionCount - a.reactionCount)
  }

  return NextResponse.json({ topic, lists: enrichedLists })
}
