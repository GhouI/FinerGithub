import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toAppPath } from '../lib/links'

export interface MarkdownBase {
  owner: string
  repo: string
  ref: string
  /** Directory of the rendered file, used to resolve relative links and images. */
  dir: string
}

function resolveRelative(dir: string, href: string) {
  const parts = href.startsWith('/') ? [] : dir.split('/').filter(Boolean)
  for (const seg of href.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/')
}

const isRelative = (u: string) => !!u && !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u)

/**
 * Renders HTML produced and sanitized by the GitHub API (body_html, rendered READMEs).
 * GitHub links open inside the app; relative links and images resolve against the repo.
 */
export function Markdown({ html, base, className = '' }: { html: string; base?: MarkdownBase; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('rel', 'noopener noreferrer')
      if (!base) return
      const href = a.getAttribute('href')!
      if (isRelative(href)) {
        const [path, hash] = href.split('#')
        if (path) a.setAttribute('href', `https://github.com/${base.owner}/${base.repo}/blob/${base.ref}/${resolveRelative(base.dir, path)}${hash ? '#' + hash : ''}`)
      }
    })
    el.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy')
      const src = img.getAttribute('src') || ''
      if (base && isRelative(src)) {
        img.setAttribute('src', `https://raw.githubusercontent.com/${base.owner}/${base.repo}/${base.ref}/${resolveRelative(base.dir, src)}`)
      }
    })
    // Wide tables and code blocks scroll on their own instead of the page.
    el.querySelectorAll('table').forEach((t) => {
      if (!t.parentElement?.classList.contains('table-scroll')) {
        const wrap = document.createElement('div')
        wrap.className = 'table-scroll'
        t.replaceWith(wrap)
        wrap.appendChild(t)
      }
    })
  }, [html, base])

  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return
    const href = a.getAttribute('href') || ''
    if (href.startsWith('#')) return
    const app = toAppPath(a.href)
    if (app) {
      e.preventDefault()
      navigate(app)
    } else if (/^https?:/.test(a.href) && new URL(a.href).origin !== location.origin) {
      a.setAttribute('target', '_blank')
    }
  }

  return <div ref={ref} className={`markdown ${className}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
