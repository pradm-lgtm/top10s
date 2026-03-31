import { notFound } from 'next/navigation'
import { getAdminSupabase } from '@/lib/supabase-admin'
import type { Metadata } from 'next'
import { ChallengeClient } from './ChallengeClient'

type ChallengeData = {
  id: string
  topic: { id: string; slug: string; title: string; category: string }
  sender: { username: string; display_name: string | null; avatar_url: string | null } | null
  senderList: { id: string; title: string; entries: { title: string; image_url: string | null }[] } | null
  message: string | null
  accepted: boolean
}

async function getChallenge(token: string): Promise<ChallengeData | null> {
  const supabase = getAdminSupabase()

  const { data: invite } = await supabase
    .from('challenge_invites')
    .select('id, topic_id, sender_id, sender_list_id, message, accepted_at')
    .eq('token', token)
    .single()

  if (!invite) return null

  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, title, category')
    .eq('id', invite.topic_id)
    .single()

  if (!topic) return null

  let sender: ChallengeData['sender'] = null
  if (invite.sender_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', invite.sender_id)
      .single()
    sender = p ?? null
  }

  let senderList: ChallengeData['senderList'] = null
  if (invite.sender_list_id) {
    const { data: list } = await supabase.from('lists').select('id, title').eq('id', invite.sender_list_id).single()
    if (list) {
      const { data: entries } = await supabase
        .from('list_entries')
        .select('title, image_url')
        .eq('list_id', invite.sender_list_id)
        .not('rank', 'is', null)
        .order('rank', { ascending: true })
        .limit(3)
      senderList = { ...list, entries: entries ?? [] }
    }
  }

  return { id: invite.id, topic, sender, senderList, message: invite.message, accepted: !!invite.accepted_at }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const challenge = await getChallenge(token)
  if (!challenge) return { title: 'Challenge — Ranked' }

  const senderName = challenge.sender?.display_name ?? challenge.sender?.username ?? 'Someone'
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rankedhq.app'
  const siteUrl = base.startsWith('http') ? base : `https://${base}`

  return {
    title: `${senderName} challenged you — Ranked`,
    description: `Can you rank ${challenge.topic.title}? ${senderName} wants to see your list.`,
    openGraph: {
      title: `${senderName} challenged you to rank: ${challenge.topic.title}`,
      description: challenge.message ?? `Can you beat ${senderName}'s list?`,
      images: [`${siteUrl}/api/og/challenge?token=${token}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${senderName} challenged you to rank: ${challenge.topic.title}`,
      description: challenge.message ?? `Can you beat ${senderName}'s list?`,
      images: [`${siteUrl}/api/og/challenge?token=${token}`],
    },
  }
}

export default async function ChallengePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const challenge = await getChallenge(token)
  if (!challenge) notFound()

  return <ChallengeClient challenge={challenge} token={token} />
}
