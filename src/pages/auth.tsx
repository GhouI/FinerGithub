import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { finishLogin, setToken, startLogin, useToken } from '../lib/auth'
import { gh } from '../lib/github'
import { Spinner } from '../components/ui'

export function Login() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const token = useToken()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pat, setPat] = useState('')

  if (token) return <Navigate to={next} replace />

  const oauth = async () => {
    setBusy(true)
    setError(null)
    try {
      await startLogin(next)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const usePat = async () => {
    setBusy(true)
    setError(null)
    setToken(pat.trim())
    try {
      await gh('/user')
      navigate(next, { replace: true })
    } catch {
      setToken(null)
      setError('That token was not accepted by GitHub.')
      setBusy(false)
    }
  }

  return (
    <div className="page narrow">
      <div className="hero">
        <span className="brand-mark big" aria-hidden>
          FG
        </span>
        <h1>Sign in to FinerGithub</h1>
        <p className="muted">FinerGithub talks to GitHub directly from your device. Your token stays in this browser.</p>
      </div>
      <button className="btn btn-primary btn-block btn-lg" onClick={oauth} disabled={busy}>
        {busy ? 'Redirecting…' : 'Sign in with GitHub'}
      </button>
      {error && (
        <p className="c-danger small" role="alert">
          {error}
        </p>
      )}
      <details className="card">
        <summary>Use a personal access token instead</summary>
        <p className="small muted">
          Create a token at github.com → Settings → Developer settings. Scopes: <code>repo</code>, <code>notifications</code>, <code>workflow</code>, <code>read:org</code>.
        </p>
        <input className="input" type="password" placeholder="ghp_… or github_pat_…" value={pat} onChange={(e) => setPat(e.target.value)} autoComplete="off" />
        <button className="btn btn-block" disabled={!pat.trim() || busy} onClick={usePat}>
          Use token
        </button>
      </details>
      <p className="small muted center">You can also browse public repositories without signing in.</p>
    </div>
  )
}

export function OAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const code = params.get('code')
    const state = params.get('state')
    if (params.get('error')) {
      setError(params.get('error_description') || params.get('error'))
      return
    }
    if (!code || !state) {
      setError('Missing sign-in code.')
      return
    }
    finishLogin(code, state)
      .then((to) => navigate(to, { replace: true }))
      .catch((e) => setError(e.message))
  }, [params, navigate])

  if (!error) return <Spinner label="Signing you in…" />
  return (
    <div className="page narrow">
      <div className="error-box" role="alert">
        <strong>Sign-in failed</strong>
        <p>{error}</p>
        <button className="btn" onClick={() => navigate('/login', { replace: true })}>
          Try again
        </button>
      </div>
    </div>
  )
}
