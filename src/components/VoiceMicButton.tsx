'use client'

import { useEffect, useRef, useState } from 'react'

type MicState = 'idle' | 'recording' | 'transcribing' | 'error'

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void
}

export function VoiceMicButton({ onTranscript }: VoiceMicButtonProps) {
  const [state, setState] = useState<MicState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptRef = useRef('')
  const processingRef = useRef(false)

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition))
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (supported === null || !supported) return null

  async function cleanTranscript(raw: string): Promise<string> {
    try {
      const res = await fetch('/api/claude/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: raw }),
      })
      if (!res.ok) return raw
      const { cleaned } = await res.json()
      return cleaned || raw
    } catch { return raw }
  }

  async function processTranscript() {
    if (processingRef.current) return
    processingRef.current = true
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    const raw = transcriptRef.current.trim()
    if (!raw) {
      setState('error')
      setErrorMsg("Couldn't hear anything — try again")
      setTimeout(() => { setState('idle'); setErrorMsg(null) }, 3000)
      processingRef.current = false
      return
    }
    setState('transcribing')
    const cleaned = await cleanTranscript(raw)
    setState('idle')
    processingRef.current = false
    onTranscript(cleaned)
  }

  function stopRecording() {
    const r = recognitionRef.current
    if (!r) return
    recognitionRef.current = null // null first so onend is a no-op
    r.stop()
    processTranscript()
  }

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SpeechRec) return
    transcriptRef.current = ''
    processingRef.current = false
    const recognition = new SpeechRec()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcriptRef.current += (transcriptRef.current ? ' ' : '') + e.results[i][0].transcript
        }
      }
    }

    recognition.onerror = () => {
      if (recognitionRef.current) {
        recognitionRef.current = null
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
        setState('error')
        setErrorMsg("Couldn't hear anything — try again")
        setTimeout(() => { setState('idle'); setErrorMsg(null) }, 3000)
      }
    }

    recognition.onend = () => {
      // Browser auto-stopped (e.g. silence timeout) — process if we didn't manually stop
      if (recognitionRef.current) {
        recognitionRef.current = null
        processTranscript()
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('recording')
    timeoutRef.current = setTimeout(() => stopRecording(), 3 * 60 * 1000)
  }

  function handleClick() {
    if (state === 'recording') stopRecording()
    else if (state === 'idle') startRecording()
  }

  const label =
    state === 'recording' ? 'Recording…' :
    state === 'transcribing' ? 'Transcribing…' :
    state === 'error' ? errorMsg : null

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'transcribing'}
        title={
          state === 'recording' ? 'Tap to stop recording' :
          state === 'transcribing' ? 'Transcribing…' :
          'Voice note'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          cursor: state === 'transcribing' ? 'default' : 'pointer',
          background: state === 'recording' ? 'rgba(239,68,68,0.15)' : 'transparent',
          color: state === 'recording' ? '#ef4444' : state === 'error' ? '#ef4444' : 'var(--muted)',
          transition: 'background 0.2s, color 0.2s',
          flexShrink: 0,
          animation: state === 'recording' ? 'mic-pulse 1.5s ease-in-out infinite' : 'none',
          padding: 0,
        }}
      >
        {state === 'transcribing' ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="2" width="6" height="12" rx="3" fill={state === 'recording' ? 'rgba(239,68,68,0.3)' : 'none'} />
            <path d="M5 10a7 7 0 0 0 14 0" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12" y2="22" strokeLinecap="round" />
            <line x1="9" y1="22" x2="15" y2="22" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {label && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 8px',
          fontSize: 12,
          color: state === 'recording' ? '#ef4444' : 'var(--muted)',
          whiteSpace: 'nowrap',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {label}
        </div>
      )}
    </div>
  )
}
