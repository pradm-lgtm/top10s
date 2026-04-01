import { notFound } from 'next/navigation'
import { getAdminSupabase } from '@/lib/supabase-admin'
import type { Metadata } from 'next'
import { TopicClient } from './TopicClient'

type TopicEntry = { id: string; list_id: string; title: string; rank: number | null; image_url: string | null }
type TopicList = {
  id: string
  title: string
  list_format: string
  category: string
  year: number | null
  created_at: string
  owner_id: string | null
  entries: TopicEntry[]
  reactionCount: number
  profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
}
type RelatedTopic = { id: string; slug: string; title: string }
type TopicData = {
  topic: { id: string; slug: string; title: string; category: string }
  lists: TopicList[]
  relatedTopics: RelatedTopic[]
}

async function getTopicData(slug: string): Promise<TopicData | null> {
  const supabase = getAdminSupabase()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, title, category, cluster_id')
    .eq('slug', slug)
    .single()

  if (!topic) return null

  const { data: lists } = await supabase
    .from('lists')
    .select('id, title, list_format, category, year, created_at, owner_id, profiles(id, username, display_name, avatar_url)')
    .eq('topic_id', topic.id)
    .order('created_at', { ascending: false })

  if (!lists) return { topic, lists: [], relatedTopics: [] }

  const listIds = lists.map((l) => l.id)
  if (listIds.length === 0) return { topic, lists: [], relatedTopics: [] }

  const [{ data: topEntries }, { data: reactions }] = await Promise.all([
    supabase
      .from('list_entries')
      .select('id, list_id, title, rank, image_url')
      .in('list_id', listIds)
      .not('rank', 'is', null)
      .order('rank', { ascending: true }),
    supabase.from('reactions').select('list_id').in('list_id', listIds),
  ])

  const entryMap: Record<string, TopicEntry[]> = {}
  for (const e of topEntries ?? []) {
    if (!entryMap[e.list_id]) entryMap[e.list_id] = []
    entryMap[e.list_id].push(e as TopicEntry)
  }

  const reactionMap: Record<string, number> = {}
  for (const r of reactions ?? []) {
    reactionMap[r.list_id] = (reactionMap[r.list_id] ?? 0) + 1
  }

  const enriched: TopicList[] = lists.map((l) => ({
    ...l,
    entries: entryMap[l.id] ?? [],
    reactionCount: reactionMap[l.id] ?? 0,
    profiles: (Array.isArray(l.profiles) ? l.profiles[0] : l.profiles) ?? null,
  }))

  // Related topics — same cluster
  let relatedTopics: RelatedTopic[] = []
  if (topic.cluster_id) {
    const { data: related } = await supabase
      .from('topics')
      .select('id, slug, title')
      .eq('cluster_id', topic.cluster_id)
      .neq('id', topic.id)
      .limit(6)
    relatedTopics = related ?? []
  }

  return { topic, lists: enriched, relatedTopics }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getTopicData(slug)
  if (!data) return { title: 'Topic — Ranked' }

  return {
    title: `${data.topic.title} — Ranked`,
    description: `${data.lists.length} people have ranked ${data.topic.title}. See how their lists compare.`,
  }
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getTopicData(slug)
  if (!data) notFound()

  return <TopicClient data={data} />
}
