import { useState, type ReactNode } from 'react'
import { gh } from '../lib/github'
import { Markdown } from './Markdown'

/** Markdown text box with Write / Preview tabs. Preview is rendered by GitHub, so it matches exactly. */
export function Composer({
  value,
  onChange,
  context,
  placeholder = 'Leave a comment',
  autoFocus,
  rows = 5,
  children,
}: {
  value: string
  onChange: (v: string) => void
  context?: string
  placeholder?: string
  autoFocus?: boolean
  rows?: number
  children?: ReactNode
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [preview, setPreview] = useState<string | null>(null)

  const showPreview = async () => {
    setTab('preview')
    setPreview(null)
    try {
      const html = await gh<string>('/markdown', { method: 'POST', body: { text: value || '_Nothing to preview_', mode: 'gfm', context }, text: true, accept: 'text/html' })
      setPreview(html)
    } catch (e) {
      setPreview(`<p><em>Preview failed: ${(e as Error).message}</em></p>`)
    }
  }

  return (
    <div className="composer">
      <div className="composer-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'write'} onClick={() => setTab('write')}>
          Write
        </button>
        <button role="tab" aria-selected={tab === 'preview'} onClick={showPreview}>
          Preview
        </button>
      </div>
      {tab === 'write' ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} autoFocus={autoFocus} />
      ) : (
        <div className="composer-preview">{preview === null ? <p className="muted">Rendering…</p> : <Markdown html={preview} />}</div>
      )}
      {children && <div className="composer-actions">{children}</div>}
    </div>
  )
}
