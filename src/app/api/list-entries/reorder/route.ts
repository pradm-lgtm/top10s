import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

// POST /api/list-entries/reorder
// Body: { list_id: string, ordered_entry_ids: string[] }
// Updates ranks for entries based on their position in the provided array
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { list_id, ordered_entry_ids } = await req.json()
  if (!list_id || !Array.isArray(ordered_entry_ids)) {
    return NextResponse.json({ error: 'Missing list_id or ordered_entry_ids' }, { status: 400 })
  }

  const supabase = getAdminSupabase()

  // Verify the user owns the list
  const { data: list } = await supabase
    .from('lists')
    .select('id, owner_id')
    .eq('id', list_id)
    .eq('owner_id', user.id)
    .single()

  if (!list) return NextResponse.json({ error: 'List not found or not yours' }, { status: 404 })

  // Update each entry's rank based on its position
  const updates = ordered_entry_ids.map((id: string, i: number) =>
    supabase
      .from('list_entries')
      .update({ rank: i + 1 })
      .eq('id', id)
      .eq('list_id', list_id)
  )

  await Promise.all(updates)

  return NextResponse.json({ ok: true })
}
