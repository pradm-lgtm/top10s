import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// GET /api/follow/list?userId=<id>&type=followers|following
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const type = searchParams.get('type')
  if (!userId || !type) return NextResponse.json({ error: 'userId and type required' }, { status: 400 })

  const supabase = getAdminSupabase()

  if (type === 'followers') {
    const { data: follows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)

    const ids = (follows ?? []).map((f) => f.follower_id)
    if (ids.length === 0) return NextResponse.json([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ids)

    return NextResponse.json(profiles ?? [])
  } else {
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)

    const ids = (follows ?? []).map((f) => f.following_id)
    if (ids.length === 0) return NextResponse.json([])

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', ids)

    return NextResponse.json(profiles ?? [])
  }
}
