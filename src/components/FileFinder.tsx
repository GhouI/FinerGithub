import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGh } from '../lib/github'
import { Icon } from './Icon'
import { Sheet, Spinner } from './ui'

/** Scores how well `query` matches `path` as a subsequence; null when it doesn't match. */
function fuzzy(path: string, query: string): number | null {
  const p = path.toLowerCase()
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return 0
  let score = 0
  let pi = 0
  let last = -2
  for (const ch of q) {
    const idx = p.indexOf(ch, pi)
    if (idx === -1) return null
    score += idx === last + 1 ? 3 : 1
    if (idx === 0 || p[idx - 1] === '/' || p[idx - 1] === '.' || p[idx - 1] === '-' || p[idx - 1] === '_') score += 2
    last = idx
    pi = idx + 1
  }
  const base = p.slice(p.lastIndexOf('/') + 1)
  if (base.includes(q)) score += 10
  return score - p.length / 100
}

/** "Go to file" — the web's `t` file finder, for touch. */
export function FileFinder({ owner, repo, gitRef }: { owner: string; repo: string; gitRef: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const tree = useGh<any>(open ? `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(gitRef)}?recursive=1` : null)

  const results = useMemo(() => {
    const files: string[] = (tree.data?.tree ?? []).filter((t: any) => t.type === 'blob').map((t: any) => t.path)
    if (!query) return files.slice(0, 60)
    return files
      .map((f) => [f, fuzzy(f, query)] as const)
      .filter(([, s]) => s !== null)
      .sort((a, b) => b[1]! - a[1]!)
      .slice(0, 60)
      .map(([f]) => f)
  }, [tree.data, query])

  const go = (path: string) => {
    setOpen(false)
    navigate(`/${owner}/${repo}/blob/${encodeURIComponent(gitRef)}/${path}`)
  }

  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <Icon name="search" size={14} /> Go to file
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Go to file">
        <input
          className="input"
          placeholder="Type to find a file…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0])}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {tree.isLoading && <Spinner label="Loading file list…" />}
        {tree.data?.truncated && <p className="small muted">This repository is very large; some files may be missing.</p>}
        <ul className="list sheet-list">
          {results.map((f) => (
            <li key={f}>
              <button className="list-row" onClick={() => go(f)}>
                <Icon name="file" className="c-muted" />
                <span className="grow ellipsis-start" title={f}>
                  <span className="muted">{f.includes('/') ? f.slice(0, f.lastIndexOf('/') + 1) : ''}</span>
                  {f.slice(f.lastIndexOf('/') + 1)}
                </span>
              </button>
            </li>
          ))}
          {tree.data && results.length === 0 && <li className="muted pad">No matching files.</li>}
        </ul>
      </Sheet>
    </>
  )
}
