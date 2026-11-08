import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { fullDate, timeAgo } from '../lib/format'
import type { GhError } from '../lib/github'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: GhError | Error | null | undefined; onRetry?: () => void }) {
  if (!error) return null
  const status = (error as GhError).status
  return (
    <div className="error-box" role="alert">
      <strong>{status === 404 ? 'Not found' : 'Something went wrong'}</strong>
      <p>
        {status === 404
          ? 'It may not exist, or you may need to sign in to see it.'
          : error.message}
      </p>
      <div className="row gap">
        {status === 404 || status === 401 ? <Link className="btn" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> : null}
        {onRetry && <button className="btn" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}

/** Renders loading / error states for a query, then children once data is present. */
export function Async<T>({ q, children, label }: { q: { data?: T; error: any; isLoading: boolean; refetch: () => void }; children: (data: T) => ReactNode; label?: string }) {
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  if (q.isLoading || q.data === undefined) return <Spinner label={label} />
  return <>{children(q.data)}</>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Avatar({ src, size = 20, alt = '' }: { src?: string; size?: number; alt?: string }) {
  if (!src) return <span className="avatar" style={{ width: size, height: size }} />
  const url = src.includes('?') ? `${src}&s=${size * 2}` : `${src}?s=${size * 2}`
  return <img className="avatar" src={url} width={size} height={size} alt={alt} loading="lazy" />
}

export function Time({ iso }: { iso?: string | null }) {
  if (!iso) return null
  return (
    <time dateTime={iso} title={fullDate(iso)}>
      {timeAgo(iso)}
    </time>
  )
}

export function LabelChip({ label }: { label: { name: string; color: string } }) {
  return (
    <span className="label" style={{ ['--label' as string]: `#${label.color}` }}>
      {label.name}
    </span>
  )
}

/** Issue / PR state icon in the same colors people know from the web. */
export function IssueStateIcon({ item, size = 16 }: { item: any; size?: number }) {
  const isPr = !!item.pull_request || item.merged !== undefined || item.head
  const merged = item.merged || item.merged_at || item.pull_request?.merged_at
  if (isPr) {
    if (merged) return <Icon name="merge" size={size} className="c-done" title="Merged" />
    if (item.state === 'closed') return <Icon name="pr" size={size} className="c-danger" title="Closed" />
    if (item.draft) return <Icon name="pr" size={size} className="c-muted" title="Draft" />
    return <Icon name="pr" size={size} className="c-success" title="Open" />
  }
  if (item.state === 'closed') {
    return item.state_reason === 'not_planned' ? <Icon name="skip" size={size} className="c-muted" title="Closed as not planned" /> : <Icon name="issueClosed" size={size} className="c-done" title="Closed" />
  }
  return <Icon name="issue" size={size} className="c-success" title="Open" />
}

export function StateBadge({ item }: { item: any }) {
  const isPr = !!item.head || !!item.pull_request
  const merged = item.merged || item.merged_at
  let cls = 'success'
  let text = 'Open'
  if (merged) {
    cls = 'done'
    text = 'Merged'
  } else if (item.state === 'closed') {
    cls = isPr || item.state_reason === 'not_planned' ? (isPr ? 'danger' : 'muted') : 'done'
    text = 'Closed'
  } else if (item.draft) {
    cls = 'muted'
    text = 'Draft'
  }
  return (
    <span className={`badge badge-${cls}`}>
      <IssueStateIcon item={{ ...item, state: item.state }} size={14} />
      {text}
    </span>
  )
}

/** Status for check runs, workflow runs, jobs and steps. */
export function RunStatus({ status, conclusion, size = 16 }: { status?: string; conclusion?: string | null; size?: number }) {
  if (status && status !== 'completed') return <span className={`run-pending`} style={{ width: size, height: size }} title={status.replace('_', ' ')} role="img" aria-label={status} />
  switch (conclusion) {
    case 'success':
      return <Icon name="check" size={size} className="c-success" title="Success" />
    case 'failure':
    case 'timed_out':
    case 'startup_failure':
      return <Icon name="x" size={size} className="c-danger" title={conclusion.replace('_', ' ')} />
    case 'cancelled':
      return <Icon name="stop" size={size} className="c-muted" title="Cancelled" />
    case 'skipped':
    case 'neutral':
      return <Icon name="skip" size={size} className="c-muted" title={conclusion} />
    case 'action_required':
      return <Icon name="dot" size={size} className="c-attention" title="Action required" />
    default:
      return <Icon name="dot" size={size} className="c-muted" title={conclusion ?? 'unknown'} />
  }
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <strong>{title}</strong>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function LoadMore({ q }: { q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => void } }) {
  if (!q.hasNextPage) return null
  return (
    <button className="btn btn-block" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
      {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
    </button>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return (
    <button
      className="btn btn-sm"
      onClick={async (e) => {
        const btn = e.currentTarget
        try {
          await navigator.clipboard.writeText(text)
          btn.dataset.done = '1'
          setTimeout(() => delete btn.dataset.done, 1200)
        } catch {
          prompt('Copy this:', text)
        }
      }}
    >
      <Icon name="copy" size={14} />
      <span className="when-idle">{label}</span>
      <span className="when-done">Copied</span>
    </button>
  )
}
