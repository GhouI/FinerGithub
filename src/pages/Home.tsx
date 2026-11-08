import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useToken } from '../lib/auth'
import { useGh } from '../lib/github'
import { parseJump } from '../lib/links'
import { getRecent } from '../lib/prefs'
import { Icon } from '../components/Icon'
import { RepoRow } from '../components/rows'
import { Async, Empty } from '../components/ui'

const DASHBOARD = [
  { label: 'Your pull requests', icon: 'pr', q: 'is:open is:pr author:@me archived:false' },
  { label: 'Review requests', icon: 'eye', q: 'is:open is:pr review-requested:@me archived:false' },
  { label: 'Assigned to you', icon: 'issue', q: 'is:open assignee:@me archived:false' },
  { label: 'Mentions', icon: 'mention', q: 'is:open mentions:@me archived:false' },
]

function JumpBox() {
  const [value, setValue] = useState('')
  const navigate = useNavigate()
  return (
    <form
      className="jump"
      onSubmit={(e) => {
        e.preventDefault()
        const to = parseJump(value)
        navigate(to ?? `/search?q=${encodeURIComponent(value)}`)
      }}
    >
      <Icon name="search" className="c-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="owner/repo, a GitHub link, or search"
        aria-label="Jump to a repository, paste a GitHub link, or search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
    </form>
  )
}

function DashboardTile({ label, icon, q }: { label: string; icon: string; q: string }) {
  const count = useGh<any>(`/search/issues?q=${encodeURIComponent(q)}&per_page=1`)
  return (
    <Link className="tile" to={`/search?type=issues&q=${encodeURIComponent(q)}`}>
      <Icon name={icon} size={20} />
      <span className="tile-count">{count.data ? count.data.total_count : '–'}</span>
      <span className="tile-label">{label}</span>
    </Link>
  )
}

export function Home() {
  const token = useToken()
  const recent = useMemo(() => getRecent(), [])
  const [filter, setFilter] = useState('')
  const repos = useGh<any[]>(token ? '/user/repos?sort=pushed&per_page=100' : null)

  return (
    <div className="page">
      <JumpBox />

      {token ? (
        <section>
          <div className="tiles">
            {DASHBOARD.map((d) => (
              <DashboardTile key={d.label} {...d} />
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <h2>A GitHub client that works like the web</h2>
          <p className="muted">
            Browse code with a file finder, review pull request diffs line by line, follow Actions logs and manage your inbox. Every page uses the same address as on github.com, so you can swap
            <code>github.com</code> for this site in any link.
          </p>
          <Link to="/login" className="btn btn-primary">
            Sign in with GitHub
          </Link>{' '}
          <Link to="/facebook/react" className="btn">
            Try a public repo
          </Link>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="section-title">Recent</h2>
          <ul className="list card-list">
            {recent.slice(0, 6).map((r) => (
              <li key={r.full_name}>
                <Link to={`/${r.full_name}`} className="list-row">
                  <Icon name="history" className="c-muted" />
                  <span className="grow">
                    <span className="row-title">{r.full_name}</span>
                    {r.description && <span className="small muted block ellipsis">{r.description}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {token && (
        <section>
          <div className="section-head">
            <h2 className="section-title">Your repositories</h2>
          </div>
          <input className="input" placeholder="Find a repository…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Async q={repos}>
            {(list) => {
              const shown = list.filter((r) => r.full_name.toLowerCase().includes(filter.toLowerCase()))
              return shown.length ? (
                <ul className="list card-list">
                  {shown.slice(0, filter ? 100 : 15).map((r) => (
                    <RepoRow key={r.id} repo={r} />
                  ))}
                </ul>
              ) : (
                <Empty>No repositories found.</Empty>
              )
            }}
          </Async>
        </section>
      )}
    </div>
  )
}
