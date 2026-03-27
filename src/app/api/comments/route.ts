import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// POST /api/comments — create a comment and notify the list owner
export async function POST(req: NextRequest) {
  const { list_id, visitor_id, content } = await req.json()
  if (!list_id || !visitor_id || !content?.trim()) {
    return NextResponse.json({ error: 'list_id, visitor_id, and content are required' }, { status: 400 })
  }

  const supabase = getAdminSupabase()

  const { data: comment, error } = await supabase
    .from('comments')
    .insert({ list_id, visitor_id, content: content.trim() })
    .select('*, visitors(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify list owner
  const { data: list } = await supabase
    .from('lists')
    .select('owner_id')
    .eq('id', list_id)
    .single()

  if (list?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: list.owner_id,
      type: 'new_comment',
      actor_id: visitor_id,
      list_id,
      comment_id: comment.id,
    })
  }

  return NextResponse.json(comment)
}
