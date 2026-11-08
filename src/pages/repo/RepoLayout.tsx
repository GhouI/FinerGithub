import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToken } from '../../lib/auth'
import { gh, useGh } from '../../lib/github'
import { compact } from '../../lib/format'
import { pushRecent } from '../../lib/prefs'
import { Icon } from '../../components/Icon'
import { Async, Avatar } from '../../components/ui'

export interface RepoCtx {
  repo: any
  owner: string
  name: string
}

export const useRepo = () => useOutletContext<RepoCtx>()

function StarButton({ repo }: { repo: any }) {
  const token = useToken()
  const qc = useQueryClient()
  const path = `/user/starred/${repo.full_name}`
  const [starred, setStarred] = useState<boolean | null>(null)
  const [count, setCount] = useState<number>(repo.stargazers_count)

  useEffect(() => {
    setCount(repo.stargazers_count)
    if (!token) return
    gh(path)
      .then(() => setStarred(true))
      .catch(() => setStarred(false))
  }, [path, token, repo.stargazers_count])

  const toggle = async () => {
    if (starred === null) return
    const next = !starred
    setStarred(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      await gh(path, { method: next ? 'PUT' : 'DELETE' })
      qc.invalidateQueries({ queryKey: ['gh', `/repos/${repo.full_name}`] })
    } catch {
      setStarred(!next)
      setCount((c) => c + (next ? -1 : 1))
    }
  }

  return (
    <button className={`btn btn-sm ${starred ? 'is-on' : ''}`} onClick={toggle} disabled={!token || starred === null} title={token ? (starred ? 'Unstar' : 'Star') : 'Sign in to star'}>
      <Icon name="star" size={14} /> {starred ? 'Starred' : 'Star'} <span className="count">{compact(count)}</span>
    </button>
  )
}

const TABS = [
  { to: '', label: 'Code', icon: 'code', match: ['', 'tree', 'blob'] },
  { to: 'issues', label: 'Issues', icon: 'issue', match: ['issues'] },
  { to: 'pulls', label: 'Pull requests', icon: 'pr', match: ['pulls', 'pull'] },
  { to: 'actions', label: 'Actions', icon: 'play', match: ['actions'] },
  { to: 'commits', label: 'Commits', icon: 'history', match: ['commits', 'commit'] },
  { to: 'releases', label: 'Releases', icon: 'tag', match: ['releases'] },
]

export function RepoLayout() {
  const { owner = '', repo: name = '' } = useParams()
  const location = useLocation()
  const repo = useGh<any>(`/repos/${owner}/${name}`)
  const section = location.pathname.split('/')[3] ?? ''
  const isCodeRoot = section === '' || section === 'tree'

  useEffect(() => {
    if (repo.data) pushRecent(repo.data)
  }, [repo.data])

  return (
    <div className="page repo">
      <header className="repo-head">
        <div className="repo-title">
          <Avatar src={repo.data?.owner?.avatar_url} size={20} />
          <NavLink to={`/${owner}`} className="muted">
            {owner}
          </NavLink>
          <span className="muted">/</span>
          <NavLink to={`/${owner}/${name}`} end>
            <strong>{name}</strong>
          </NavLink>
          {repo.data?.private && <span className="tag">Private</span>}
        </div>
        {repo.data && isCodeRoot && (
          <>
            {repo.data.fork && repo.data.parent && (
              <p className="small muted">
                forked from <NavLink to={`/${repo.data.parent.full_name}`}>{repo.data.parent.full_name}</NavLink>
              </p>
            )}
            {repo.data.description && <p className="repo-desc">{repo.data.description}</p>}
            {repo.data.homepage && (
              <p className="small">
                <a href={repo.data.homepage} target="_blank" rel="noreferrer">
                  <Icon name="link" size={12} /> {repo.data.homepage.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
            <div className="row gap wrap">
              <StarButton repo={repo.data} />
              <span className="small muted">
                <Icon name="fork" size={14} /> {compact(repo.data.forks_count)}
              </span>
              <span className="small muted">
                <Icon name="eye" size={14} /> {compact(repo.data.subscribers_count)}
              </span>
              {repo.data.license?.spdx_id && repo.data.license.spdx_id !== 'NOASSERTION' && <span className="small muted">{repo.data.license.spdx_id}</span>}
            </div>
          </>
        )}
      </header>
      <nav className="tabs scroll-x" aria-label="Repository">
        {TABS.map((t) => (
          <NavLink key={t.label} to={`/${owner}/${name}${t.to ? '/' + t.to : ''}`} className={() => (t.match.includes(section) ? 'active' : '')}>
            <Icon name={t.icon} size={14} />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Async q={repo}>{(data) => <Outlet context={{ repo: data, owner, name } satisfies RepoCtx} />}</Async>
    </div>
  )
}
