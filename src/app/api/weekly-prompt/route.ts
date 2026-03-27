import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase-admin'
import Anthropic from '@anthropic-ai/sdk'

const PROMPTS = [
  "What are your top 5 TV shows?",
  "What are your top 5 TV comedies?",
  "What are your top 5 comfort watches?",
  "What are your top 5 films of the last decade?",
  "What are your top 5 shows you'd recommend to anyone?",
  "What are your top 5 movies that everyone should see?",
  "What are your top 5 underrated TV shows?",
  "What are your top 5 horror movies?",
  "What are your top 5 movies from the 90s?",
  "What are your top 5 shows currently airing?",
  "What are your top 5 movies that changed how you think about film?",
  "What are your top 5 TV dramas ever?",
]

async function fetchPosterForTitle(title: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY
  if (!apiKey) return null

  for (const type of ['movie', 'tv']) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(title)}&api_key=${apiKey}&page=1`
      )
      if (!res.ok) continue
      const data = await res.json()
      const best = ((data.results ?? []) as { poster_path?: string; vote_count: number }[])
        .filter((r) => r.poster_path)
        .sort((a, b) => b.vote_count - a.vote_count)[0]
      if (best?.poster_path) return `https://image.tmdb.org/t/p/w185${best.poster_path}`
    } catch {
      // continue to next type
    }
  }
  return null
}

// GET /api/weekly-prompt?week=<number>
// week defaults to current week. Pass a different week to get a different prompt (e.g. if user already created this week's).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const currentWeek = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const weekParam = searchParams.get('week')
  const weekNumber = weekParam ? parseInt(weekParam, 10) : currentWeek

  const promptText = PROMPTS[weekNumber % PROMPTS.length]
  const supabase = getAdminSupabase()

  // Return cached data if available
  const { data: cached } = await supabase
    .from('weekly_prompt_cache')
    .select('prompt_text, suggestions')
    .eq('week_number', weekNumber)
    .single()

  if (cached) {
    return NextResponse.json({ week_number: weekNumber, prompt_text: cached.prompt_text, suggestions: cached.suggestions })
  }

  // Generate suggestions via Claude Haiku
  let suggestions: { title: string; poster_url: string | null }[] = []

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Given the prompt "${promptText}", suggest exactly 5 well-known film or TV titles that would be great answers. Return ONLY a JSON array of strings, no explanation, no markdown. Example: ["The Wire", "Breaking Bad", "The Sopranos", "Succession", "Better Call Saul"]`,
        }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
      const titles: string[] = JSON.parse(text)

      suggestions = await Promise.all(
        titles.slice(0, 5).map(async (title) => ({
          title,
          poster_url: await fetchPosterForTitle(title),
        }))
      )
    } catch {
      // Claude failed — card will show without thumbnails
      suggestions = []
    }
  }

  // Cache in Supabase
  try {
    await supabase.from('weekly_prompt_cache').upsert(
      { week_number: weekNumber, prompt_text: promptText, suggestions },
      { onConflict: 'week_number' }
    )
  } catch {
    // Cache failure is non-fatal
  }

  return NextResponse.json({ week_number: weekNumber, prompt_text: promptText, suggestions })
}
