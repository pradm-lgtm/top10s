import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { refineText, suggestions, category, year, context } = await req.json()

    const catLabel = category === 'movies' ? 'movies' : 'TV shows'
    const prompt = [
      `Reorder these ${catLabel} suggestions from most to least relevant to the user's request.`,
      year ? `Year scope: ${year}` : 'Scope: All-time',
      context ? `List context: ${context}` : '',
      '',
      `User request (use as-is — may reference an actor, director, region/language, theme, era, or any combination): "${refineText}"`,
      '',
      'Consider all natural language cues: actor/director names, regional cinema (Bollywood, Korean, French, etc.), languages, themes, awards, decades, and genres.',
      'Bring the most relevant titles to the top. Return ONLY a JSON array of IDs (integers), nothing else.',
      '',
      'Suggestions (id: title):',
      (suggestions as { id: number; title: string }[]).map((s) => `${s.id}: ${s.title}`).join('\n'),
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: 'You are a film/TV curator with deep knowledge of world cinema including Hollywood and international cinema (Bollywood, Korean, French, Japanese, etc.), actor and director filmographies, award winners, cult classics, and any era, genre, theme, or regional cinema.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const match = text.match(/\[[\d,\s]+\]/)
    if (!match) {
      return NextResponse.json({ orderedIds: (suggestions as { id: number }[]).map((s) => s.id) })
    }

    const orderedIds = JSON.parse(match[0]) as number[]
    return NextResponse.json({ orderedIds })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
