import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/admin-auth'

function normalizeTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function titlesMatch(listTitle: string, topicTitle: string): boolean {
  const nList = normalizeTitle(listTitle)
  const nTopic = normalizeTitle(topicTitle)
  return nList === nTopic || nList.startsWith(nTopic + ' ')
}

// GET /api/admin/backfill-topics?dry=true  — preview
// GET /api/admin/backfill-topics?dry=false — apply
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dry = req.nextUrl.searchParams.get('dry') !== 'false'
  const supabase = getAdminSupabase()

  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, slug, title')
    .order('title')

  if (topicsErr || !topics?.length) {
    return NextResponse.json({ error: topicsErr?.message ?? 'No topics found', assignments: [] })
  }

  const assignments: { topicId: string; topicTitle: string; listId: string; listTitle: string }[] = []

  for (const topic of topics) {
    const { data: candidates } = await supabase
      .from('lists')
      .select('id, title')
      .ilike('title', `${topic.title}%`)
      .is('topic_id', null)

    if (!candidates?.length) continue

    const matches = candidates.filter((l) => titlesMatch(l.title, topic.title))
    for (const list of matches) {
      assignments.push({ topicId: topic.id, topicTitle: topic.title, listId: list.id, listTitle: list.title })
    }

    if (!dry && matches.length > 0) {
      await supabase
        .from('lists')
        .update({ topic_id: topic.id })
        .in('id', matches.map((l) => l.id))
    }
  }

  return NextResponse.json({
    dry,
    assignmentCount: assignments.length,
    assignments,
    message: dry
      ? `Dry run: ${assignments.length} list(s) would be assigned. Add ?dry=false to apply.`
      : `Applied: ${assignments.length} list(s) assigned to topics.`,
  })
}
