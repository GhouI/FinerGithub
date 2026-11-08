import { Fragment, useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/common'
import { Link } from 'react-router-dom'
import { parsePatch } from '../lib/diff'
import { languageFor } from '../lib/highlight'
import { usePrefs } from '../lib/prefs'
import { Icon } from './Icon'
import { Avatar, Time } from './ui'
import { Markdown } from './Markdown'
import { Composer } from './Composer'

export interface LineTarget {
  line: number
  side: 'LEFT' | 'RIGHT'
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function highlightOne(text: string, lang: string | null) {
  if (!lang) return escapeHtml(text)
  try {
    return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
  } catch {
    return escapeHtml(text)
  }
}

const STATUS_LABEL: Record<string, string> = { added: 'Added', removed: 'Deleted', renamed: 'Renamed', modified: '', changed: '', copied: 'Copied' }

export function DiffFile({
  file,
  owner,
  repo,
  viewRef,
  comments = [],
  viewed,
  onViewed,
  onComment,
}: {
  file: any
  owner: string
  repo: string
  /** Commit/branch to use for "View file". */
  viewRef?: string
  comments?: any[]
  viewed?: boolean
  onViewed?: (v: boolean) => void
  /** When provided, tapping a line number opens a comment box for that line. */
  onComment?: (target: LineTarget, body: string) => Promise<unknown>
}) {
  const { wrapCode } = usePrefs()
  const [open, setOpen] = useState(!viewed && file.status !== 'removed')
  const [target, setTarget] = useState<LineTarget | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const lines = useMemo(() => (file.patch ? parsePatch(file.patch) : []), [file.patch])
  const lang = useMemo(() => ((file.patch?.length ?? 0) < 150_000 ? languageFor(file.filename) : null), [file.filename, file.patch])
  const htmlLines = useMemo(() => lines.map((l) => (l.type === 'hunk' || l.type === 'meta' ? escapeHtml(l.text) : highlightOne(l.text, lang))), [lines, lang])

  // Group review comments into threads anchored at a diff line.
  const threads = useMemo(() => {
    const byId = new Map<number, any>(comments.map((c) => [c.id, c]))
    const map = new Map<string, any[]>()
    for (const c of comments) {
      let root = c
      while (root.in_reply_to_id && byId.has(root.in_reply_to_id)) root = byId.get(root.in_reply_to_id)
      const line = root.line ?? root.original_line
      if (line == null) continue
      const key = `${root.side || 'RIGHT'}:${line}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [comments])

  const submit = async () => {
    if (!target || !onComment || !draft.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await onComment(target, draft)
      setDraft('')
      setTarget(null)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pick = (line: number | undefined, side: LineTarget['side']) => {
    if (!onComment || line == null) return
    setTarget(target?.line === line && target.side === side ? null : { line, side })
  }

  const ref = viewRef ?? 'HEAD'
  const label = STATUS_LABEL[file.status] ?? file.status

  return (
    <section className={`diff-file ${viewed ? 'is-viewed' : ''}`} id={`diff-${file.sha ?? file.filename}`}>
      <header className="diff-head">
        <button className="diff-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Icon name={open ? 'down' : 'chevron'} size={14} />
          <span className="diff-name">
            {file.previous_filename && <span className="muted">{file.previous_filename} → </span>}
            {file.filename}
          </span>
        </button>
        <span className="diff-stat">
          {label && <span className="tag">{label}</span>}
          <span className="c-success">+{file.additions}</span> <span className="c-danger">−{file.deletions}</span>
        </span>
        {onViewed && (
          <label className="viewed">
            <input type="checkbox" checked={!!viewed} onChange={(e) => { onViewed(e.target.checked); setOpen(!e.target.checked) }} /> Viewed
          </label>
        )}
      </header>
      {open && (
        <div className="diff-body">
          {!file.patch ? (
            <p className="muted pad">
              {file.status === 'renamed' && !file.changes ? 'File renamed without changes.' : 'Binary file or diff too large to show.'}{' '}
              {file.status !== 'removed' && <Link to={`/${owner}/${repo}/blob/${encodeURIComponent(ref)}/${file.filename}`}>View file</Link>}
            </p>
          ) : (
            <div className={`diff-table ${wrapCode ? 'wrap' : ''}`} role="table">
              {lines.map((l, i) => {
                const key = l.type === 'del' ? `LEFT:${l.old}` : `RIGHT:${l.new}`
                const thread = l.type === 'hunk' || l.type === 'meta' ? undefined : threads.get(key)
                const isTarget = target && ((target.side === 'LEFT' && l.type === 'del' && target.line === l.old) || (target.side === 'RIGHT' && l.type !== 'del' && target.line === l.new))
                return (
                  <Fragment key={i}>
                    <div className={`diff-row d-${l.type}`} role="row">
                      {l.type === 'hunk' || l.type === 'meta' ? (
                        <span className="diff-hunk" role="cell">
                          {l.text}
                        </span>
                      ) : (
                        <>
                          <button className="ln" role="cell" tabIndex={onComment ? 0 : -1} onClick={() => pick(l.type === 'del' ? l.old : l.new, l.type === 'del' ? 'LEFT' : 'RIGHT')} aria-label={onComment ? `Comment on line ${l.old ?? l.new}` : undefined}>
                            {l.old ?? ''}
                          </button>
                          <button className="ln" role="cell" tabIndex={-1} onClick={() => pick(l.type === 'del' ? l.old : l.new, l.type === 'del' ? 'LEFT' : 'RIGHT')}>
                            {l.new ?? ''}
                          </button>
                          <span className="code hljs" role="cell">
                            <span className="sign">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}</span>
                            <span dangerouslySetInnerHTML={{ __html: htmlLines[i] || ' ' }} />
                          </span>
                        </>
                      )}
                    </div>
                    {thread && (
                      <div className="diff-thread">
                        {thread.map((c) => (
                          <div key={c.id} className="thread-comment">
                            <div className="meta">
                              <Avatar src={c.user?.avatar_url} size={18} /> <strong>{c.user?.login}</strong> <Time iso={c.created_at} />
                            </div>
                            <Markdown html={c.body_html ?? ''} />
                          </div>
                        ))}
                      </div>
                    )}
                    {isTarget && (
                      <div className="diff-thread">
                        <Composer value={draft} onChange={setDraft} context={`${owner}/${repo}`} autoFocus rows={3} placeholder={`Comment on line ${target!.line}`}>
                          {err && <span className="c-danger small">{err}</span>}
                          <button className="btn" onClick={() => setTarget(null)}>
                            Cancel
                          </button>
                          <button className="btn btn-primary" disabled={busy || !draft.trim()} onClick={submit}>
                            {busy ? 'Posting…' : 'Comment'}
                          </button>
                        </Composer>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Compact list of changed files with +/- counts; tapping one scrolls to its diff. */
export function FileSummary({ files, onJump }: { files: any[]; onJump: (f: any) => void }) {
  return (
    <ul className="list file-summary">
      {files.map((f) => (
        <li key={f.sha + f.filename}>
          <button className="list-row" onClick={() => onJump(f)}>
            <Icon name="file" className="c-muted" />
            <span className="grow ellipsis-start" title={f.filename}>
              {f.filename}
            </span>
            <span className="small nowrap">
              <span className="c-success">+{f.additions}</span> <span className="c-danger">−{f.deletions}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
