import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }
  try {
    const { transcript } = await req.json()
    if (!transcript?.trim()) return NextResponse.json({ cleaned: '' })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are cleaning up a voice transcription for a movie/TV review or commentary. Clean up the following transcript:
- Remove filler words (uh, um, like, you know, basically, literally)
- Fix run-on sentences into proper paragraphs
- Correct obvious speech-to-text errors in the context of film/TV (e.g. 'the dark night' → 'The Dark Knight')
- Preserve the person's voice and opinion — don't rewrite or add content, just clean up
- Keep it concise — remove repetition
- Return only the cleaned text, nothing else`,
      messages: [{ role: 'user', content: transcript.trim() }],
    })

    const cleaned = response.content[0].type === 'text' ? response.content[0].text.trim() : transcript
    return NextResponse.json({ cleaned })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
