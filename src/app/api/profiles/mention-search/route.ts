import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

// GET /api/profiles/mention-search?q=prefix
// Returns up to 5 profiles whose username starts with the given prefix.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) return NextResponse.json([])

  const supabase = getAdminSupabase()
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', `${q}%`)
    .limit(5)

  return NextResponse.json(data ?? [])
}
