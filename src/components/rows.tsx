import { Link } from 'react-router-dom'
import { compact } from '../lib/format'
import { Icon } from './Icon'
import { Avatar, IssueStateIcon, LabelChip, Time } from './ui'

const repoFromUrl = (url: string) => url.replace('https://api.github.com/repos/', '')

/** One issue or pull request in a list (works for search results and REST list items). */
export function IssueRow({ item, showRepo }: { item: any; showRepo?: boolean }) {
  const repo = repoFromUrl(item.repository_url ?? item.base?.repo?.url ?? '')
  const isPr = !!item.pull_request || !!item.head
  const to = `/${repo}/${isPr ? 'pull' : 'issues'}/${item.number}`
  return (
    <li>
      <Link to={to} className="list-row align-start">
        <IssueStateIcon item={item} />
        <span className="grow">
          {showRepo && <span className="small muted block">{repo}</span>}
          <span className="row-title">{item.title}</span>
          {item.labels?.length > 0 && (
            <span className="labels">
              {item.labels.map((l: any) => (
                <LabelChip key={l.id ?? l.name} label={l} />
              ))}
            </span>
          )}
          <span className="small muted block">
            #{item.number} · {item.user?.login} · <Time iso={item.state === 'open' ? item.created_at : item.closed_at ?? item.updated_at} />
            {item.draft ? ' · Draft' : ''}
          </span>
        </span>
        {item.comments > 0 && (
          <span className="small muted nowrap">
            <Icon name="comment" size={14} /> {item.comments}
          </span>
        )}
      </Link>
    </li>
  )
}

export function RepoRow({ repo }: { repo: any }) {
  return (
    <li>
      <Link to={`/${repo.full_name}`} className="list-row align-start">
        <Avatar src={repo.owner?.avatar_url} size={20} />
        <span className="grow">
          <span className="row-title">{repo.full_name}</span>
          {repo.private && <span className="tag"> Private</span>}
          {repo.fork && <span className="tag"> Fork</span>}
          {repo.archived && <span className="tag"> Archived</span>}
          {repo.description && <span className="small muted block clamp-2">{repo.description}</span>}
          <span className="small muted block">
            {repo.language && <>{repo.language} · </>}
            <Icon name="star" size={12} /> {compact(repo.stargazers_count)}
            {repo.pushed_at && (
              <>
                {' '}
                · Updated <Time iso={repo.pushed_at} />
              </>
            )}
          </span>
        </span>
      </Link>
    </li>
  )
}
