import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await getAdminSupabase().auth.getUser(token)
  return user ?? null
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

// POST /api/topics/find-or-create
// Body: { title: string, category?: 'movies' | 'tv' | 'any' }
// Returns: { id, slug, title, category, created: boolean }
export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req)
  const { title, category = 'any' } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const supabase = getAdminSupabase()
  const slug = titleToSlug(title.trim())

  // Try to find existing topic by slug
  const { data: existing } = await supabase
    .from('topics')
    .select('id, slug, title, category')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({ ...existing, created: false })
  }

  // Create new topic
  const { data: created, error } = await supabase
    .from('topics')
    .insert({
      slug,
      title: title.trim(),
      category,
      created_by: user?.id ?? null,
    })
    .select('id, slug, title, category')
    .single()

  if (error || !created) {
    // Slug collision race — fetch the one that won
    const { data: raceWinner } = await supabase
      .from('topics')
      .select('id, slug, title, category')
      .eq('slug', slug)
      .single()
    if (raceWinner) return NextResponse.json({ ...raceWinner, created: false })
    return NextResponse.json({ error: error?.message ?? 'Failed to create topic' }, { status: 500 })
  }

  return NextResponse.json({ ...created, created: true })
}
