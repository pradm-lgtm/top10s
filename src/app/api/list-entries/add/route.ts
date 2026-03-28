import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

// POST /api/list-entries/add
// Appends an entry to the bottom of one of the user's lists
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { list_id, title, image_url, tier_id } = await req.json()
  if (!list_id || !title) return NextResponse.json({ error: 'Missing list_id or title' }, { status: 400 })

  const supabase = getAdminSupabase()

  // Verify the user owns the target list
  const { data: list } = await supabase
    .from('lists')
    .select('id, list_format, owner_id')
    .eq('id', list_id)
    .eq('owner_id', user.id)
    .single()

  if (!list) return NextResponse.json({ error: 'List not found or not yours' }, { status: 404 })

  // Find the next rank (append to bottom)
  const { data: lastEntry } = await supabase
    .from('list_entries')
    .select('rank')
    .eq('list_id', list_id)
    .not('rank', 'is', null)
    .order('rank', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextRank = (lastEntry?.rank ?? 0) + 1

  const insertPayload: Record<string, unknown> = {
    list_id,
    title,
    image_url: image_url ?? null,
    rank: list.list_format === 'tiered' ? null : nextRank,
  }

  if (tier_id) {
    insertPayload.tier_id = tier_id
  }

  const { data: entry, error } = await supabase
    .from('list_entries')
    .insert(insertPayload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(entry)
}
