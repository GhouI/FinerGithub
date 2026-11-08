import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getToken, useToken } from '../../lib/auth'
import { gh, useGh, useGhMutation, useGhPages } from '../../lib/github'
import { duration, shortSha } from '../../lib/format'
import { Icon } from '../../components/Icon'
import { Async, Empty, ErrorBox, LoadMore, RunStatus, Spinner, Time } from '../../components/ui'
import { useRepo } from './RepoLayout'

const STATUS_FILTERS: [string, string][] = [
  ['All', ''],
  ['Failed', 'failure'],
  ['In progress', 'in_progress'],
  ['Queued', 'queued'],
  ['Succeeded', 'success'],
]

export function ActionsList() {
  const { owner, name } = useRepo()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const workflow = params.get('workflow') ?? ''
  const branch = params.get('branch') ?? ''
  const workflows = useGh<any>(`/repos/${owner}/${name}/actions/workflows?per_page=100`)
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (branch) qs.set('branch', branch)
  const base = workflow ? `/repos/${owner}/${name}/actions/workflows/${workflow}/runs` : `/repos/${owner}/${name}/actions/runs`
  const runs = useGhPages<any>(`${base}?${qs}`, { perPage: 25, select: (p) => p.workflow_runs })

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next)
  }

  return (
    <div>
      <div className="toolbar">
        <select className="input select" value={workflow} onChange={(e) => set('workflow', e.target.value)} aria-label="Workflow">
          <option value="">All workflows</option>
          {workflows.data?.workflows?.map((w: any) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div className="chips scroll-x">
        {STATUS_FILTERS.map(([label, v]) => (
          <button key={label} className={`chip ${status === v ? 'active' : ''}`} onClick={() => set('status', v)}>
            {label}
          </button>
        ))}
        {branch && (
          <button className="chip active" onClick={() => set('branch', '')}>
            <Icon name="branch" size={12} /> {branch} <Icon name="x" size={12} />
          </button>
        )}
      </div>
      <Async q={{ ...runs, data: runs.data?.items }}>
        {(items) =>
          items.length ? (
            <>
              <ul className="list card-list">
                {items.map((r: any) => (
                  <li key={r.id}>
                    <Link className="list-row align-start" to={`/${owner}/${name}/actions/runs/${r.id}`}>
                      <RunStatus status={r.status} conclusion={r.conclusion} />
                      <span className="grow min0">
                        <span className="row-title clamp-2">{r.display_title}</span>
                        <span className="small muted block">
                          {r.name} #{r.run_number} · {r.event}
                        </span>
                        <span className="small muted block row gap-xs wrap">
                          <span className="branch-pill ellipsis">{r.head_branch}</span>
                          <Time iso={r.created_at} />
                          {r.status === 'completed' && <span>· {duration(r.run_started_at, r.updated_at)}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <LoadMore q={runs} />
            </>
          ) : (
            <Empty>No workflow runs.</Empty>
          )
        }
      </Async>
    </div>
  )
}

export function RunView() {
  const { owner, name } = useRepo()
  const { runId } = useParams()
  const token = useToken()
  const runPath = `/repos/${owner}/${name}/actions/runs/${runId}`
  const run = useGh<any>(runPath, {}, { refetchInterval: 15_000 })
  const active = run.data && run.data.status !== 'completed'
  const jobs = useGh<any>(`${runPath}/jobs?per_page=100`, {}, { refetchInterval: active ? 10_000 : false })
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const act = useGhMutation((what: 'rerun' | 'rerun-failed-jobs' | 'cancel') => gh(`${runPath}/${what}`, { method: 'POST' }), [runPath])

  return (
    <Async q={run}>
      {(r) => (
        <div>
          <header className="issue-head">
            <div className="row gap">
              <RunStatus status={r.status} conclusion={r.conclusion} size={20} />
              <h1>{r.display_title}</h1>
            </div>
            <p className="small muted">
              {r.name} #{r.run_number}
              {r.run_attempt > 1 && ` (attempt ${r.run_attempt})`} · triggered by {r.event} · <Time iso={r.created_at} />
            </p>
            <div className="row gap wrap small">
              <Link className="branch-pill" to={`/${owner}/${name}/actions?branch=${encodeURIComponent(r.head_branch ?? '')}`}>
                <Icon name="branch" size={12} /> {r.head_branch}
              </Link>
              <Link to={`/${owner}/${name}/commit/${r.head_sha}`}>
                <code>{shortSha(r.head_sha)}</code>
              </Link>
              <span className="muted">Duration {duration(r.run_started_at, r.status === 'completed' ? r.updated_at : null)}</span>
              {r.pull_requests?.map((p: any) => (
                <Link key={p.number} to={`/${owner}/${name}/pull/${p.number}`}>
                  #{p.number}
                </Link>
              ))}
            </div>
            {token && (
              <div className="row gap wrap">
                {r.status === 'completed' ? (
                  <>
                    <button className="btn btn-sm" disabled={act.isPending} onClick={() => act.mutate('rerun')}>
                      <Icon name="refresh" size={14} /> Re-run all jobs
                    </button>
                    {['failure', 'cancelled', 'timed_out'].includes(r.conclusion) && (
                      <button className="btn btn-sm" disabled={act.isPending} onClick={() => act.mutate('rerun-failed-jobs')}>
                        Re-run failed jobs
                      </button>
                    )}
                  </>
                ) : (
                  <button className="btn btn-sm btn-danger" disabled={act.isPending} onClick={() => act.mutate('cancel')}>
                    <Icon name="stop" size={14} /> Cancel run
                  </button>
                )}
              </div>
            )}
            {act.error && <p className="c-danger small">{act.error.message}</p>}
            {act.isSuccess && <p className="c-success small">Request sent. This page refreshes automatically.</p>}
          </header>

          <h2 className="section-title">Jobs</h2>
          <Async q={jobs}>
            {(j) => (
              <ul className="list card-list">
                {j.jobs.map((job: any) => {
                  const open = expanded.has(job.id)
                  return (
                    <li key={job.id}>
                      <div className="list-row">
                        <button
                          className="plain row gap grow text-left min0"
                          aria-expanded={open}
                          onClick={() => {
                            const next = new Set(expanded)
                            if (open) next.delete(job.id)
                            else next.add(job.id)
                            setExpanded(next)
                          }}
                        >
                          <RunStatus status={job.status} conclusion={job.conclusion} />
                          <span className="grow min0">
                            <span className="row-title ellipsis block">{job.name}</span>
                            <span className="small muted">{duration(job.started_at, job.completed_at)}</span>
                          </span>
                          <Icon name={open ? 'down' : 'chevron'} />
                        </button>
                        <Link className="btn btn-sm" to={`/${owner}/${name}/actions/runs/${r.id}/job/${job.id}`}>
                          Logs
                        </Link>
                      </div>
                      {open && (
                        <ol className="steps">
                          {job.steps?.map((s: any) => (
                            <li key={s.number}>
                              <RunStatus status={s.status} conclusion={s.conclusion} size={14} />
                              <span className="grow">{s.name}</span>
                              <span className="small muted">{duration(s.started_at, s.completed_at)}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Async>
        </div>
      )}
    </Async>
  )
}

interface LogGroup {
  title: string | null
  lines: { text: string; kind: 'error' | 'warning' | 'cmd' | 'normal' }[]
  hasError: boolean
}

const TS = /^\d{4}-\d\d-\d\dT[\d:.]+Z /
// Strip ANSI color codes; the web view shows them as colors but plain text reads fine on mobile.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g

function parseLog(text: string): LogGroup[] {
  const groups: LogGroup[] = [{ title: null, lines: [], hasError: false }]
  let cur = groups[0]
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(TS, '').replace(ANSI, '')
    if (line.startsWith('##[group]')) {
      cur = { title: line.slice(9), lines: [], hasError: false }
      groups.push(cur)
    } else if (line.startsWith('##[endgroup]')) {
      cur = { title: null, lines: [], hasError: false }
      groups.push(cur)
    } else if (line.startsWith('##[error]')) {
      cur.lines.push({ text: line.slice(9), kind: 'error' })
      cur.hasError = true
    } else if (line.startsWith('##[warning]')) cur.lines.push({ text: line.slice(11), kind: 'warning' })
    else if (line.startsWith('[command]')) cur.lines.push({ text: line.slice(9), kind: 'cmd' })
    else cur.lines.push({ text: line, kind: 'normal' })
  }
  return groups.filter((g) => g.title !== null || g.lines.some((l) => l.text))
}

export function JobLog() {
  const { owner, name } = useRepo()
  const { jobId } = useParams()
  const token = useToken()
  const job = useGh<any>(`/repos/${owner}/${name}/actions/jobs/${jobId}`)
  const [find, setFind] = useState('')
  const log = useQuery({
    queryKey: ['log', owner, name, jobId, token],
    queryFn: async () => {
      const t = getToken()
      const r = await fetch(`/api/logs/${owner}/${name}/${jobId}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      if (!r.ok) throw Object.assign(new Error(r.status === 404 ? 'Logs are not available yet (or have expired).' : r.status === 401 || r.status === 403 ? 'Sign in with access to this repository to read its logs.' : `Could not load logs (${r.status}).`), { status: r.status })
      return r.text()
    },
    refetchInterval: job.data && job.data.status !== 'completed' ? 10_000 : false,
  })
  const groups = useMemo(() => (log.data ? parseLog(log.data) : []), [log.data])
  const needle = find.toLowerCase()

  return (
    <div>
      <Async q={job}>
        {(j) => (
          <header className="issue-head">
            <div className="row gap">
              <RunStatus status={j.status} conclusion={j.conclusion} size={20} />
              <h1>{j.name}</h1>
            </div>
            <p className="small muted">
              {j.workflow_name} · {duration(j.started_at, j.completed_at)} · <Link to={`/${owner}/${name}/actions/runs/${j.run_id}`}>Back to run</Link>
            </p>
          </header>
        )}
      </Async>
      <div className="toolbar sticky-tools">
        <input className="input" placeholder="Search log…" value={find} onChange={(e) => setFind(e.target.value)} />
        {groups.some((g) => g.hasError) && (
          <button className="btn btn-sm btn-danger" onClick={() => document.querySelector('.log .log-error')?.scrollIntoView({ block: 'center' })}>
            First error
          </button>
        )}
      </div>
      {log.error ? (
        <ErrorBox error={log.error as Error} onRetry={() => log.refetch()} />
      ) : log.isLoading ? (
        <Spinner label="Downloading log…" />
      ) : (
        <div className="log">
          {groups.map((g, gi) => {
            const lines = needle ? g.lines.filter((l) => l.text.toLowerCase().includes(needle)) : g.lines
            if (needle && !lines.length && !(g.title ?? '').toLowerCase().includes(needle)) return null
            const body = lines.map((l, i) => (
              <div key={i} className={`log-line log-${l.kind}`}>
                {l.text || ' '}
              </div>
            ))
            return g.title ? (
              <details key={gi} open={g.hasError || !!needle}>
                <summary className={g.hasError ? 'c-danger' : ''}>{g.title}</summary>
                {body}
              </details>
            ) : (
              <div key={gi}>{body}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
