import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// GET /api/invites/[token]
// Returns invite details: topic, sender info, sender's list teaser (top 3)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getAdminSupabase()

  const { data: invite } = await supabase
    .from('invites')
    .select('id, topic_id, sender_id, sender_list_id, message, accepted_at')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, slug, title, category')
    .eq('id', invite.topic_id)
    .single()

  // Fetch sender profile
  let sender: { username: string; display_name: string | null; avatar_url: string | null } | null = null
  if (invite.sender_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', invite.sender_id)
      .single()
    sender = profile ?? null
  }

  // Fetch sender's list teaser (top 3 entries)
  let senderList: { id: string; title: string; entries: { title: string; image_url: string | null }[] } | null = null
  if (invite.sender_list_id) {
    const { data: list } = await supabase
      .from('lists')
      .select('id, title')
      .eq('id', invite.sender_list_id)
      .single()

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

  return NextResponse.json({
    id: invite.id,
    topic,
    sender,
    senderList,
    message: invite.message,
    accepted: !!invite.accepted_at,
  })
}

// PATCH /api/invites/[token] — mark as accepted
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getAdminSupabase()

  await supabase
    .from('invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null)

  return NextResponse.json({ ok: true })
}
