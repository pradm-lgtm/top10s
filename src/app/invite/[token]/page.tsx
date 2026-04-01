import { notFound } from 'next/navigation'
import { getAdminSupabase } from '@/lib/supabase-admin'
import type { Metadata } from 'next'
import { InviteClient } from './InviteClient'

type InviteData = {
  id: string
  topic: { id: string; slug: string; title: string; category: string }
  sender: { username: string; display_name: string | null; avatar_url: string | null } | null
  senderList: {
    id: string; title: string
    list_format: string; category: string
    year: number | null; year_from: number | null; year_to: number | null
    entries: { title: string; image_url: string | null }[]
  } | null
  message: string | null
  accepted: boolean
}

async function getInvite(token: string): Promise<InviteData | null> {
  const supabase = getAdminSupabase()

  const { data: invite } = await supabase
    .from('invites')
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

  let sender: InviteData['sender'] = null
  if (invite.sender_id) {
    const { data: p } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', invite.sender_id)
      .single()
    sender = p ?? null
  }

  let senderList: InviteData['senderList'] = null
  if (invite.sender_list_id) {
    const { data: list } = await supabase.from('lists').select('id, title, list_format, category, year, year_from, year_to').eq('id', invite.sender_list_id).single()
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
  const invite = await getInvite(token)
  if (!invite) return { title: 'Invite — Ranked' }

  const senderName = invite.sender?.display_name ?? invite.sender?.username ?? 'Someone'
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rankedhq.app'
  const siteUrl = base.startsWith('http') ? base : `https://${base}`

  return {
    title: `${senderName} wants your take — Ranked`,
    description: `${senderName} wants to know your take on ${invite.topic.title}.`,
    openGraph: {
      title: `${senderName} wants your take on ${invite.topic.title}`,
      description: 'Share your ranked list on Ranked',
      images: [`${siteUrl}/api/og/invite?token=${token}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${senderName} wants your take on ${invite.topic.title}`,
      description: 'Share your ranked list on Ranked',
      images: [`${siteUrl}/api/og/invite?token=${token}`],
    },
  }
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getInvite(token)
  if (!invite) notFound()

  return <InviteClient invite={invite} token={token} />
}
