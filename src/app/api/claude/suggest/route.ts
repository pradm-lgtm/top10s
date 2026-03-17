import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { listTitle, category, year, context, genre, refineText, count = 20 } = await req.json()

    const catLabel = category === 'movies' ? 'movies' : 'TV shows'
    const lines = [
      `Generate exactly ${count} specific ${catLabel} for a top-10 list called "${listTitle}".`,
      year ? `Year: ${year} only.` : 'Scope: all time.',
      context ? `List vibe: "${context}"` : '',
      genre ? `Genre focus: ${genre}` : '',
      refineText ? `Refine request: "${refineText}"` : '',
      '',
      'Rules:',
      '- Be specific and use exact, well-known titles',
      '- Prioritize relevance to the list name and context above all',
      '- Include a mix of popular and critically acclaimed titles',
      '- No duplicates',
      '',
      'Return ONLY a JSON array of title strings, nothing else.',
      'Example: ["Title A", "Title B", "Title C"]',
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: lines }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ titles: [] })

    const titles = JSON.parse(match[0]) as string[]
    return NextResponse.json({ titles: Array.isArray(titles) ? titles.slice(0, count) : [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
