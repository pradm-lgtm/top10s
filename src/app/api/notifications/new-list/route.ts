import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

// POST /api/notifications/new-list — notify all followers that a new list was published
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { list_id } = await req.json()
  if (!list_id) return NextResponse.json({ error: 'list_id required' }, { status: 400 })

  const supabase = getAdminSupabase()

  const { data: follows } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', user.id)

  if (!follows || follows.length === 0) return NextResponse.json({ success: true })

  await supabase.from('notifications').insert(
    follows.map((f) => ({
      user_id: f.follower_id,
      type: 'new_list_from_following',
      actor_id: user.id,
      list_id,
      comment_id: null,
    }))
  )

  return NextResponse.json({ success: true })
}
