import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// POST /api/reactions — toggle a reaction; action: 'add' | 'remove'
export async function POST(req: NextRequest) {
  const { list_id, visitor_id, emoji, action } = await req.json()
  if (!list_id || !visitor_id || !emoji || !action) {
    return NextResponse.json({ error: 'list_id, visitor_id, emoji, and action are required' }, { status: 400 })
  }

  const supabase = getAdminSupabase()

  if (action === 'remove') {
    await supabase
      .from('reactions')
      .delete()
      .eq('list_id', list_id)
      .eq('visitor_id', visitor_id)
      .eq('emoji', emoji)
    return NextResponse.json({ success: true })
  }

  // action === 'add'
  const { error } = await supabase
    .from('reactions')
    .insert({ list_id, visitor_id, emoji })

  // Ignore duplicate — user already reacted with this emoji
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify list owner (only on new reactions, not duplicates)
  if (!error) {
    const { data: list } = await supabase
      .from('lists')
      .select('owner_id')
      .eq('id', list_id)
      .single()

    if (list?.owner_id) {
      await supabase.from('notifications').insert({
        user_id: list.owner_id,
        type: 'new_reaction',
        actor_id: visitor_id,
        list_id,
        comment_id: null,
      })
    }
  }

  return NextResponse.json({ success: true })
}
