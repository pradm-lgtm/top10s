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
        system: 'You are a film/TV suggestion engine with deep knowledge of world cinema including Hollywood and international cinema (Bollywood, Korean, French, Japanese, etc.), actor and director filmographies, award winners, cult classics, and any era, genre, theme, or regional cinema. Anchor heavily to the original list context. Use the user\'s already-added titles to understand their taste. Never suggest titles the user has already added.',
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
      context ? `List description: "${context}"` : '',
      genre ? `Genre focus: ${genre}` : '',
      refineText ? `Specific request: "${refineText}"` : '',
      '',
      'Rules:',
      '- Return exact, real titles that exist',
      '- If a specific actor, director, region, or language is mentioned, return titles strictly from that filmography or region/language',
      '- For regional/language cinema (e.g. Bollywood, Korean, French, Japanese), return titles from that specific region and language',
      '- For actor/director queries, return films they actually appeared in or directed',
      '- For theme or award queries (e.g. Oscar winners, feel-good, based on true story), return titles that genuinely match',
      '- Include a mix of mainstream hits, critical favorites, and cult classics',
      '- No duplicates',
      '',
      'Return ONLY a JSON array of title strings, nothing else.',
      'Example: ["Title A", "Title B", "Title C"]',
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
      system: 'You are a film/TV suggestion engine with deep knowledge of world cinema. Generate relevant titles for any list context including:\n- Hollywood and international cinema (Bollywood, Korean, French, Japanese, etc.)\n- Actor and director filmographies\n- Award winners, cult classics, and mainstream hits\n- Any era, genre, theme, or regional cinema\n\nAlways return exact, well-known titles that exist and match the query. For non-English cinema, use the most commonly known title (English or original as appropriate).',
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
