'use client'

import { useState, useRef, useEffect } from 'react'
import { useAdmin } from '@/context/admin'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
  multiline?: boolean
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  renderValue?: (value: string) => React.ReactNode
}

export function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder,
  className,
  style,
  renderValue,
}: Props) {
  const { isAdmin } = useAdmin()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  // Keep draft in sync if value changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  if (!isAdmin) {
    return renderValue ? (
      <>{renderValue(value)}</>
    ) : (
      <span className={className} style={style}>
        {value}
      </span>
    )
  }

  async function handleSave() {
    if (draft.trim() === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {multiline ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={placeholder}
            className="rounded px-2 py-1 text-sm resize-none outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--accent)',
              color: 'var(--foreground)',
              minWidth: '220px',
              width: '100%',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(value)
              }
            }}
          />
        ) : (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="rounded px-2 py-1 outline-none"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--accent)',
              color: 'var(--foreground)',
              minWidth: '160px',
              fontSize: 'inherit',
              fontWeight: 'inherit',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(value)
              }
            }}
          />
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 text-xs px-2 py-1 rounded font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#0a0a0f' }}
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={() => {
            setEditing(false)
            setDraft(value)
          }}
          className="shrink-0 text-xs px-2 py-1 rounded"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <span
      className={`${className ?? ''} group/edit inline-flex items-baseline gap-1 cursor-pointer`}
      style={style}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {renderValue ? renderValue(value) : value || (
        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{placeholder ?? 'Click to add…'}</span>
      )}
      <span
        className="opacity-0 group-hover/edit:opacity-60 transition-opacity text-xs shrink-0 ml-0.5"
        style={{ color: 'var(--accent)' }}
      >
        ✎
      </span>
    </span>
  )
}
