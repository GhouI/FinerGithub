import hljs from 'highlight.js/lib/common'

const ALIASES: Record<string, string> = {
  mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  yml: 'yaml', md: 'markdown', mdx: 'markdown', h: 'c', hpp: 'cpp', cc: 'cpp', cs: 'csharp', rs: 'rust',
  kt: 'kotlin', kts: 'kotlin', py: 'python', rb: 'ruby', sh: 'bash', zsh: 'bash', ps1: 'powershell',
  vue: 'xml', svelte: 'xml', html: 'xml', htm: 'xml', svg: 'xml', toml: 'ini', gradle: 'groovy', tf: 'ini',
}

const NAMES: Record<string, string> = { dockerfile: 'dockerfile', makefile: 'makefile', gemfile: 'ruby', rakefile: 'ruby' }

export function languageFor(filename: string): string | null {
  const base = filename.split('/').pop()!.toLowerCase()
  if (NAMES[base]) return hljs.getLanguage(NAMES[base]) ? NAMES[base] : null
  const ext = base.includes('.') ? base.split('.').pop()! : ''
  const lang = ALIASES[ext] || ext
  return lang && hljs.getLanguage(lang) ? lang : null
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Highlights code and returns one HTML string per line. Spans that cross line breaks
 * (block comments, template strings) are closed at the end of each line and reopened on the next.
 */
export function highlightLines(code: string, filename: string, maxBytes = 300_000): string[] {
  const lang = code.length <= maxBytes ? languageFor(filename) : null
  if (!lang) return code.split('\n').map(escapeHtml)
  let html: string
  try {
    html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
  } catch {
    return code.split('\n').map(escapeHtml)
  }
  const lines: string[] = []
  const open: string[] = []
  let cur = ''
  const re = /(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m[1]) {
      open.push(m[1])
      cur += m[1]
    } else if (m[2]) {
      open.pop()
      cur += m[2]
    } else if (m[3]) {
      lines.push(cur + '</span>'.repeat(open.length))
      cur = open.join('')
    } else cur += m[4]
  }
  lines.push(cur + '</span>'.repeat(open.length))
  return lines
}
