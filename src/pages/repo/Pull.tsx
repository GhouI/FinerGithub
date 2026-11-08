import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { useToken } from '../../lib/auth'
import { gh, HTML, useGh, useGhMutation, useGhPages } from '../../lib/github'
import { getViewed, setPrefs, setViewed, usePrefs } from '../../lib/prefs'
import { toAppPath } from '../../lib/links'
import { Icon } from '../../components/Icon'
import { Composer } from '../../components/Composer'
import { DiffFile, FileSummary, type LineTarget } from '../../components/Diff'
import { Markdown } from '../../components/Markdown'
import { Async, Avatar, Empty, ErrorBox, RunStatus, Sheet, Spinner, Time } from '../../components/ui'
import { CommentCard, IssueHeader, ReplyBox } from './Issues'
import { useRepo } from './RepoLayout'
import { CommitRows } from './Commits'

type Tab = 'conversation' | 'commits' | 'files'

export function PullView({ tab }: { tab: Tab }) {
  const { owner, name } = useRepo()
  const { number } = useParams()
  const pr = useGh<any>(`/repos/${owner}/${name}/pulls/${number}`, { accept: HTML })
  const base = `/${owner}/${name}/pull/${number}`

  return (
    <Async q={pr}>
      {(p) => (
        <div>
          <IssueHeader item={p}>
            <p className="small muted branch-line">
              <strong>{p.user.login}</strong> wants to merge {p.commits} commit{p.commits === 1 ? '' : 's'} into <code>{p.base.ref}</code> from <code>{p.head.label}</code>
            </p>
          </IssueHeader>
          <nav className="tabs scroll-x" aria-label="Pull request">
            <NavLink to={base} end>
              <Icon name="comment" size={14} /> Conversation <span className="count">{p.comments + p.review_comments}</span>
            </NavLink>
            <NavLink to={`${base}/commits`}>
              <Icon name="commit" size={14} /> Commits <span className="count">{p.commits}</span>
            </NavLink>
            <NavLink to={`${base}/files`}>
              <Icon name="file" size={14} /> Files <span className="count">{p.changed_files}</span>
            </NavLink>
          </nav>
          {tab === 'conversation' && <Conversation pr={p} />}
          {tab === 'commits' && <PullCommits pr={p} />}
          {tab === 'files' && <PullFiles pr={p} />}
        </div>
      )}
    </Async>
  )
}

const REVIEW_BADGE: Record<string, [string, string]> = {
  APPROVED: ['approved', 'success'],
  CHANGES_REQUESTED: ['requested changes', 'danger'],
  COMMENTED: ['reviewed', 'muted'],
  DISMISSED: ['review dismissed', 'muted'],
}

function Conversation({ pr }: { pr: any }) {
  const { owner, name } = useRepo()
  const n = pr.number
  const comments = useGhPages<any>(`/repos/${owner}/${name}/issues/${n}/comments`, { perPage: 100, accept: HTML })
  const reviews = useGhPages<any>(`/repos/${owner}/${name}/pulls/${n}/reviews`, { perPage: 100, accept: HTML })
  const inline = useGhPages<any>(`/repos/${owner}/${name}/pulls/${n}/comments`, { perPage: 100, accept: HTML })

  const timeline = useMemo(() => {
    const byReview = new Map<number, any[]>()
    for (const c of inline.data?.items ?? []) {
      if (!byReview.has(c.pull_request_review_id)) byReview.set(c.pull_request_review_id, [])
      byReview.get(c.pull_request_review_id)!.push(c)
    }
    const entries: { at: string; node: JSX.Element }[] = []
    for (const c of comments.data?.items ?? []) entries.push({ at: c.created_at, node: <CommentCard key={`c${c.id}`} c={c} owner={owner} name={name} /> })
    for (const r of reviews.data?.items ?? []) {
      const threads = byReview.get(r.id) ?? []
      if (r.state === 'COMMENTED' && !r.body && threads.length === 0) continue
      const [label, cls] = REVIEW_BADGE[r.state] ?? [r.state.toLowerCase(), 'muted']
      entries.push({
        at: r.submitted_at ?? '',
        node: (
          <div key={`r${r.id}`} className="review">
            <CommentCard c={r} owner={owner} name={name} hideEmpty badge={<span className={`badge badge-${cls}`}>{label}</span>} />
            {threads.map((t) => (
              <div key={t.id} className="inline-comment">
                <div className="small muted ellipsis-start">
                  <Icon name="file" size={12} /> {t.path}
                </div>
                {!t.in_reply_to_id && t.diff_hunk && <pre className="hunk">{t.diff_hunk.split('\n').slice(-4).join('\n')}</pre>}
                <div className="comment-head small">
                  <Avatar src={t.user?.avatar_url} size={16} /> <strong>{t.user?.login}</strong> <Time iso={t.created_at} />
                </div>
                <Markdown html={t.body_html ?? ''} />
              </div>
            ))}
          </div>
        ),
      })
    }
    return entries.sort((a, b) => a.at.localeCompare(b.at)).map((e) => e.node)
  }, [comments.data, reviews.data, inline.data, owner, name])

  return (
    <div>
      <div className="timeline">
        <CommentCard c={pr} owner={owner} name={name} />
        {timeline}
        {(comments.isLoading || reviews.isLoading) && <Spinner label="Loading conversation…" />}
      </div>
      <Checks pr={pr} />
      <MergeBox pr={pr} />
      <ReplyBox item={pr} owner={owner} name={name} />
    </div>
  )
}

