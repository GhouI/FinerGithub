import { useSyncExternalStore } from 'react'

export interface Prefs {
  theme: 'system' | 'light' | 'dark'
  wrapCode: boolean
}

const KEY = 'fg.prefs'
const defaults: Prefs = { theme: 'system', wrapCode: false }

function load(): Prefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return defaults
  }
}

let prefs = load()
const listeners = new Set<() => void>()

function apply() {
  const root = document.documentElement
  if (prefs.theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', prefs.theme)
}
apply()

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  apply()
  listeners.forEach((l) => l())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs,
  )
}

// ---- Recently visited repositories (shown on Home) ----

const RECENT_KEY = 'fg.recent'

export interface RecentRepo {
  full_name: string
  description?: string | null
  ts: number
}

export function getRecent(): RecentRepo[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}

export function pushRecent(repo: { full_name: string; description?: string | null }) {
  const list = [{ full_name: repo.full_name, description: repo.description, ts: Date.now() }, ...getRecent().filter((r) => r.full_name.toLowerCase() !== repo.full_name.toLowerCase())].slice(0, 12)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {
    /* ignore */
  }
}

// ---- "Viewed" files in a pull request, like the web's checkbox ----

const viewedKey = (pr: string) => `fg.viewed.${pr}`

export function getViewed(pr: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(viewedKey(pr)) || '{}')
  } catch {
    return {}
  }
}

export function setViewed(pr: string, map: Record<string, string>) {
  try {
    localStorage.setItem(viewedKey(pr), JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
