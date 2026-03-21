import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })

  try {
    const body = await req.formData()
    const audio = body.get('audio') as File | null
    if (!audio) return NextResponse.json({ error: 'No audio provided' }, { status: 400 })

    const form = new FormData()
    form.append('file', audio)
    form.append('model', 'whisper-1')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }

    const { text } = await res.json()
    return NextResponse.json({ transcript: text ?? '' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
