import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation', 'Crime', 'Documentary']

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { mode } = body

    // ── inferGenre mode ─────────────────────────────────────────────────────
    if (mode === 'inferGenre') {
      const { category, addedEntries } = body
      const catLabel = category === 'movies' ? 'movie' : 'TV show'
      const prompt = [
        `Given these ${catLabel} titles: ${(addedEntries as string[]).join(', ')}`,
        '',
        `Return ONLY a single genre label from this list: ${VALID_GENRES.join(', ')}`,
        'If unclear, return the most likely genre. Return only the genre word, nothing else.',
      ].join('\n')

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
      const genre = VALID_GENRES.find(g => text.includes(g)) ?? ''
      return NextResponse.json({ genre })
    }

    // ── adaptive mode ───────────────────────────────────────────────────────
    if (mode === 'adaptive') {
      const { listTitle, category, yearFrom, yearTo, context, genre, addedEntries, currentSuggestions, count = 20 } = body
      const catLabel = category === 'movies' ? 'movies' : 'TV shows'

      const currentYear = new Date().getFullYear()
      const clampedYearTo = yearTo ? Math.min(yearTo as number, currentYear) : null
      const clampedYearFrom = yearFrom ?? null

      let yearLine = ''
      if (clampedYearFrom !== null && clampedYearTo !== null) {
        yearLine = clampedYearFrom === clampedYearTo
          ? `Year: ${clampedYearFrom} only.`
          : `Time period: ${clampedYearFrom}–${clampedYearTo}. Only include titles released within this range.`
      }

      const userMsg = [
        `List: "${listTitle}"`,
        context ? `Description: "${context}"` : '',
        genre ? `Genre: ${genre}` : '',
        yearLine,
        '',
        `Already added by the user: ${(addedEntries as string[]).join(', ')}`,
        '',
        (currentSuggestions as string[])?.length
          ? `Current suggestions shown (do NOT repeat any of these): ${(currentSuggestions as string[]).slice(0, 12).join(', ')}`
          : '',
        '',
        `Generate exactly ${count} fresh ${catLabel} that fit the list theme and complement what the user has already added.`,
        'Do NOT suggest any title already listed above.',
        '',
        'Return ONLY a JSON array of title strings, nothing else.',
        'Example: ["Title A", "Title B", "Title C"]',
      ].filter(Boolean).join('\n')

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: 'You are a film/TV suggestion engine. Anchor heavily to the original list context when making suggestions. The user is building a list and has already added some entries — use those to understand their taste. Never suggest titles the user has already added.',
        messages: [{ role: 'user', content: userMsg }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) return NextResponse.json({ titles: [] })
      const titles = JSON.parse(match[0]) as string[]
      return NextResponse.json({ titles: Array.isArray(titles) ? titles.slice(0, count) : [] })
    }

    // ── default (initial suggestions) mode ─────────────────────────────────
    const { listTitle, category, yearFrom, yearTo, context, genre, refineText, count = 20 } = body

    const catLabel = category === 'movies' ? 'movies' : 'TV shows'
    let yearLine = 'Scope: all time.'
    if (yearFrom !== null && yearTo !== null) {
      yearLine = yearFrom === yearTo
        ? `Year: ${yearFrom} only.`
        : `Time period: ${yearFrom}–${yearTo}. Only include titles released within this range.`
    }
    const lines = [
      `Generate exactly ${count} specific ${catLabel} for a top-10 list called "${listTitle}".`,
      yearLine,
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
