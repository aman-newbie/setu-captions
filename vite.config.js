import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Base path matches the GitHub Pages project URL: https://<user>.github.io/setu-captions/
const BASE = '/setu-captions/';

export default defineConfig({
  base: BASE,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
      manifest: {
        name: 'Setu Captions',
        short_name: 'Setu',
        description:
          'Free, private, on-device caption generator for Hindi, English and Hinglish video.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#0F1115',
        theme_color: '#0F1115',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          {
            src: 'icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('huggingface.co') || url.hostname.endsWith('hf.co'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'setu-whisper-model-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('jsdelivr.net'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'setu-onnxruntime-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  worker: {
    format: 'es'
  },
  build: {
    target: 'esnext'
  },
  test: {
    environment: 'node'
  }
});
