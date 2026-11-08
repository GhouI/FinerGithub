import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setToken, useToken } from '../lib/auth'
import { useGh } from '../lib/github'
import { clearRecent, setPrefs, usePrefs } from '../lib/prefs'
import { parseJump } from '../lib/links'
import { Icon } from '../components/Icon'
import { Avatar } from '../components/ui'

export function Settings() {
  const token = useToken()
  const me = useGh<any>(token ? '/user' : null)
  const prefs = usePrefs()
  const qc = useQueryClient()
  const navigate = useNavigate()

  return (
    <div className="page narrow">
      <h1 className="page-title">Settings</h1>

      <section className="card">
        <h2>Account</h2>
        {token ? (
          <>
            {me.data && (
              <Link to={`/${me.data.login}`} className="row gap">
                <Avatar src={me.data.avatar_url} size={40} />
                <span>
                  <strong className="block">{me.data.name || me.data.login}</strong>
                  <span className="muted small">@{me.data.login}</span>
                </span>
              </Link>
            )}
            <button
              className="btn"
              onClick={() => {
                setToken(null)
                qc.clear()
                navigate('/')
              }}
            >
              <Icon name="logout" size={14} /> Sign out
            </button>
          </>
        ) : (
          <Link className="btn btn-primary" to="/login">
            Sign in with GitHub
          </Link>
        )}
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} role="radio" aria-checked={prefs.theme === t} aria-selected={prefs.theme === t} onClick={() => setPrefs({ theme: t })}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <label className="switch-row">
          <span>
            Wrap long lines in code and diffs
            <span className="small muted block">Off keeps lines intact and lets you scroll sideways, like the web.</span>
          </span>
          <input type="checkbox" checked={prefs.wrapCode} onChange={(e) => setPrefs({ wrapCode: e.target.checked })} />
        </label>
      </section>

      <section className="card">
        <h2>Open GitHub links here</h2>
        <p className="small muted">
          Every page in FinerGithub has the same path as on github.com. Replace <code>github.com</code> with <code>{location.host}</code> in any link, or use the <em>Share</em> menu on your phone and pick FinerGithub once it's installed.
        </p>
      </section>

      <section className="card">
        <h2>Data</h2>
        <button
          className="btn"
          onClick={() => {
            clearRecent()
            qc.clear()
          }}
        >
          Clear recent repos and cache
        </button>
      </section>
    </div>
  )
}

/** Target of the PWA share sheet and of manual "open this link" requests. */
export function OpenUrl() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const candidates = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean) as string[]
    for (const c of candidates) {
      for (const word of c.split(/\s+/)) {
        const to = parseJump(word)
        if (to) {
          navigate(to, { replace: true })
          return
        }
      }
    }
    if (candidates.length) setFailed(true)
  }, [params, navigate])

  return (
    <div className="page narrow">
      <h1 className="page-title">Open a GitHub link</h1>
      {failed && <p className="c-danger small">That link can't be opened in FinerGithub.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const to = parseJump(value)
          if (to) navigate(to)
          else setFailed(true)
        }}
      >
        <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://github.com/owner/repo/pull/1" autoFocus />
        <button className="btn btn-primary btn-block">Open</button>
      </form>
    </div>
  )
}
