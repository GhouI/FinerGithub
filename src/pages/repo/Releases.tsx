import { Link } from 'react-router-dom'
import { HTML, useGhPages } from '../../lib/github'
import { bytes, compact } from '../../lib/format'
import { Icon } from '../../components/Icon'
import { Markdown } from '../../components/Markdown'
import { Async, Avatar, Empty, LoadMore, Time } from '../../components/ui'
import { useRepo } from './RepoLayout'

export function Releases() {
  const { owner, name } = useRepo()
  const releases = useGhPages<any>(`/repos/${owner}/${name}/releases`, { perPage: 10, accept: HTML })

  return (
    <Async q={{ ...releases, data: releases.data?.items }}>
      {(items) =>
        items.length ? (
          <div>
            {items.map((r: any, i: number) => (
              <article key={r.id} className="card release">
                <header>
                  <h2>{r.name || r.tag_name}</h2>
                  <div className="row gap wrap small">
                    {i === 0 && !r.prerelease && !r.draft && <span className="badge badge-success">Latest</span>}
                    {r.prerelease && <span className="badge badge-attention">Pre-release</span>}
                    {r.draft && <span className="badge badge-muted">Draft</span>}
                    <Link to={`/${owner}/${name}/tree/${encodeURIComponent(r.tag_name)}`} className="branch-pill">
                      <Icon name="tag" size={12} /> {r.tag_name}
                    </Link>
                    <span className="muted row gap-xs">
                      <Avatar src={r.author?.avatar_url} size={16} /> {r.author?.login} · <Time iso={r.published_at ?? r.created_at} />
                    </span>
                  </div>
                </header>
                {r.body_html && <Markdown html={r.body_html} base={{ owner, repo: name, ref: r.tag_name, dir: '' }} />}
                {r.assets?.length > 0 && (
                  <details>
                    <summary>Assets ({r.assets.length + 2})</summary>
                    <ul className="list">
                      {r.assets.map((a: any) => (
                        <li key={a.id}>
                          <a className="list-row" href={a.browser_download_url} rel="noreferrer">
                            <Icon name="download" className="c-muted" />
                            <span className="grow ellipsis">{a.name}</span>
                            <span className="small muted nowrap">
                              {bytes(a.size)} · {compact(a.download_count)}↓
                            </span>
                          </a>
                        </li>
                      ))}
                      <li>
                        <a className="list-row" href={r.zipball_url}>
                          <Icon name="download" className="c-muted" /> <span className="grow">Source code (zip)</span>
                        </a>
                      </li>
                      <li>
                        <a className="list-row" href={r.tarball_url}>
                          <Icon name="download" className="c-muted" /> <span className="grow">Source code (tar.gz)</span>
                        </a>
                      </li>
                    </ul>
                  </details>
                )}
              </article>
            ))}
            <LoadMore q={releases} />
          </div>
        ) : (
          <Empty>No releases yet.</Empty>
        )
      }
    </Async>
  )
}
