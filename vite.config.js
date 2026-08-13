import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
