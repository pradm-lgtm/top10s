import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

// POST /api/follow — follow a user
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { following_id } = await req.json()
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 })
  if (following_id === user.id) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const supabase = getAdminSupabase()

  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: user.id, following_id }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the person being followed
  await supabase.from('notifications').insert({
    user_id: following_id,
    type: 'new_follower',
    actor_id: user.id,
    list_id: null,
    comment_id: null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/follow — unfollow a user
export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { following_id } = await req.json()
  if (!following_id) return NextResponse.json({ error: 'following_id required' }, { status: 400 })

  const supabase = getAdminSupabase()
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', following_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
