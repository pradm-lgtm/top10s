'use client'

import { useEffect, useRef, useState } from 'react'

type MicState = 'idle' | 'recording' | 'transcribing' | 'cleaning' | 'error'

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void
  onTranscriptCleanup?: (rawText: string, cleanedText: string) => void
}

export function VoiceMicButton({ onTranscript, onTranscriptCleanup }: VoiceMicButtonProps) {
  const [state, setState] = useState<MicState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    setSupported(!!(typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia))
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (supported === null || !supported) return null

  function showError(msg: string) {
    setState('error')
    setErrorMsg(msg)
    setTimeout(() => { setState('idle'); setErrorMsg(null) }, 4000)
  }

  async function processAudio(blob: Blob, mimeType: string) {
    setState('transcribing')
    let rawText = ''
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const formData = new FormData()
      formData.append('audio', blob, `recording.${ext}`)
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')
      const data = await res.json()
      rawText = data.transcript?.trim() ?? ''
    } catch {
      showError("Couldn't transcribe — try again")
      return
    }

    if (!rawText) {
      showError("Couldn't hear anything — try again")
      return
    }

    // Insert raw transcript immediately so user can start reading/editing
    onTranscript(rawText)
    setState('cleaning')

    // Claude cleanup runs in background — on success, swap raw for cleaned
    try {
      const cleanRes = await fetch('/api/claude/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: rawText }),
      })
      if (cleanRes.ok) {
        const { cleaned } = await cleanRes.json()
        if (cleaned && cleaned.trim() !== rawText.trim()) {
          onTranscriptCleanup?.(rawText, cleaned)
        }
      }
    } catch { /* fail silently — raw transcript already visible */ }

    setState('idle')
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ].find(t => MediaRecorder.isTypeSupported(t)) ?? ''

      chunksRef.current = []
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        processAudio(blob, mimeType || 'audio/webm')
      }

      recorderRef.current = recorder
      recorder.start(200)
      setState('recording')
      timeoutRef.current = setTimeout(() => stopRecording(), 3 * 60 * 1000)
    } catch (err) {
      const name = (err as DOMException).name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        showError('Microphone access needed — check browser settings')
      } else {
        showError("Couldn't start recording — try again")
      }
    }
  }

  function stopRecording() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
      recorderRef.current = null
    }
  }

  function handleClick() {
    if (state === 'recording') stopRecording()
    else if (state === 'idle') startRecording()
  }

  const isRecording = state === 'recording'
  const isBusy = state === 'transcribing' || state === 'cleaning'
  const label =
    state === 'recording' ? 'Recording…' :
    state === 'transcribing' ? 'Transcribing…' :
    state === 'cleaning' ? 'Cleaning up…' :
    state === 'error' ? errorMsg : null

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        title={
          isRecording ? 'Tap to stop recording' :
          state === 'transcribing' ? 'Transcribing…' :
          state === 'cleaning' ? 'Cleaning up…' :
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
          cursor: isBusy ? 'default' : 'pointer',
          background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
          color: isRecording ? '#ef4444' : state === 'error' ? '#ef4444' : 'var(--muted)',
          transition: 'background 0.2s, color 0.2s',
          flexShrink: 0,
          animation: isRecording ? 'mic-pulse 1.5s ease-in-out infinite' : 'none',
          padding: 0,
        }}
      >
        {isBusy ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="2" width="6" height="12" rx="3" fill={isRecording ? 'rgba(239,68,68,0.3)' : 'none'} />
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
          color: isRecording ? '#ef4444' : 'var(--muted)',
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
