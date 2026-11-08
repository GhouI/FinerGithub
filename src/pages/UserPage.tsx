import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGh, useGhPages } from '../lib/github'
import { compact } from '../lib/format'
import { Icon } from '../components/Icon'
import { RepoRow } from '../components/rows'
import { Async, Avatar, LoadMore } from '../components/ui'

export function UserPage() {
  const { owner } = useParams()
  const user = useGh<any>(`/users/${owner}`)
  const [filter, setFilter] = useState('')
  const repos = useGhPages<any>(user.data ? `/${user.data.type === 'Organization' ? 'orgs' : 'users'}/${owner}/repos?sort=pushed` : null)

  return (
    <div className="page">
      <Async q={user}>
        {(u) => (
          <>
            <section className="profile">
              <Avatar src={u.avatar_url} size={72} />
              <div>
                <h1>{u.name || u.login}</h1>
                <p className="muted">
                  @{u.login}
                  {u.type === 'Organization' && <span className="tag"> Organization</span>}
                </p>
              </div>
            </section>
            {u.bio && <p>{u.bio}</p>}
            <p className="small muted row gap wrap">
              {u.type !== 'Organization' && (
                <span>
                  <Icon name="user" size={14} /> <strong>{compact(u.followers)}</strong> followers · <strong>{compact(u.following)}</strong> following
                </span>
              )}
              {u.company && <span>{u.company}</span>}
              {u.location && <span>{u.location}</span>}
              {u.blog && (
                <a href={/^https?:/.test(u.blog) ? u.blog : `https://${u.blog}`} target="_blank" rel="noreferrer">
                  {u.blog}
                </a>
              )}
            </p>
            <h2 className="section-title">Repositories · {compact(u.public_repos)}</h2>
            <input className="input" placeholder="Filter loaded repositories…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <Async q={{ ...repos, data: repos.data?.items }}>
              {(items) => (
                <>
                  <ul className="list card-list">
                    {items
                      .filter((r: any) => r.name.toLowerCase().includes(filter.toLowerCase()))
                      .map((r: any) => (
                        <RepoRow key={r.id} repo={r} />
                      ))}
                  </ul>
                  <LoadMore q={repos} />
                </>
              )}
            </Async>
          </>
        )}
      </Async>
    </div>
  )
}
