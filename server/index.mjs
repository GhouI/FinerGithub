// Production server: serves the built PWA from dist/ and the /api endpoints. No dependencies.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './api.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const dist = join(root, 'dist')
const port = Number(process.env.PORT || 8787)
const api = createApiHandler(process.env)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function sendFile(res, file, cache) {
  const body = await readFile(file)
  res.statusCode = 200
  res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream')
  res.setHeader('Cache-Control', cache)
  res.end(body)
}

createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname.startsWith('/api/')) return api(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return res.end()
  }
  try {
    const file = normalize(join(dist, decodeURIComponent(url.pathname)))
    if (file.startsWith(dist + sep) && (await stat(file).catch(() => null))?.isFile()) {
      const immutable = url.pathname.startsWith('/assets/')
      return await sendFile(res, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache')
    }
    // Single-page app: every other path renders the app shell.
    await sendFile(res, join(dist, 'index.html'), 'no-cache')
  } catch {
    res.statusCode = 500
    res.end('Server error. Did you run `npm run build`?')
  }
}).listen(port, () => console.log(`FinerGithub running on http://localhost:${port}`))
