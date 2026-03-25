import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = req.nextUrl.searchParams.get('category') ?? null

  const supabase = getAdminSupabase()

  let query = supabase
    .from('lists')
    .select('id, title, year, category, list_type, owner_id, profiles(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
