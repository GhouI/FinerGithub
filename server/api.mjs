// Small API surface that the browser cannot do on its own:
//  1. Exchange an OAuth `code` for an access token (needs the client secret).
//  2. Download GitHub Actions job logs (the redirect target has no CORS headers).
// Used both by the Vite dev server (vite.config.ts) and the production server (server/index.mjs).

export const OAUTH_SCOPES = 'repo read:org notifications workflow user'

const UA = 'FinerGithub'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('Request body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export function createApiHandler(env = process.env) {
  const clientId = env.GITHUB_CLIENT_ID || ''
  const clientSecret = env.GITHUB_CLIENT_SECRET || ''

  return async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')
    try {
      if (req.method === 'GET' && url.pathname === '/api/oauth/config') {
        return json(res, 200, { clientId: clientId || null, scopes: OAUTH_SCOPES })
      }

      if (req.method === 'POST' && url.pathname === '/api/oauth/token') {
        if (!clientId || !clientSecret) {
          return json(res, 501, { error: 'OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' })
        }
        const body = await readJson(req)
        if (typeof body.code !== 'string' || !body.code) return json(res, 400, { error: 'Missing code' })
        const r = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: body.code,
            ...(typeof body.redirect_uri === 'string' ? { redirect_uri: body.redirect_uri } : {}),
          }),
        })
        const data = await r.json().catch(() => ({}))
        if (!r.ok || data.error || !data.access_token) {
          return json(res, 400, { error: data.error_description || data.error || 'Token exchange failed' })
        }
        return json(res, 200, { access_token: data.access_token, scope: data.scope, token_type: data.token_type })
      }

      const logs = url.pathname.match(/^\/api\/logs\/([\w.-]+)\/([\w.-]+)\/(\d+)$/)
      if (req.method === 'GET' && logs) {
        const [, owner, repo, jobId] = logs
        const auth = req.headers.authorization
        // fetch() drops the Authorization header when following the cross-origin redirect to log storage.
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': UA,
            ...(auth ? { Authorization: auth } : {}),
          },
          redirect: 'follow',
        })
        res.statusCode = r.status
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Cache-Control', 'private, no-store')
        res.end(await r.text())
        return
      }

      json(res, 404, { error: 'Not found' })
    } catch (e) {
      json(res, 502, { error: e instanceof Error ? e.message : String(e) })
    }
  }
}
