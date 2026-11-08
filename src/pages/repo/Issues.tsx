import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToken } from '../../lib/auth'
import { gh, HTML, useGh, useGhMutation, useGhPages } from '../../lib/github'
import { compact } from '../../lib/format'
import { Icon } from '../../components/Icon'
import { IssueRow } from '../../components/rows'
import { Composer } from '../../components/Composer'
import { Markdown } from '../../components/Markdown'
import { Async, Avatar, Empty, ErrorBox, LabelChip, LoadMore, Spinner, StateBadge, Time } from '../../components/ui'
import { useRepo } from './RepoLayout'

/** Issue / PR list driven by the same search syntax as the web's filter bar. */
export function IssueList({ kind }: { kind: 'issue' | 'pr' }) {
  const { owner, name } = useRepo()
  const token = useToken()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? 'is:open'
  const [draft, setDraft] = useState(q)
  useEffect(() => setDraft(q), [q])

  const full = `repo:${owner}/${name} is:${kind} ${q}`.trim()
  const list = useGhPages<any>(`/search/issues?q=${encodeURIComponent(full)}&sort=updated`, { select: (p) => p.items })
  const open = useGh<any>(`/search/issues?q=${encodeURIComponent(`repo:${owner}/${name} is:${kind} is:open`)}&per_page=1`)
  const closed = useGh<any>(`/search/issues?q=${encodeURIComponent(`repo:${owner}/${name} is:${kind} is:closed`)}&per_page=1`)

  const chips: [string, string][] = [
    ['Open', 'is:open'],
    ['Closed', 'is:closed'],
    ...(kind === 'pr' ? ([['Merged', 'is:merged']] as [string, string][]) : []),
    ...(token
      ? ([
          ['Yours', 'is:open author:@me'],
          ['Assigned', 'is:open assignee:@me'],
          ...(kind === 'pr' ? ([['Needs your review', 'is:open review-requested:@me']] as [string, string][]) : []),
          ['Mentions', 'is:open mentions:@me'],
        ] as [string, string][])
      : []),
  ]

  return (
    <div>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ q: draft })
        }}
      >
        <Icon name="filter" className="c-muted" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Filter" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
        {token && kind === 'issue' && (
          <Link to={`/${owner}/${name}/issues/new`} className="btn btn-sm btn-primary">
            New
          </Link>
        )}
      </form>
      <div className="chips scroll-x">
        {chips.map(([label, value]) => (
          <button key={label} className={`chip ${q === value ? 'active' : ''}`} onClick={() => setParams({ q: value })}>
            {label}
            {label === 'Open' && open.data && <span className="count">{compact(open.data.total_count)}</span>}
            {label === 'Closed' && closed.data && <span className="count">{compact(closed.data.total_count)}</span>}
          </button>
        ))}
      </div>
      {list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <Spinner />
      ) : list.data?.items.length ? (
        <>
          <ul className="list card-list">
            {list.data.items.map((i: any) => (
              <IssueRow key={i.id} item={i} />
            ))}
          </ul>
          <LoadMore q={list} />
        </>
      ) : (
        <Empty>No {kind === 'pr' ? 'pull requests' : 'issues'} match this filter.</Empty>
      )}
    </div>
  )
}

export function NewIssue() {
  const { owner, name } = useRepo()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const create = useGhMutation(() => gh(`/repos/${owner}/${name}/issues`, { method: 'POST', body: { title, body } }), [`/repos/${owner}/${name}/issues`, '/search/issues'])
  return (
    <div className="narrow">
      <h1 className="page-title">New issue</h1>
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <Composer value={body} onChange={setBody} context={`${owner}/${name}`} placeholder="Describe the issue" rows={8}>
        {create.error && <span className="c-danger small">{create.error.message}</span>}
        <button className="btn btn-primary" disabled={!title.trim() || create.isPending} onClick={() => create.mutate(undefined, { onSuccess: (i) => navigate(`/${owner}/${name}/issues/${i.number}`, { replace: true }) })}>
          {create.isPending ? 'Creating…' : 'Create issue'}
        </button>
      </Composer>
    </div>
  )
}

