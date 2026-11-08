import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getToken, setToken } from './auth'

export const API = 'https://api.github.com'
export const HTML = 'application/vnd.github.html+json'

export class GhError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface GhOptions {
  method?: string
  body?: unknown
  accept?: string
  /** Return the response body as text instead of JSON. */
  text?: boolean
}

export async function gh<T = any>(path: string, { method = 'GET', body, accept, text }: GhOptions = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(path.startsWith('http') ? path : API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!r.ok) {
    let message = r.statusText
    try {
      const data = await r.json()
      message = data.message || message
      if (data.errors?.length) message += ': ' + data.errors.map((e: any) => e.message || e.code || e).join(', ')
    } catch {
      /* not JSON */
    }
    if (r.status === 401 && token) {
      setToken(null)
      message = 'Your session expired. Please sign in again.'
    } else if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') {
      message = token ? 'GitHub rate limit reached. Try again in a few minutes.' : 'GitHub rate limit reached. Sign in to get a much higher limit.'
    }
    throw new GhError(r.status, message)
  }
  if (r.status === 204 || r.status === 205) return undefined as T
  if (text) return (await r.text()) as T
  const ct = r.headers.get('content-type') || ''
  return (ct.includes('json') ? r.json() : r.text()) as Promise<T>
}

/** Cached GET request. Pass `null` as path to disable. */
export function useGh<T = any>(path: string | null, opts: Omit<GhOptions, 'method' | 'body'> = {}, extra: { refetchInterval?: number | false } = {}) {
  return useQuery<T, GhError>({
    queryKey: ['gh', path, opts.accept ?? null],
    queryFn: () => gh<T>(path!, opts),
    enabled: !!path,
    ...extra,
  })
}

/** Paged GET for list endpoints. `select` extracts the items from each page (e.g. search results). */
export function useGhPages<T = any>(path: string | null, { perPage = 30, accept, select }: { perPage?: number; accept?: string; select?: (page: any) => T[] } = {}) {
  return useInfiniteQuery<any, GhError, { pages: any[]; items: T[]; total?: number }, any, number>({
    queryKey: ['ghp', path, perPage, accept ?? null],
    enabled: !!path,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => gh(`${path}${path!.includes('?') ? '&' : '?'}per_page=${perPage}&page=${pageParam}`, { accept }),
    getNextPageParam: (last, all) => {
      const items = select ? select(last) : last
      return Array.isArray(items) && items.length === perPage ? all.length + 1 : undefined
    },
    select: (data) => ({
      pages: data.pages,
      items: data.pages.flatMap((p) => (select ? select(p) : p)),
      total: data.pages[0]?.total_count,
    }),
  })
}

/** A write request that refreshes cached data whose key starts with any of `invalidate` paths. */
export function useGhMutation<V = any>(fn: (vars: V) => Promise<any>, invalidate: (string | null | undefined)[] = []) {
  const qc = useQueryClient()
  return useMutation<any, GhError, V>({
    mutationFn: fn,
    onSuccess: () =>
      qc.invalidateQueries({
        predicate: (q) => {
          const p = q.queryKey[1]
          return typeof p === 'string' && invalidate.some((prefix) => prefix && p.startsWith(prefix))
        },
      }),
  })
}

export const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/')

export function decodeBase64Utf8(b64: string): { text: string; bytes: Uint8Array } {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { text: new TextDecoder().decode(bytes), bytes }
}
