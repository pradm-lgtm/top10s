import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

// GET /api/notifications — return enriched notifications for the current user
export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminSupabase()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: notifs } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!notifs || notifs.length === 0) return NextResponse.json([])

  const profileActorIds = notifs
    .filter((n) => ['new_follower', 'new_list_from_following'].includes(n.type) && n.actor_id)
    .map((n) => n.actor_id as string)

  const visitorActorIds = notifs
    .filter((n) => ['new_comment', 'new_reaction', 'mention'].includes(n.type) && n.actor_id)
    .map((n) => n.actor_id as string)

  const listIds = notifs.filter((n) => n.list_id).map((n) => n.list_id as string)

  const [profilesResult, visitorsResult, listsResult] = await Promise.all([
    profileActorIds.length > 0
      ? supabase.from('profiles').select('id, display_name, username').in('id', profileActorIds)
      : Promise.resolve({ data: [] }),
    visitorActorIds.length > 0
      ? supabase.from('visitors').select('id, name').in('id', visitorActorIds)
      : Promise.resolve({ data: [] }),
    listIds.length > 0
      ? supabase.from('lists').select('id, title').in('id', listIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = Object.fromEntries(
    (profilesResult.data ?? []).map((p) => [p.id, { name: p.display_name ?? p.username, username: p.username }])
  )
  const visitorMap = Object.fromEntries(
    (visitorsResult.data ?? []).map((v) => [v.id, v.name as string])
  )
  const listMap = Object.fromEntries(
    (listsResult.data ?? []).map((l) => [l.id, l.title as string])
  )

  const enriched = notifs.map((n) => ({
    ...n,
    actor_name: profileMap[n.actor_id]?.name ?? visitorMap[n.actor_id] ?? 'Someone',
    actor_username: profileMap[n.actor_id]?.username ?? null,
    list_title: n.list_id ? (listMap[n.list_id] ?? null) : null,
  }))

  return NextResponse.json(enriched)
}

// PATCH /api/notifications — mark all as read
export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminSupabase()
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  return NextResponse.json({ success: true })
}
