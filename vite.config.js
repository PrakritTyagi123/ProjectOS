import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build` -> dist/ for Cloudflare Pages.
// `npm run build:single` -> one self-contained HTML file (used for the preview).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  // Local development against the agent on this PC (agent.yaml: dev_allow_local: true).
  server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8765' } },
}))