export function IssueHeader({ item, children }: { item: any; children?: React.ReactNode }) {
  return (
    <header className="issue-head">
      <h1>
        {item.title} <span className="muted">#{item.number}</span>
      </h1>
      <div className="row gap wrap">
        <StateBadge item={item} />
        <span className="small muted">
          <strong>{item.user?.login}</strong> opened <Time iso={item.created_at} /> · {item.comments} comments
        </span>
      </div>
      {children}
      {(item.labels?.length > 0 || item.assignees?.length > 0 || item.milestone) && (
        <div className="issue-meta">
          {item.labels?.length > 0 && (
            <span className="labels">
              {item.labels.map((l: any) => (
                <LabelChip key={l.id} label={l} />
              ))}
            </span>
          )}
          {item.assignees?.length > 0 && (
            <span className="small muted row gap">
              Assigned to
              {item.assignees.map((a: any) => (
                <Link key={a.id} to={`/${a.login}`} className="row gap-xs">
                  <Avatar src={a.avatar_url} size={16} /> {a.login}
                </Link>
              ))}
            </span>
          )}
          {item.milestone && (
            <span className="small muted">
              Milestone: <strong>{item.milestone.title}</strong>
            </span>
          )}
        </div>
      )}
    </header>
  )
}

export function CommentCard({ c, owner, name, badge, hideEmpty }: { c: any; owner: string; name: string; badge?: React.ReactNode; hideEmpty?: boolean }) {
  return (
    <article className="comment">
      <div className="comment-head">
        <Avatar src={c.user?.avatar_url} size={20} />
        <Link to={`/${c.user?.login}`}>
          <strong>{c.user?.login}</strong>
        </Link>
        {c.author_association && !['NONE', 'CONTRIBUTOR'].includes(c.author_association) && <span className="tag">{c.author_association.toLowerCase()}</span>}
        {badge}
        <span className="grow" />
        <span className="small muted">
          <Time iso={c.submitted_at ?? c.created_at} />
        </span>
      </div>
      {c.body_html ? (
        <div className="comment-body">
          <Markdown html={c.body_html} base={{ owner, repo: name, ref: 'HEAD', dir: '' }} />
        </div>
      ) : (
        !hideEmpty && <p className="comment-body muted small">No description provided.</p>
      )}
    </article>
  )
}

/** Comment box + close/reopen for issues and PRs. */
export function ReplyBox({ item, owner, name, onDone }: { item: any; owner: string; name: string; onDone?: () => void }) {
  const token = useToken()
  const [body, setBody] = useState('')
  const base = `/repos/${owner}/${name}/issues/${item.number}`
  const inval = [base, `/repos/${owner}/${name}/pulls/${item.number}`, '/search/issues']
  const comment = useGhMutation(() => gh(`${base}/comments`, { method: 'POST', body: { body } }), inval)
  const setState = useGhMutation((state: string) => gh(base, { method: 'PATCH', body: { state, ...(state === 'closed' && !item.head ? { state_reason: 'completed' } : {}) } }), inval)

  if (!token) {
    return (
      <p className="small muted center pad">
        <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> to comment.
      </p>
    )
  }
  const busy = comment.isPending || setState.isPending
  const run = async (state?: string) => {
    if (body.trim()) await comment.mutateAsync(undefined)
    if (state) await setState.mutateAsync(state)
    setBody('')
    onDone?.()
  }
  const merged = item.merged || item.merged_at
  return (
    <Composer value={body} onChange={setBody} context={`${owner}/${name}`}>
      {(comment.error || setState.error) && <span className="c-danger small">{(comment.error || setState.error)!.message}</span>}
      {!merged && (
        <button className="btn" disabled={busy} onClick={() => run(item.state === 'open' ? 'closed' : 'open')}>
          {item.state === 'open' ? (body.trim() ? 'Close with comment' : `Close ${item.head ? 'pull request' : 'issue'}`) : 'Reopen'}
        </button>
      )}
      <button className="btn btn-primary" disabled={busy || !body.trim()} onClick={() => run()}>
        {comment.isPending ? 'Posting…' : 'Comment'}
      </button>
    </Composer>
  )
}

export function IssueView() {
  const { owner, name } = useRepo()
  const { number } = useParams()
  const issue = useGh<any>(`/repos/${owner}/${name}/issues/${number}`, { accept: HTML })
  const comments = useGhPages<any>(`/repos/${owner}/${name}/issues/${number}/comments`, { perPage: 100, accept: HTML })

  if (issue.data?.pull_request) return <Navigate to={`/${owner}/${name}/pull/${number}`} replace />

  return (
    <Async q={issue}>
      {(item) => (
        <div>
          <IssueHeader item={item} />
          <div className="timeline">
            <CommentCard c={item} owner={owner} name={name} />
            {comments.data?.items.map((c: any) => (
              <CommentCard key={c.id} c={c} owner={owner} name={name} />
            ))}
            {comments.isLoading && <Spinner label="Loading comments…" />}
            <LoadMore q={comments} />
          </div>
          <ReplyBox item={item} owner={owner} name={name} />
        </div>
      )}
    </Async>
  )
}
