import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

import {
  handleAnalyzeGarmentServer,
  handleGenerateOutfitServer,
  handleSwapGarmentServer
} from './server/geminiServer.ts'

function geminiApiPlugin() {
  return {
    name: 'gemini-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ai/')) return next()

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })

        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const json = body ? JSON.parse(body) : {}

            if (req.url === '/api/ai/analyze-garment') {
              const result = await handleAnalyzeGarmentServer(json)
              return res.end(JSON.stringify(result))
            }

            if (req.url === '/api/ai/generate-outfit') {
              const result = await handleGenerateOutfitServer(json)
              return res.end(JSON.stringify(result))
            }

            if (req.url === '/api/ai/swap-garment') {
              const result = await handleSwapGarmentServer(json)
              return res.end(JSON.stringify(result))
            }

            res.statusCode = 404
            return res.end(JSON.stringify({ ok: false, error: 'Endpoint not found' }))
          } catch (err) {
            console.error('[API Middleware Error]:', err?.message || err)
            res.statusCode = 500
            return res.end(JSON.stringify({ ok: false, error: 'Server error processing request' }))
          }
        })
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
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
})
