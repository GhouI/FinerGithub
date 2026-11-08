import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToken } from '../lib/auth'
import { gh, useGhMutation, useGhPages } from '../lib/github'
import { toAppPath } from '../lib/links'
import { Icon } from '../components/Icon'
import { Avatar, Empty, ErrorBox, LoadMore, Spinner, Time } from '../components/ui'

const TYPE_ICON: Record<string, string> = { Issue: 'issue', PullRequest: 'pr', Release: 'tag', Commit: 'commit', CheckSuite: 'play', Discussion: 'comment' }

const REASON: Record<string, string> = {
  review_requested: 'Review requested',
  mention: 'Mentioned',
  team_mention: 'Team mentioned',
  assign: 'Assigned',
  author: 'Author',
  comment: 'Commented',
  subscribed: 'Subscribed',
  state_change: 'State changed',
  ci_activity: 'CI activity',
  manual: 'Subscribed',
  security_alert: 'Security alert',
  approval_requested: 'Approval requested',
}

function targetFor(n: any): string | null {
  if (n.subject.url) {
    const p = toAppPath(n.subject.url)
    if (p) return p
  }
  if (n.subject.type === 'CheckSuite') return `/${n.repository.full_name}/actions`
  if (n.subject.type === 'Release') return `/${n.repository.full_name}/releases`
  return `/${n.repository.full_name}`
}

export function Notifications() {
  const token = useToken()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'unread' | 'participating' | 'all'>('unread')
  const path = token ? `/notifications?${filter === 'all' ? 'all=true' : filter === 'participating' ? 'participating=true' : ''}` : null
  const list = useGhPages<any>(path, { perPage: 50 })
  const markAll = useGhMutation(() => gh('/notifications', { method: 'PUT', body: { read: true } }), ['/notifications'])
  const [done, setDone] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const g = new Map<string, any[]>()
    for (const n of list.data?.items ?? []) {
      if (filter !== 'all' && done.has(n.id)) continue
      const k = n.repository.full_name
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(n)
    }
    return [...g.entries()]
  }, [list.data, done, filter])

  if (!token) {
    return (
      <div className="page">
        <Empty>
          <Link to="/login?next=/notifications">Sign in</Link> to see your notifications.
        </Empty>
      </div>
    )
  }

  const markRead = async (n: any) => {
    setDone((s) => new Set(s).add(n.id))
    try {
      await gh(`/notifications/threads/${n.id}`, { method: 'PATCH' })
    } finally {
      qc.invalidateQueries({ queryKey: ['gh', '/notifications?per_page=50'] })
    }
  }

  return (
    <div className="page">
      <div className="section-head">
        <h1 className="page-title">Inbox</h1>
        {filter !== 'all' && grouped.length > 0 && (
          <button className="btn btn-sm" disabled={markAll.isPending} onClick={() => markAll.mutate(undefined, { onSuccess: () => setDone(new Set((list.data?.items ?? []).map((n) => n.id))) })}>
            <Icon name="check" size={14} /> Mark all read
          </button>
        )}
      </div>
      <div className="seg" role="tablist">
        {(['unread', 'participating', 'all'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
            {f === 'unread' ? 'Unread' : f === 'participating' ? 'Participating' : 'All'}
          </button>
        ))}
      </div>
      {list.error ? (
        <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <Spinner />
      ) : grouped.length === 0 ? (
        <Empty>All caught up.</Empty>
      ) : (
        grouped.map(([repo, items]) => (
          <section key={repo}>
            <h2 className="section-title row gap">
              <Avatar src={items[0].repository.owner.avatar_url} size={16} />
              <Link to={`/${repo}`}>{repo}</Link>
            </h2>
            <ul className="list card-list">
              {items.map((n) => (
                <li key={n.id} className={n.unread ? 'unread' : ''}>
                  <div className="list-row align-start">
                    <Icon name={TYPE_ICON[n.subject.type] ?? 'bell'} className={n.unread ? 'c-accent' : 'c-muted'} />
                    <button
                      className="grow text-left plain"
                      onClick={() => {
                        const to = targetFor(n)
                        if (n.unread) markRead(n)
                        if (to) navigate(to)
                      }}
                    >
                      <span className="row-title">{n.subject.title}</span>
                      <span className="small muted block">
                        {REASON[n.reason] ?? n.reason} · <Time iso={n.updated_at} />
                      </span>
                    </button>
                    {n.unread && (
                      <button className="icon-btn" onClick={() => markRead(n)} aria-label="Mark as read" title="Mark as read">
                        <Icon name="check" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <LoadMore q={list} />
    </div>
  )
}
