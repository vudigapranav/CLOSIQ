import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { handleApiRequest } from './server/apiRouter.js'

// Delegates to the same /api/ai/* dispatch the production server
// (server/index.js) uses — see server/apiRouter.js for the one shared
// implementation of request parsing, routing, and error handling.
function geminiApiPlugin() {
  return {
    name: 'gemini-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRequest(req, res)
        if (!handled) next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_-prefixed vars, and only to client code via
  // import.meta.env — it does NOT populate process.env for server-side code
  // (this plugin, server/geminiServer.js) from a .env file on its own. Load
  // the project .env explicitly (no VITE_ prefix filter) and merge it into
  // process.env so `GEMINI_API_KEY` reaches the server in `npm run dev` the
  // same way `--env-file-if-exists` does for `npm run start`.
  const env = loadEnv(mode, process.cwd(), '')
  process.env = { ...process.env, ...env }

  return {
    plugins: [
      react(),
      geminiApiPlugin(),
      {
        name: 'remove-test-samples-from-dist',
        closeBundle() {
          const target = path.resolve(import.meta.dirname, 'dist/test samples')
          if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true })
          }
        }
      }
    ],
  }
})
