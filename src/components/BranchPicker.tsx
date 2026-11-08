import { useMemo, useState } from 'react'
import { useGh } from '../lib/github'
import { Icon } from './Icon'
import { Sheet, Spinner } from './ui'

/** Branch / tag switcher shown as a bottom sheet. */
export function BranchPicker({ owner, repo, current, defaultBranch, onPick }: { owner: string; repo: string; current: string; defaultBranch: string; onPick: (ref: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'branches' | 'tags'>('branches')
  const [filter, setFilter] = useState('')
  const branches = useGh<any[]>(open ? `/repos/${owner}/${repo}/branches?per_page=100` : null)
  const tags = useGh<any[]>(open && tab === 'tags' ? `/repos/${owner}/${repo}/tags?per_page=100` : null)
  const q = tab === 'branches' ? branches : tags

  const items = useMemo(() => {
    const names: string[] = (q.data ?? []).map((b) => b.name)
    if (tab === 'branches' && !names.includes(defaultBranch)) names.unshift(defaultBranch)
    const f = filter.toLowerCase()
    return names.filter((n) => n.toLowerCase().includes(f)).sort((a, b) => (a === defaultBranch ? -1 : b === defaultBranch ? 1 : 0))
  }, [q.data, filter, tab, defaultBranch])

  return (
    <>
      <button className="btn btn-sm branch-btn" onClick={() => setOpen(true)} title="Switch branches or tags">
        <Icon name="branch" size={14} />
        <span className="ellipsis">{current}</span>
        <Icon name="down" size={12} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Switch branches/tags">
        <input className="input" placeholder={tab === 'branches' ? 'Find a branch…' : 'Find a tag…'} value={filter} onChange={(e) => setFilter(e.target.value)} autoFocus />
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'branches'} onClick={() => setTab('branches')}>
            Branches
          </button>
          <button role="tab" aria-selected={tab === 'tags'} onClick={() => setTab('tags')}>
            Tags
          </button>
        </div>
        {q.isLoading ? (
          <Spinner />
        ) : (
          <ul className="list sheet-list">
            {items.map((name) => (
              <li key={name}>
                <button
                  className="list-row"
                  onClick={() => {
                    setOpen(false)
                    onPick(name)
                  }}
                >
                  <span className="check-slot">{name === current && <Icon name="check" size={14} />}</span>
                  <span className="grow ellipsis">{name}</span>
                  {name === defaultBranch && <span className="tag">default</span>}
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="muted pad">Nothing found.</li>}
          </ul>
        )}
      </Sheet>
    </>
  )
}
