import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await getAdminSupabase().auth.getUser(token)
  return user ?? null
}

// POST /api/invites/create
// Body: { topic_id: string, message?: string, sender_list_id?: string }
// Returns: { token, url }
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  const { topic_id, message, sender_list_id } = await req.json()
  if (!topic_id) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const supabase = getAdminSupabase()

  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      topic_id,
      sender_id: user?.id ?? null,
      sender_list_id: sender_list_id ?? null,
      message: message?.trim() || null,
    })
    .select('token')
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create invite' }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rankedhq.app'
  const url = `${base.startsWith('http') ? base : `https://${base}`}/invite/${invite.token}`

  return NextResponse.json({ token: invite.token, url })
}
