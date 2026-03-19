import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { text, category } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const catLabel = category === 'movies' ? 'movie' : 'TV show'

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: `Extract entry titles from a list of ${catLabel}s.

CRITICAL RULES:
- For RANKED format: the title is ONLY the text on the same line as the number. "3. Uncut Gems" → title is "Uncut Gems". Everything after that line is description — ignore it.
- Do NOT extract ${catLabel} titles mentioned within description text as separate entries.
- Lines like "Watch It For:", "Watch It When:", "Where I Saw It:" are metadata — not titles.
- Do NOT include descriptions in your output at all — titles, tiers, and ranks only.

Detect format:
1. RANKED: numbered list (e.g. "1. Title", "2) Title")
2. TIERED: entries grouped under tier labels (S/A/B/C or custom like "Essential", "Great")
3. TIERED+RANKED: numbered entries within tier groups
4. PLAIN: one title per line, no numbering or tiers

Return ONLY this JSON object, nothing else:
{
  "format": "ranked" | "tiered" | "tiered-ranked" | "plain",
  "tiers": [],
  "entries": [{ "title": "...", "tier": "...", "rank": 1 }]
}`,
      messages: [{ role: 'user', content: text }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Handle truncated JSON gracefully: extract as many entries as possible
    let parsed: { format: string; tiers: string[]; entries: { title: string; description?: string; tier?: string; rank?: number }[] } | null = null
    const fullMatch = raw.match(/\{[\s\S]*\}/)
    if (fullMatch) {
      try {
        parsed = JSON.parse(fullMatch[0])
      } catch {
        // Try to salvage a truncated response by extracting complete entry objects
        const formatMatch = raw.match(/"format"\s*:\s*"([^"]+)"/)
        const detectedFormat = formatMatch ? formatMatch[1] : 'ranked'
        const tiersMatch = raw.match(/"tiers"\s*:\s*\[([^\]]*)\]/)
        const tiersRaw = tiersMatch ? tiersMatch[1] : ''
        const tierLabels = [...tiersRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1])

        // Extract complete entry objects — any that have at least a title
        const entryMatches = [...raw.matchAll(/\{\s*"title"\s*:\s*"([^"]+)"[^}]*\}/g)]
        const entries = entryMatches.map((m) => {
          try { return JSON.parse(m[0]) } catch { return { title: m[1] } }
        }).filter(Boolean)

        if (entries.length > 0) {
          parsed = { format: detectedFormat, tiers: tierLabels, entries }
        }
      }
    }

    if (!parsed || !Array.isArray(parsed?.entries) || parsed.entries.length === 0) {
      return NextResponse.json({ error: 'parse_failed' }, { status: 422 })
    }

    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
