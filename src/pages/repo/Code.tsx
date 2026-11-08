import { useEffect, useMemo } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { decodeBase64Utf8, enc, HTML, useGh } from '../../lib/github'
import { highlightLines } from '../../lib/highlight'
import { bytes, firstLine, shortSha } from '../../lib/format'
import { usePrefs, setPrefs } from '../../lib/prefs'
import { githubUrl } from '../../lib/links'
import { Icon } from '../../components/Icon'
import { Markdown } from '../../components/Markdown'
import { BranchPicker } from '../../components/BranchPicker'
import { FileFinder } from '../../components/FileFinder'
import { Async, Avatar, CopyButton, Empty, ErrorBox, Spinner, Time } from '../../components/ui'
import { useRepo } from './RepoLayout'

const README = /^readme(\.(md|markdown|mdx|rst|txt|adoc|org))?$/i
const RENDERABLE = /\.(md|markdown|mdx|rst|adoc|org|textile)$/i
const IMAGE = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i
const SVG = /\.svg$/i

function useRefAndPath() {
  const { repo } = useRepo()
  const params = useParams()
  const ref = params.ref ? decodeURIComponent(params.ref) : repo.default_branch
  const path = (params['*'] ?? '').replace(/\/$/, '')
  return { ref, path }
}

function Breadcrumbs({ owner, name, gitRef, path, isFile }: { owner: string; name: string; gitRef: string; path: string; isFile?: boolean }) {
  const parts = path ? path.split('/') : []
  const r = encodeURIComponent(gitRef)
  return (
    <nav className="crumbs" aria-label="Path">
      <Link to={`/${owner}/${name}/tree/${r}`}>{name}</Link>
      {parts.map((p, i) => {
        const sub = parts.slice(0, i + 1).join('/')
        const last = i === parts.length - 1
        return (
          <span key={sub}>
            <span className="muted">/</span>
            {last ? <strong>{p}</strong> : <Link to={`/${owner}/${name}/${isFile && last ? 'blob' : 'tree'}/${r}/${sub}`}>{p}</Link>}
          </span>
        )
      })}
    </nav>
  )
}

function LastCommit({ owner, name, gitRef, path }: { owner: string; name: string; gitRef: string; path: string }) {
  const q = useGh<any[]>(`/repos/${owner}/${name}/commits?sha=${encodeURIComponent(gitRef)}&path=${encodeURIComponent(path)}&per_page=1`)
  const c = q.data?.[0]
  if (!c) return <div className="last-commit muted small">{q.isLoading ? 'Loading latest commit…' : ''}</div>
  return (
    <div className="last-commit">
      <Avatar src={c.author?.avatar_url} size={18} />
      <Link to={`/${owner}/${name}/commit/${c.sha}`} className="grow ellipsis small">
        <strong>{c.author?.login ?? c.commit.author.name}</strong> {firstLine(c.commit.message)}
      </Link>
      <span className="small muted nowrap">
        <code>{shortSha(c.sha)}</code> · <Time iso={c.commit.author.date} />
      </span>
      <Link to={`/${owner}/${name}/commits/${encodeURIComponent(gitRef)}${path ? '/' + path : ''}`} className="icon-btn" aria-label="History" title="History">
        <Icon name="history" />
      </Link>
    </div>
  )
}

function Toolbar({ path, isFile }: { path: string; isFile?: boolean }) {
  const { repo, owner, name } = useRepo()
  const { ref } = useRefAndPath()
  const navigate = useNavigate()
  return (
    <div className="toolbar">
      <BranchPicker
        owner={owner}
        repo={name}
        current={ref}
        defaultBranch={repo.default_branch}
        onPick={(r) => navigate(`/${owner}/${name}/${isFile ? 'blob' : 'tree'}/${encodeURIComponent(r)}${path ? '/' + path : ''}`)}
      />
      <FileFinder owner={owner} repo={name} gitRef={ref} />
    </div>
  )
}

