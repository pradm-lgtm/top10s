import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const { nps_score, suggestions } = await req.json()

  if (typeof nps_score !== 'number' || nps_score < 1 || nps_score > 10) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }

  // Get user if authenticated
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = getAdminSupabase()
  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    userId = user?.id ?? null
  }

  const { error } = await supabase.from('feedback').insert({
    nps_score,
    suggestions: suggestions ?? null,
    user_id: userId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
