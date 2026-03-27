import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// GET /api/follow/status?userId=<id>
// Returns follow status + counts. Auth is optional — unauthenticated callers get following: false.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const supabase = getAdminSupabase()

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])

  let following = false
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user && user.id !== userId) {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle()
      following = !!data
    }
  }

  return NextResponse.json({
    following,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
  })
}