export function CodeView() {
  const { owner, name } = useRepo()
  const { ref, path } = useRefAndPath()
  const contents = useGh<any>(`/repos/${owner}/${name}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`)
  const readme = useMemo(() => (Array.isArray(contents.data) ? contents.data.find((f: any) => f.type === 'file' && README.test(f.name)) : null), [contents.data])
  const readmeHtml = useGh<string>(readme ? `/repos/${owner}/${name}/contents/${enc(readme.path)}?ref=${encodeURIComponent(ref)}` : null, { accept: HTML, text: true })

  if (contents.data && !Array.isArray(contents.data)) {
    return <Navigate to={`/${owner}/${name}/blob/${encodeURIComponent(ref)}/${path}`} replace />
  }
  if ((contents.error as any)?.status === 404 && !path) {
    return <Empty>This repository is empty.</Empty>
  }

  const items = Array.isArray(contents.data)
    ? [...contents.data].sort((a, b) => (a.type === 'dir') === (b.type === 'dir') ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.type === 'dir' ? -1 : 1)
    : []

  return (
    <div>
      <Toolbar path={path} />
      {path && <Breadcrumbs owner={owner} name={name} gitRef={ref} path={path} />}
      <div className="card flush">
        <LastCommit owner={owner} name={name} gitRef={ref} path={path} />
        {contents.error ? (
          <ErrorBox error={contents.error} onRetry={() => contents.refetch()} />
        ) : contents.isLoading ? (
          <Spinner />
        ) : (
          <ul className="list tree">
            {path && (
              <li>
                <Link className="list-row" to={`/${owner}/${name}/tree/${encodeURIComponent(ref)}/${path.split('/').slice(0, -1).join('/')}`}>
                  <Icon name="folder" className="c-muted" />
                  <span className="grow">..</span>
                </Link>
              </li>
            )}
            {items.map((f: any) => {
              const r = encodeURIComponent(ref)
              const to = f.type === 'dir' ? `/${owner}/${name}/tree/${r}/${f.path}` : f.type === 'submodule' && f.submodule_git_url ? null : `/${owner}/${name}/blob/${r}/${f.path}`
              const body = (
                <>
                  <Icon name={f.type === 'dir' ? 'folder' : f.type === 'submodule' ? 'link' : 'file'} className={f.type === 'dir' ? 'c-accent' : 'c-muted'} />
                  <span className="grow ellipsis">{f.name}</span>
                  {f.type === 'file' && <span className="small muted">{bytes(f.size)}</span>}
                </>
              )
              return <li key={f.sha + f.name}>{to ? <Link className="list-row" to={to}>{body}</Link> : <span className="list-row">{body}</span>}</li>
            })}
          </ul>
        )}
      </div>
      {readme && (
        <article className="card readme">
          <div className="card-title">
            <Icon name="list" size={14} /> {readme.name}
          </div>
          <Async q={readmeHtml} label="Rendering README…">
            {(html) => <Markdown html={html} base={{ owner, repo: name, ref, dir: path }} />}
          </Async>
        </article>
      )}
    </div>
  )
}

