import { useSyncExternalStore } from 'react'

const TOKEN_KEY = 'fg.token'
const OAUTH_KEY = 'fg.oauth'

function read(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let token = read()
const listeners = new Set<() => void>()

export function getToken() {
  return token
}

export function setToken(next: string | null) {
  token = next
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: keep the token in memory for this tab */
  }
  listeners.forEach((l) => l())
}

export function useToken() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => token,
  )
}

function randomState() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const redirectUri = () => `${location.origin}/oauth/callback`

/** Sends the browser to GitHub's OAuth consent screen. */
export async function startLogin(returnTo = '/') {
  const r = await fetch('/api/oauth/config')
  if (!r.ok) throw new Error('Could not reach the FinerGithub server.')
  const cfg = (await r.json()) as { clientId: string | null; scopes: string }
  if (!cfg.clientId) {
    throw new Error('OAuth is not configured on this server. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or use a personal access token.')
  }
  const state = randomState()
  sessionStorage.setItem(OAUTH_KEY, JSON.stringify({ state, returnTo }))
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(),
    scope: cfg.scopes,
    state,
  })
  location.assign(`https://github.com/login/oauth/authorize?${params}`)
}

/** Completes the OAuth flow on /oauth/callback. Returns the path to go back to. */
export async function finishLogin(code: string, state: string): Promise<string> {
  const saved = JSON.parse(sessionStorage.getItem(OAUTH_KEY) || 'null') as { state: string; returnTo: string } | null
  sessionStorage.removeItem(OAUTH_KEY)
  if (!saved || saved.state !== state) throw new Error('Sign-in state did not match. Please try again.')
  const r = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri() }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.access_token) throw new Error(data.error || 'Sign-in failed')
  setToken(data.access_token)
  return saved.returnTo || '/'
}
