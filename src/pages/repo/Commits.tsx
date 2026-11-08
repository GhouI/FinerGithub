import { Fragment } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGh, useGhPages } from '../../lib/github'
import { dayLabel, firstLine, shortSha } from '../../lib/format'
import { BranchPicker } from '../../components/BranchPicker'
import { DiffFile } from '../../components/Diff'
import { Icon } from '../../components/Icon'
import { Async, Avatar, CopyButton, Empty, LoadMore, Time } from '../../components/ui'
import { useRepo } from './RepoLayout'

export function CommitRows({ commits, owner, name }: { commits: any[]; owner: string; name: string }) {
  let lastDay = ''
  return (
    <div>
      {commits.map((c) => {
        const day = dayLabel(c.commit.committer?.date ?? c.commit.author.date)
        const header = day !== lastDay ? <h3 className="day-head">Commits on {day}</h3> : null
        lastDay = day
        return (
          <Fragment key={c.sha}>
            {header}
            <Link to={`/${owner}/${name}/commit/${c.sha}`} className="list-row card-row align-start">
              <Avatar src={c.author?.avatar_url} size={20} />
              <span className="grow min0">
                <span className="row-title clamp-2">{firstLine(c.commit.message)}</span>
                <span className="small muted block">
                  {c.author?.login ?? c.commit.author.name} · <Time iso={c.commit.author.date} />
                </span>
              </span>
              <code className="small muted">{shortSha(c.sha)}</code>
            </Link>
          </Fragment>
        )
      })}
    </div>
  )
}

export function CommitsList() {
  const { repo, owner, name } = useRepo()
  const params = useParams()
  const navigate = useNavigate()
  const ref = params.ref ? decodeURIComponent(params.ref) : repo.default_branch
  const path = params['*'] ?? ''
  const commits = useGhPages<any>(`/repos/${owner}/${name}/commits?sha=${encodeURIComponent(ref)}${path ? `&path=${encodeURIComponent(path)}` : ''}`)

  return (
    <div>
      <div className="toolbar">
        <BranchPicker owner={owner} repo={name} current={ref} defaultBranch={repo.default_branch} onPick={(r) => navigate(`/${owner}/${name}/commits/${encodeURIComponent(r)}${path ? '/' + path : ''}`)} />
        {path && (
          <span className="small muted ellipsis-start">
            History for <strong>{path}</strong>
          </span>
        )}
      </div>
      <Async q={{ ...commits, data: commits.data?.items }}>
        {(items) =>
          items.length ? (
            <>
              <CommitRows commits={items} owner={owner} name={name} />
              <LoadMore q={commits} />
            </>
          ) : (
            <Empty>No commits.</Empty>
          )
        }
      </Async>
    </div>
  )
}

export function CommitView() {
  const { owner, name } = useRepo()
  const { sha } = useParams()
  const commit = useGh<any>(`/repos/${owner}/${name}/commits/${sha}`)

  return (
    <Async q={commit}>
      {(c) => {
        const [title, ...rest] = c.commit.message.split('\n')
        const body = rest.join('\n').trim()
        return (
          <div>
            <header className="issue-head">
              <h1>{title}</h1>
              {body && <pre className="commit-body">{body}</pre>}
              <div className="row gap wrap small muted">
                <Avatar src={c.author?.avatar_url} size={18} />
                <strong>{c.author?.login ?? c.commit.author.name}</strong> committed <Time iso={c.commit.author.date} />
              </div>
              <div className="row gap wrap small">
                <code>{shortSha(c.sha)}</code>
                <CopyButton text={c.sha} label="SHA" />
                {c.parents.map((p: any) => (
                  <Link key={p.sha} to={`/${owner}/${name}/commit/${p.sha}`} className="muted">
                    parent <code>{shortSha(p.sha)}</code>
                  </Link>
                ))}
                <Link to={`/${owner}/${name}/tree/${c.sha}`} className="btn btn-sm">
                  <Icon name="code" size={14} /> Browse files
                </Link>
              </div>
            </header>
            <p className="small">
              <strong>{c.files?.length ?? 0}</strong> files changed <span className="c-success">+{c.stats?.additions}</span> <span className="c-danger">−{c.stats?.deletions}</span>
            </p>
            {c.files?.map((f: any) => (
              <DiffFile key={f.filename} file={f} owner={owner} repo={name} viewRef={c.sha} />
            ))}
          </div>
        )
      }}
    </Async>
  )
}
