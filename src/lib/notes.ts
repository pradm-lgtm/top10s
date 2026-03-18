/**
 * Utilities for handling entry notes that may be plain text or Tiptap JSON.
 */

export type TiptapDoc = {
  type: 'doc'
  content: TiptapNode[]
}

type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: { type: string }[]
  text?: string
}

/**
 * Parses a notes value — returns a TiptapDoc if it's JSON, or null if it's plain text.
 */
export function parseNotes(value: string | null | undefined): TiptapDoc | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed?.type === 'doc' && Array.isArray(parsed?.content)) {
      return parsed as TiptapDoc
    }
    return null
  } catch {
    return null
  }
}

/**
 * Renders a TiptapNode tree to an HTML string.
 */
function renderNode(node: TiptapNode): string {
  if (node.type === 'text') {
    let text = escapeHtml(node.text ?? '')
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`
        if (mark.type === 'italic') text = `<em>${text}</em>`
      }
    }
    return text
  }

  const children = (node.content ?? []).map(renderNode).join('')

  switch (node.type) {
    case 'doc': return children
    case 'paragraph': return children ? `<p>${children}</p>` : ''
    case 'bulletList': return `<ul>${children}</ul>`
    case 'orderedList': return `<ol>${children}</ol>`
    case 'listItem': return `<li>${children}</li>`
    case 'hardBreak': return '<br>'
    default: return children
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Converts a TiptapDoc to an HTML string for display.
 */
export function tiptapToHtml(doc: TiptapDoc): string {
  return renderNode(doc)
}

/**
 * Returns the plain-text content of a notes value (for length checks).
 */
export function notesToPlainText(value: string | null | undefined): string {
  if (!value) return ''
  const doc = parseNotes(value)
  if (!doc) return value
  return extractText(doc)
}

function extractText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(extractText).join('')
}
