import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useToken } from '../lib/auth'
import { useGhPages } from '../lib/github'
import { parseJump } from '../lib/links'
import { compact } from '../lib/format'
import { Icon } from '../components/Icon'
import { IssueRow, RepoRow } from '../components/rows'
import { Avatar, Empty, ErrorBox, LoadMore, Spinner } from '../components/ui'

const TYPES = [
  { id: 'repositories', label: 'Repos' },
  { id: 'issues', label: 'Issues & PRs' },
  { id: 'code', label: 'Code' },
  { id: 'users', label: 'Users' },
] as const

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const type = (params.get('type') as (typeof TYPES)[number]['id']) || 'repositories'
  const [draft, setDraft] = useState(q)
  const token = useToken()
  useEffect(() => setDraft(q), [q])

  const needsAuth = type === 'code' && !token
  const path = q && !needsAuth ? `/search/${type}?q=${encodeURIComponent(q)}` : null
  const results = useGhPages<any>(path, {
    perPage: type === 'code' ? 20 : 30,
    select: (p) => p.items,
    accept: type === 'code' ? 'application/vnd.github.text-match+json' : undefined,
  })
  const jump = parseJump(draft)

  return (
    <div className="page">
      <form
        className="jump"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ q: draft, type })
        }}
      >
        <Icon name="search" className="c-muted" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search GitHub" aria-label="Search GitHub" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" autoFocus={!q} />
      </form>
      {jump && (
        <Link className="jump-suggest" to={jump}>
          <Icon name="chevron" /> Go to <strong>{jump}</strong>
        </Link>
      )}
      <div className="seg scroll-x" role="tablist">
        {TYPES.map((t) => (
          <button key={t.id} role="tab" aria-selected={type === t.id} onClick={() => setParams(q ? { q, type: t.id } : { type: t.id })}>
            {t.label}
          </button>
        ))}
      </div>

      {needsAuth ? (
        <Empty>
          GitHub requires you to <Link to="/login?next=/search">sign in</Link> to search code.
        </Empty>
      ) : !q ? (
        <Empty>
          Tip: use the same qualifiers as on the web, like <code>is:pr is:open author:@me</code>, <code>repo:owner/name</code> or <code>language:go stars:&gt;100</code>.
        </Empty>
      ) : results.error ? (
        <ErrorBox error={results.error} onRetry={() => results.refetch()} />
      ) : results.isLoading ? (
        <Spinner />
      ) : (
        <>
          <p className="small muted">{compact(results.data?.total)} results</p>
          <ul className="list card-list">
            {results.data?.items.map((item: any) =>
              type === 'repositories' ? (
                <RepoRow key={item.id} repo={item} />
              ) : type === 'issues' ? (
                <IssueRow key={item.id} item={item} showRepo />
              ) : type === 'users' ? (
                <li key={item.id}>
                  <Link className="list-row" to={`/${item.login}`}>
                    <Avatar src={item.avatar_url} size={28} />
                    <span className="grow row-title">{item.login}</span>
                    <span className="small muted">{item.type}</span>
                  </Link>
                </li>
              ) : (
                <li key={item.sha + item.path}>
                  <Link className="list-row align-start" to={`/${item.repository.full_name}/blob/${encodeURIComponent(item.repository.default_branch ?? 'HEAD')}/${item.path}`}>
                    <Icon name="file" className="c-muted" />
                    <span className="grow min0">
                      <span className="small muted block">{item.repository.full_name}</span>
                      <span className="row-title ellipsis-start block">{item.path}</span>
                      {item.text_matches?.slice(0, 2).map((m: any, i: number) => (
                        <pre key={i} className="snippet">
                          {m.fragment}
                        </pre>
                      ))}
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
          {results.data?.items.length === 0 && <Empty>No results.</Empty>}
          <LoadMore q={results} />
        </>
      )}
    </div>
  )
}
