'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import type { TiptapDoc } from '@/lib/notes'

interface RichTextEditorProps {
  value?: TiptapDoc | string | null
  onChange: (doc: TiptapDoc) => void
  placeholder?: string
  autoFocus?: boolean
  minHeight?: number
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a note…',
  autoFocus = false,
  minHeight = 72,
}: RichTextEditorProps) {
  const [focused, setFocused] = useState(false)
  const initialized = useRef(false)

  const initialContent: TiptapDoc =
    value && typeof value === 'object' && value.type === 'doc'
      ? value
      : { type: 'doc', content: [{ type: 'paragraph', content: typeof value === 'string' && value ? [{ type: 'text', text: value }] : [] }] }

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    immediatelyRender: false,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: 'rich-editor-inner',
        style: `min-height:${minHeight}px; outline:none; padding:8px 10px; color:var(--foreground); font-size:14px; line-height:1.6;`,
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getJSON() as TiptapDoc)
    },
    onFocus() { setFocused(true) },
    onBlur() { setFocused(false) },
  })

  // Sync external value changes (e.g. when parent resets the form)
  useEffect(() => {
    if (!editor) return
    if (!initialized.current) { initialized.current = true; return }
    if (!value) {
      editor.commands.clearContent()
      return
    }
    if (typeof value === 'object' && value.type === 'doc') {
      const current = JSON.stringify(editor.getJSON())
      const next = JSON.stringify(value)
      if (current !== next) {
        editor.commands.setContent(value)
      }
    }
  }, [editor, value])

  function toolbarButton(
    label: string,
    action: () => void,
    active: boolean,
    title?: string
  ) {
    return (
      <button
        key={label}
        type="button"
        title={title ?? label}
        onMouseDown={(e) => { e.preventDefault(); action() }}
        style={{
          fontWeight: active ? 700 : 400,
          color: active ? 'var(--accent)' : 'var(--muted)',
          background: active ? 'rgba(232,197,71,0.15)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 6px',
          fontSize: 13,
          lineHeight: 1,
          borderRadius: 4,
          transition: 'color 0.12s, background 0.12s',
        }}
      >
        {label}
      </button>
    )
  }

  const toolbarVisible = focused

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface-2)',
        transition: 'border-color 0.15s',
        borderColor: focused ? 'var(--accent)' : 'var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          height: toolbarVisible ? 36 : 0,
          overflow: 'hidden',
          transition: 'height 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: toolbarVisible ? '0 6px' : 0,
          borderBottom: toolbarVisible ? '1px solid var(--border)' : 'none',
          background: 'var(--surface)',
        }}
      >
        {editor && (
          <>
            {toolbarButton('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), 'Bold')}
            {toolbarButton('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), 'Italic')}
            {toolbarButton('•—', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), 'Bullet list')}
            {toolbarButton('1.', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), 'Numbered list')}
          </>
        )}
      </div>

      {/* Editor area with placeholder */}
      <div style={{ position: 'relative' }}>
        {editor && editor.isEmpty && !focused && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 10,
              fontSize: 14,
              color: 'var(--muted)',
              opacity: 0.5,
              pointerEvents: 'none',
              lineHeight: 1.6,
            }}
          >
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
