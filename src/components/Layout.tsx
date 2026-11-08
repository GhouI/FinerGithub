import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useToken } from '../lib/auth'
import { useGh } from '../lib/github'
import { githubUrl, supportedPath } from '../lib/links'
import { Icon } from './Icon'
import { Avatar } from './ui'

const ROOT_PAGES = ['/', '/search', '/notifications', '/settings']

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const token = useToken()
  const me = useGh<any>(token ? '/user' : null)
  const unread = useGh<any[]>(token ? '/notifications?per_page=50' : null, {}, { refetchInterval: 120_000 })
  const isRoot = ROOT_PAGES.includes(location.pathname)

  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname])

  const canOpenOnGithub = supportedPath(location.pathname) && !isRoot

  return (
    <div className="app">
      <header className="topbar">
        {isRoot ? (
          <Link to="/" className="brand" aria-label="FinerGithub home">
            <span className="brand-mark" aria-hidden>
              FG
            </span>
            <span>FinerGithub</span>
          </Link>
        ) : (
          <button className="icon-btn" onClick={() => (location.key === 'default' ? navigate('/') : navigate(-1))} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
        )}
        <div className="topbar-spacer" />
        {canOpenOnGithub && (
          <a className="icon-btn" href={githubUrl(location.pathname + location.search + location.hash)} target="_blank" rel="noreferrer" aria-label="Open on github.com" title="Open on github.com">
            <Icon name="external" size={18} />
          </a>
        )}
        {token && me.data ? (
          <Link to={`/${me.data.login}`} className="icon-btn" aria-label="Your profile">
            <Avatar src={me.data.avatar_url} size={24} />
          </Link>
        ) : !token ? (
          <Link to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} className="btn btn-sm btn-primary">
            Sign in
          </Link>
        ) : null}
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="Main">
        <NavLink to="/" end>
          <Icon name="home" size={22} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/search">
          <Icon name="search" size={22} />
          <span>Search</span>
        </NavLink>
        <NavLink to="/notifications">
          <span className="nav-icon">
            <Icon name="bell" size={22} />
            {!!unread.data?.length && <span className="nav-badge">{unread.data.length >= 50 ? '50+' : unread.data.length}</span>}
          </span>
          <span>Inbox</span>
        </NavLink>
        <NavLink to="/settings">
          <Icon name="settings" size={22} />
          <span>Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