function Checks({ pr }: { pr: any }) {
  const { owner, name } = useRepo()
  const [open, setOpen] = useState(false)
  const runs = useGh<any>(`/repos/${owner}/${name}/commits/${pr.head.sha}/check-runs?per_page=100`, {}, { refetchInterval: pr.state === 'open' ? 30_000 : false })
  const statuses = useGh<any>(`/repos/${owner}/${name}/commits/${pr.head.sha}/status`)
  const items = [
    ...(runs.data?.check_runs ?? []).map((r: any) => ({ id: `r${r.id}`, name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url, sub: r.app?.name })),
    ...(statuses.data?.statuses ?? []).map((s: any) => ({
      id: `s${s.id}`,
      name: s.context,
      status: s.state === 'pending' ? 'in_progress' : 'completed',
      conclusion: s.state === 'error' ? 'failure' : s.state,
      url: s.target_url,
      sub: s.description,
    })),
  ]
  if (!items.length) return null
  const failed = items.filter((i) => ['failure', 'timed_out', 'startup_failure'].includes(i.conclusion)).length
  const pending = items.filter((i) => i.status !== 'completed').length
  const summary = failed ? `${failed} failing` : pending ? `${pending} in progress` : 'All checks passed'
  return (
    <section className="card flush checks">
      <button className="list-row" onClick={() => setOpen(!open)} aria-expanded={open}>
        <RunStatus status={pending && !failed ? 'in_progress' : 'completed'} conclusion={failed ? 'failure' : 'success'} />
        <span className="grow">
          <strong>{summary}</strong>
          <span className="small muted block">{items.length} checks</span>
        </span>
        <Icon name={open ? 'down' : 'chevron'} />
      </button>
      {open && (
        <ul className="list">
          {items.map((i) => {
            const app = i.url ? toAppPath(i.url) : null
            const body = (
              <>
                <RunStatus status={i.status} conclusion={i.conclusion} />
                <span className="grow min0">
                  <span className="ellipsis block">{i.name}</span>
                  {i.sub && <span className="small muted ellipsis block">{i.sub}</span>}
                </span>
              </>
            )
            return (
              <li key={i.id}>
                {app ? (
                  <Link className="list-row" to={app}>
                    {body}
                  </Link>
                ) : i.url ? (
                  <a className="list-row" href={i.url} target="_blank" rel="noreferrer">
                    {body}
                  </a>
                ) : (
                  <span className="list-row">{body}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const MERGE_STATE: Record<string, [string, string]> = {
  clean: ['This branch has no conflicts with the base branch.', 'success'],
  unstable: ['Some checks were not successful, but merging is allowed.', 'attention'],
  blocked: ['Merging is blocked by branch protection (reviews or required checks).', 'danger'],
  behind: ['This branch is out of date with the base branch.', 'attention'],
  dirty: ['This branch has conflicts that must be resolved on the web or locally.', 'danger'],
  draft: ['This pull request is still a draft.', 'muted'],
  has_hooks: ['Ready to merge.', 'success'],
  unknown: ['Checking mergeability…', 'muted'],
}

function MergeBox({ pr }: { pr: any }) {
  const { repo, owner, name } = useRepo()
  const token = useToken()
  const methods = [
    ['squash', 'Squash and merge', repo.allow_squash_merge],
    ['merge', 'Create a merge commit', repo.allow_merge_commit],
    ['rebase', 'Rebase and merge', repo.allow_rebase_merge],
  ].filter(([, , allowed]) => allowed !== false) as [string, string, boolean][]
  const [method, setMethod] = useState(methods[0]?.[0] ?? 'merge')
  const [confirm, setConfirm] = useState(false)
  const inval = [`/repos/${owner}/${name}/pulls/${pr.number}`, `/repos/${owner}/${name}/issues/${pr.number}`, '/search/issues']
  const merge = useGhMutation(() => gh(`/repos/${owner}/${name}/pulls/${pr.number}/merge`, { method: 'PUT', body: { merge_method: method } }), inval)
  const update = useGhMutation(() => gh(`/repos/${owner}/${name}/pulls/${pr.number}/update-branch`, { method: 'PUT', body: {} }), inval)

  if (pr.merged) {
    return (
      <section className="card merge-box done">
        <Icon name="merge" className="c-done" /> Merged by <strong>{pr.merged_by?.login}</strong> <Time iso={pr.merged_at} />
      </section>
    )
  }
  if (pr.state !== 'open' || !token) return null
  const [text, cls] = MERGE_STATE[pr.mergeable_state] ?? [pr.mergeable_state, 'muted']
  const canMerge = pr.mergeable && !['dirty', 'draft', 'blocked'].includes(pr.mergeable_state)

  return (
    <section className={`card merge-box b-${cls}`}>
      <p>{text}</p>
      {pr.mergeable_state === 'behind' && (
        <button className="btn" disabled={update.isPending} onClick={() => update.mutate(undefined)}>
          {update.isPending ? 'Updating…' : 'Update branch'}
        </button>
      )}
      {methods.length > 0 && (
        <div className="row gap wrap">
          <select className="input select" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Merge method">
            {methods.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          {confirm ? (
            <>
              <button className="btn btn-success" disabled={merge.isPending} onClick={() => merge.mutate(undefined, { onSettled: () => setConfirm(false) })}>
                {merge.isPending ? 'Merging…' : 'Confirm merge'}
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-success" disabled={!canMerge} onClick={() => setConfirm(true)}>
              Merge pull request
            </button>
          )}
        </div>
      )}
      {(merge.error || update.error) && <p className="c-danger small">{(merge.error || update.error)!.message}</p>}
    </section>
  )
}

function ReviewButton({ pr }: { pr: any }) {
  const { owner, name } = useRepo()
  const token = useToken()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [event, setEvent] = useState<'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'>('COMMENT')
  const submit = useGhMutation(() => gh(`/repos/${owner}/${name}/pulls/${pr.number}/reviews`, { method: 'POST', body: { body, event } }), [`/repos/${owner}/${name}/pulls/${pr.number}`])
  if (!token || pr.state !== 'open') return null
  return (
    <>
      <button className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
        Review
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Finish your review">
        <Composer value={body} onChange={setBody} context={`${owner}/${name}`} placeholder="Leave a review comment" rows={4} />
        <fieldset className="radio-list">
          {(
            [
              ['COMMENT', 'Comment', 'General feedback without explicit approval.'],
              ['APPROVE', 'Approve', 'Give your approval to merge these changes.'],
              ['REQUEST_CHANGES', 'Request changes', 'Feedback that must be addressed before merging.'],
            ] as const
          ).map(([id, label, help]) => (
            <label key={id}>
              <input type="radio" name="event" checked={event === id} onChange={() => setEvent(id)} />
              <span>
                <strong>{label}</strong>
                <span className="small muted block">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {submit.error && <p className="c-danger small">{submit.error.message}</p>}
        <button
          className="btn btn-primary btn-block"
          disabled={submit.isPending || (event !== 'APPROVE' && !body.trim())}
          onClick={() =>
            submit.mutate(undefined, {
              onSuccess: () => {
                setOpen(false)
                setBody('')
              },
            })
          }
        >
          {submit.isPending ? 'Submitting…' : 'Submit review'}
        </button>
      </Sheet>
    </>
  )
}

function PullFiles({ pr }: { pr: any }) {
  const { owner, name } = useRepo()
  const token = useToken()
  const { wrapCode } = usePrefs()
  const files = useGhPages<any>(`/repos/${owner}/${name}/pulls/${pr.number}/files`, { perPage: 100 })
  const comments = useGhPages<any>(`/repos/${owner}/${name}/pulls/${pr.number}/comments`, { perPage: 100, accept: HTML })
  const key = `${owner}/${name}#${pr.number}`
  const [viewed, setViewedState] = useState<Record<string, string>>(() => getViewed(key))
  const [filter, setFilter] = useState('')
  const [jump, setJump] = useState(false)

  // Load every page of files (GitHub caps at 3000) so the whole PR is reviewable.
  useEffect(() => {
    if (files.hasNextPage && !files.isFetchingNextPage) files.fetchNextPage()
  }, [files.hasNextPage, files.isFetchingNextPage, files])

  const all = files.data?.items ?? []
  const shown = filter ? all.filter((f) => f.filename.toLowerCase().includes(filter.toLowerCase())) : all
  const viewedCount = all.filter((f) => viewed[f.filename] === f.sha).length
  const commentsByPath = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const c of comments.data?.items ?? []) {
      if (!m.has(c.path)) m.set(c.path, [])
      m.get(c.path)!.push(c)
    }
    return m
  }, [comments.data])

  const markViewed = (f: any, v: boolean) => {
    const next = { ...viewed }
    if (v) next[f.filename] = f.sha
    else delete next[f.filename]
    setViewedState(next)
    setViewed(key, next)
  }

  const postComment = async (f: any, target: LineTarget, body: string) => {
    await gh(`/repos/${owner}/${name}/pulls/${pr.number}/comments`, { method: 'POST', body: { body, commit_id: pr.head.sha, path: f.filename, line: target.line, side: target.side } })
    await comments.refetch()
  }

  if (files.error) return <ErrorBox error={files.error} onRetry={() => files.refetch()} />

  return (
    <div>
      <div className="files-bar">
        <span className="small">
          <strong>{pr.changed_files}</strong> files <span className="c-success">+{pr.additions}</span> <span className="c-danger">−{pr.deletions}</span>
          <span className="muted"> · {viewedCount}/{all.length} viewed</span>
        </span>
        <span className="grow" />
        <button className="icon-btn" onClick={() => setJump(true)} aria-label="Jump to file" title="Jump to file">
          <Icon name="list" />
        </button>
        <button className={`icon-btn ${wrapCode ? 'is-on' : ''}`} onClick={() => setPrefs({ wrapCode: !wrapCode })} aria-pressed={wrapCode} aria-label="Wrap lines" title="Wrap lines">
          <Icon name="wrap" />
        </button>
        <ReviewButton pr={pr} />
      </div>
      <div className="progress" aria-hidden>
        <span style={{ width: `${all.length ? (viewedCount / all.length) * 100 : 0}%` }} />
      </div>
      {all.length > 8 && <input className="input" placeholder="Filter changed files…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      {token && pr.state === 'open' && <p className="small muted hint">Tip: tap a line number to comment on that line.</p>}
      {files.isLoading ? (
        <Spinner label="Loading changes…" />
      ) : shown.length === 0 ? (
        <Empty>No files match.</Empty>
      ) : (
        shown.map((f) => (
          <DiffFile
            key={f.filename}
            file={f}
            owner={owner}
            repo={name}
            viewRef={pr.head.sha}
            comments={commentsByPath.get(f.filename)}
            viewed={viewed[f.filename] === f.sha}
            onViewed={(v) => markViewed(f, v)}
            onComment={token && pr.state === 'open' ? (t, body) => postComment(f, t, body) : undefined}
          />
        ))
      )}
      <Sheet open={jump} onClose={() => setJump(false)} title={`${all.length} changed files`}>
        <FileSummary
          files={all}
          onJump={(f) => {
            setJump(false)
            setTimeout(() => document.getElementById(`diff-${f.sha ?? f.filename}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
          }}
        />
      </Sheet>
    </div>
  )
}

function PullCommits({ pr }: { pr: any }) {
  const { owner, name } = useRepo()
  const commits = useGhPages<any>(`/repos/${owner}/${name}/pulls/${pr.number}/commits`, { perPage: 100 })
  return (
    <Async q={{ ...commits, data: commits.data?.items }}>
      {(items) => (items.length ? <CommitRows commits={items} owner={owner} name={name} /> : <Empty>No commits.</Empty>)}
    </Async>
  )
}

