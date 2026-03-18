import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user ?? null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, tierId } = await params
  const supabase = getAdminSupabase()

  const { data: list } = await supabase.from('lists').select('owner_id').eq('id', id).single()
  if (!list || list.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const allowed = ['label', 'color', 'position']
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  const { error } = await supabase.from('tiers').update(update).eq('id', tierId).eq('list_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tierId: string }> }
) {
  const user = await getAuthedUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, tierId } = await params
  const supabase = getAdminSupabase()

  const { data: list } = await supabase.from('lists').select('owner_id').eq('id', id).single()
  if (!list || list.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check no entries remain
  const { count } = await supabase
    .from('list_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tier_id', tierId)

  if (count && count > 0) {
    return NextResponse.json({ error: 'Tier still has entries' }, { status: 400 })
  }

  const { error } = await supabase.from('tiers').delete().eq('id', tierId).eq('list_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
