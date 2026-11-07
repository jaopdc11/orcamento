import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// base relativa → funciona no subcaminho do GitHub Pages sem saber o nome do repo.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Orçamento',
        short_name: 'Orçamento',
        description: 'Orçamento conjunto do mês. Lança em 3 toques, funciona sem sinal.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#060910',
        theme_color: '#060910',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // o app shell é cacheado; os dados NUNCA são — quem cuida do offline de
        // dados é a fila em src/lib/fila.ts, não o service worker.
        navigateFallback: 'index.html',
        runtimeCaching: [],
        // Push (F8): o SW gerado importa o handler escrito à mão em public/.
        importScripts: ['push-sw.js'],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
