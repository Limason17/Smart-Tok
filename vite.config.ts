import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app under /Smart-Tok/. Override with BASE_PATH for other hosts.
const base = process.env.BASE_PATH ?? '/Smart-Tok/';
const version = process.env.npm_package_version ?? '0.0.0';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Smart-Tok',
        short_name: 'Smart-Tok',
        description: 'Lernen im Swipe-Feed – Wissen statt Doomscrolling.',
        lang: 'de',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1013',
        theme_color: '#0f1013',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*', '**/news-archive/**'],
        navigateFallback: 'index.html',
        // Archived news (public/news-archive) is only fetched when a saved news card needs it.
        runtimeCaching: [
          {
            urlPattern: /\/news-archive\/\d{4}-\d{2}\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'news-archive' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