function parseLineHash(hash: string): [number, number] | null {
  const m = hash.match(/^#L(\d+)(?:-L(\d+))?$/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return [Math.min(a, b), Math.max(a, b)]
}

export function BlobView() {
  const { owner, name } = useRepo()
  const { ref, path } = useRefAndPath()
  const location = useLocation()
  const navigate = useNavigate()
  const { wrapCode } = usePrefs()
  const params = new URLSearchParams(location.search)
  const renderable = RENDERABLE.test(path)
  const showSource = !renderable || params.get('plain') === '1'
  const file = useGh<any>(`/repos/${owner}/${name}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`)
  const rendered = useGh<string>(renderable && !showSource ? `/repos/${owner}/${name}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}` : null, { accept: HTML, text: true })

  const decoded = useMemo(() => {
    const d = file.data
    if (!d || Array.isArray(d) || d.encoding !== 'base64' || typeof d.content !== 'string') return null
    return decodeBase64Utf8(d.content)
  }, [file.data])
  const isImage = IMAGE.test(path) || (SVG.test(path) && !showSource)
  const isBinary = !!decoded && !isImage && decoded.bytes.subarray(0, 8000).includes(0)
  const lines = useMemo(() => (decoded && !isBinary && !isImage && showSource ? highlightLines(decoded.text.replace(/\n$/, ''), path) : []), [decoded, isBinary, isImage, showSource, path])
  const range = parseLineHash(location.hash)

  useEffect(() => {
    if (range && lines.length) document.getElementById(`L${range[0]}`)?.scrollIntoView({ block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, location.hash])

  if (Array.isArray(file.data)) return <Navigate to={`/${owner}/${name}/tree/${encodeURIComponent(ref)}/${path}`} replace />

  // Tap a line to select it; tap a second line to extend the selection into a range (like shift-click on the web).
  const selectLine = (n: number) => {
    const extend = range && range[0] === range[1] && range[0] !== n
    const next = extend ? `#L${Math.min(range[0], n)}-L${Math.max(range[0], n)}` : `#L${n}`
    navigate({ search: location.search, hash: next }, { replace: true })
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${name}/${ref}/${path}`
  const webUrl = githubUrl(`/${owner}/${name}/blob/${ref}/${path}${location.hash}`)

  return (
    <div>
      <Toolbar path={path} isFile />
      <Breadcrumbs owner={owner} name={name} gitRef={ref} path={path} isFile />
      <div className="card flush">
        <LastCommit owner={owner} name={name} gitRef={ref} path={path} />
        <div className="file-bar">
          {renderable && (
            <div className="seg compact" role="tablist">
              <button role="tab" aria-selected={!showSource} onClick={() => navigate({ search: '' })}>
                Preview
              </button>
              <button role="tab" aria-selected={showSource} onClick={() => navigate({ search: '?plain=1' })}>
                Code
              </button>
            </div>
          )}
          <span className="small muted grow">
            {lines.length > 0 && `${lines.length} lines · `}
            {file.data && bytes(file.data.size)}
          </span>
          {showSource && lines.length > 0 && (
            <button className={`icon-btn ${wrapCode ? 'is-on' : ''}`} onClick={() => setPrefs({ wrapCode: !wrapCode })} aria-pressed={wrapCode} aria-label="Wrap lines" title="Wrap lines">
              <Icon name="wrap" />
            </button>
          )}
          {decoded && !isBinary && <CopyButton text={decoded.text} />}
          <CopyButton text={webUrl} label="Link" />
          <a className="btn btn-sm" href={rawUrl} target="_blank" rel="noreferrer">
            Raw
          </a>
        </div>
        {file.error ? (
          <ErrorBox error={file.error} onRetry={() => file.refetch()} />
        ) : file.isLoading ? (
          <Spinner />
        ) : isImage ? (
          <div className="image-view">
            <img src={decoded ? `data:${SVG.test(path) ? 'image/svg+xml' : 'image/' + path.split('.').pop()!.replace('jpg', 'jpeg')};base64,${file.data.content.replace(/\s/g, '')}` : file.data.download_url} alt={path} />
          </div>
        ) : !decoded ? (
          <Empty>
            This file is too large to show here. <a href={rawUrl}>View raw</a>
          </Empty>
        ) : isBinary ? (
          <Empty>
            Binary file not shown. <a href={rawUrl}>Download</a>
          </Empty>
        ) : !showSource ? (
          <div className="pad">
            <Async q={rendered} label="Rendering…">
              {(html) => <Markdown html={html} base={{ owner, repo: name, ref, dir: path.split('/').slice(0, -1).join('/') }} />}
            </Async>
          </div>
        ) : (
          <div className={`blob hljs ${wrapCode ? 'wrap' : ''}`}>
            {lines.map((html, i) => {
              const n = i + 1
              const sel = range && n >= range[0] && n <= range[1]
              return (
                <div key={i} id={`L${n}`} className={`blob-line ${sel ? 'sel' : ''}`}>
                  <a
                    className="ln"
                    href={`#L${n}`}
                    onClick={(e) => {
                      e.preventDefault()
                      selectLine(n)
                    }}
                  >
                    {n}
                  </a>
                  <span className="code" dangerouslySetInnerHTML={{ __html: html || ' ' }} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {range && (
        <div className="floating-bar">
          <span className="small grow">
            {range[0] === range[1] ? `Line ${range[0]}` : `Lines ${range[0]}–${range[1]}`}
            {range[0] === range[1] && <span className="muted block">Tap another line for a range</span>}
          </span>
          <CopyButton text={webUrl} label="Copy link" />
          <button className="btn btn-sm" onClick={() => navigate({ search: location.search, hash: '' }, { replace: true })}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
