import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g) ?? []
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]
}

// POST /api/comments — create a comment and notify the list owner + any @mentioned users
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

  // Notify @mentioned users (skip list owner — already notified above)
  const mentionedUsernames = extractMentions(content.trim())
  if (mentionedUsernames.length > 0) {
    const { data: mentionedProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('username', mentionedUsernames)

    if (mentionedProfiles?.length) {
      const mentionNotifs = mentionedProfiles
        .filter((p) => p.id !== list?.owner_id)
        .map((p) => ({
          user_id: p.id,
          type: 'mention',
          actor_id: visitor_id,
          list_id,
          comment_id: comment.id,
        }))
      if (mentionNotifs.length > 0) {
        await supabase.from('notifications').insert(mentionNotifs)
      }
    }
  }

  return NextResponse.json(comment)
}
