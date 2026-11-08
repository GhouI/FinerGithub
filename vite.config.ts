import { defineConfig, loadEnv, type Connect } from 'vite'
import react from '@vitejs/plugin-react'
// Plain ESM module shared with the production server (server/index.mjs).
import { createApiHandler } from './server/api.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const handle = createApiHandler(env)
  const mount = (middlewares: Connect.Server) => {
    middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? handle(req, res) : next()))
  }
  return {
    plugins: [
      react(),
      {
        name: 'finergithub-api',
        configureServer: (server) => mount(server.middlewares),
        configurePreviewServer: (server) => mount(server.middlewares),
      },
    ],
    build: { chunkSizeWarningLimit: 1200 },
  }
})
