// FinerGithub uses the same URL paths as github.com, so a GitHub link maps to an app route by
// swapping the host. These helpers decide which github.com / api.github.com URLs the app can show.

const RESERVED = new Set([
  'about', 'apps', 'codespaces', 'collections', 'contact', 'customer-stories', 'dashboard', 'enterprise',
  'events', 'explore', 'features', 'github-copilot', 'issues', 'login', 'logout', 'marketplace', 'new',
  'organizations', 'orgs', 'pricing', 'pulls', 'readme', 'security', 'settings', 'site', 'sponsors',
  'stars', 'topics', 'trending', 'user-attachments', 'users', 'watching', 'join', 'signup', 'copilot',
])

const REPO_SECTIONS = new Set(['tree', 'blob', 'issues', 'pulls', 'pull', 'commits', 'commit', 'actions', 'releases'])

/** Maps a path like /owner/repo/pull/3/files to itself if the app supports it, else null. */
export function supportedPath(pathname: string): boolean {
  const seg = pathname.split('/').filter(Boolean)
  if (seg.length === 0) return true
  if (seg[0] === 'notifications' || seg[0] === 'search') return seg.length === 1
  if (RESERVED.has(seg[0].toLowerCase())) return false
  if (seg.length <= 2) return true
  if (!REPO_SECTIONS.has(seg[2])) return false
  if (seg[2] === 'actions') return seg.length === 3 || (seg[3] === 'runs' && seg.length <= 7)
  if (seg[2] === 'releases') return seg.length === 3
  if (seg[2] === 'pull') return seg.length === 4 || (seg.length === 5 && ['files', 'commits'].includes(seg[4]))
  return true
}

/** Turns any GitHub URL (web or API) into an in-app path, or null if the app can't show it. */
export function toAppPath(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'api.github.com') {
    const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/(issues|pulls|commits|releases|actions\/runs)\/?([^/]*)/)
    if (!m) return null
    const [, o, r, kind, id] = m
    if (kind === 'issues') return `/${o}/${r}/issues/${id}`
    if (kind === 'pulls') return `/${o}/${r}/pull/${id}`
    if (kind === 'commits') return `/${o}/${r}/commit/${id}`
    if (kind === 'actions/runs') return `/${o}/${r}/actions/runs/${id}`
    return `/${o}/${r}/releases`
  }
  if (host !== 'github.com') return null
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (!supportedPath(path)) return null
  return path + url.search + url.hash
}

/** Accepts "owner/repo", a GitHub URL, or "owner/repo#123" and returns an app path. */
export function parseJump(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const fromUrl = toAppPath(s.startsWith('github.com') ? `https://${s}` : s)
  if (fromUrl) return fromUrl
  const m = s.match(/^([\w.-]+)\/([\w.-]+)(?:#(\d+))?$/)
  if (m) return m[3] ? `/${m[1]}/${m[2]}/issues/${m[3]}` : `/${m[1]}/${m[2]}`
  return null
}

export const githubUrl = (appPath: string) => `https://github.com${appPath}`
