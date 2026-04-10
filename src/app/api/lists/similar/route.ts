import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'
import Anthropic from '@anthropic-ai/sdk'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const listId = searchParams.get('listId')
  if (!listId) return NextResponse.json([], { status: 400 })

  const supabase = getAdminSupabase()

  // Get the source list (including topic_id so we know if it needs one assigned)
  const { data: source } = await supabase
    .from('lists')
    .select('id, title, category, list_type, year, topic_id, topics(slug)')
    .eq('id', listId)
    .single()

  if (!source) return NextResponse.json([])

  // Build year filter: for annual lists within 1 year, for theme lists match "all time"
  let query = supabase
    .from('lists')
    .select('id, title, category, list_type, year, profiles(username, display_name, avatar_url)')
    .eq('category', source.category)
    .neq('id', listId)
    .limit(60)

  if (source.list_type === 'annual' && source.year) {
    query = query
      .eq('list_type', 'annual')
      .gte('year', source.year - 1)
      .lte('year', source.year + 1)
  } else {
    query = query.eq('list_type', 'theme')
  }

  const { data: candidates } = await query

  // Also get lists made via "Make your own version" of this one
  const { data: versions } = await supabase
    .from('lists')
    .select('id, title, category, list_type, year, profiles(username, display_name, avatar_url)')
    .eq('original_list_id', listId)
    .limit(10)

  const versionIds = new Set((versions ?? []).map((v) => v.id))
  const allCandidates = [
    ...(versions ?? []),
    ...(candidates ?? []).filter((c) => !versionIds.has(c.id)),
  ]

  if (allCandidates.length === 0) return NextResponse.json([])

  // Get entry counts for each candidate to show on cards
  const candidateIds = allCandidates.map((c) => c.id)
  const { data: entries } = await supabase
    .from('list_entries')
    .select('list_id, title')
    .in('list_id', candidateIds)

  const entryMap: Record<string, string[]> = {}
  for (const e of entries ?? []) {
    if (!entryMap[e.list_id]) entryMap[e.list_id] = []
    entryMap[e.list_id].push(e.title)
  }

  // Get source list entries for overlap calculation
  const { data: sourceEntries } = await supabase
    .from('list_entries')
    .select('title')
    .eq('list_id', listId)

  const sourceTitles = (sourceEntries ?? []).map((e) => e.title.toLowerCase())

  // Use Claude to find semantically similar lists (from candidates only, not version links)
  const nonVersionCandidates = allCandidates.filter((c) => !versionIds.has(c.id)).slice(0, 50)
  let similarIds: Set<string> = new Set()

  if (nonVersionCandidates.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const candidateList = nonVersionCandidates
        .map((c, i) => `${i}: "${c.title}"`)
        .join('\n')

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Source list: "${source.title}"\n\nCandidate lists:\n${candidateList}\n\nWhich candidates cover similar content to the source? Two lists are similar if they're about the same general topic/genre/era (e.g. "Best Comedies 2019" and "Funniest Movies 2019" are similar; "Best Dramas 2019" and "Best Comedies 2019" are not). Return ONLY a JSON array of the matching indexes (e.g. [0, 2, 5]). If none match, return [].`,
        }],
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      const indexes: number[] = JSON.parse(text)
      similarIds = new Set(indexes.map((i) => nonVersionCandidates[i]?.id).filter(Boolean))
    } catch {
      // Fall through — no Claude results
    }
  }

  // Combine: versions first, then similar-by-Claude
  const results = [
    ...allCandidates.filter((c) => versionIds.has(c.id)),
    ...allCandidates.filter((c) => similarIds.has(c.id)),
  ].slice(0, 4)

  // Ensure the source list has a topic assigned — find or create one from its title
  let topicSlug: string | null = Array.isArray(source.topics) ? source.topics[0]?.slug ?? null : (source.topics as { slug: string } | null)?.slug ?? null
  if (!topicSlug) {
    const slug = source.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 80)

    // Find or create topic
    const { data: existing } = await supabase.from('topics').select('id, slug').eq('slug', slug).single()
    let topicId: string
    if (existing) {
      topicId = existing.id
      topicSlug = existing.slug
    } else {
      const { data: created } = await supabase
        .from('topics')
        .insert({ slug, title: source.title.trim(), category: source.category })
        .select('id, slug')
        .single()
      topicId = created?.id ?? ''
      topicSlug = created?.slug ?? null
    }
    // Assign topic_id to this list
    if (topicId) {
      await supabase.from('lists').update({ topic_id: topicId }).eq('id', listId)
    }
  }

  return NextResponse.json({
    topicSlug,
    lists: results.map((c) => {
      const cEntries = entryMap[c.id] ?? []
      const overlap = cEntries.filter((t) => sourceTitles.includes(t.toLowerCase())).length
      const owner = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
      return {
        id: c.id,
        title: c.title,
        overlap,
        is_version: versionIds.has(c.id),
        owner: owner ?? null,
      }
    }),
  })
}
