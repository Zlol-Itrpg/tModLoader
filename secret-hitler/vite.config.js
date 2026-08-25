import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from the domain root. Deploying under a subpath (a GitHub Pages
// project site, say) means setting `base` here *and* changing `start_url` and
// `scope` in the manifest below to match, or the installed app will launch to a
// 404 and the service worker will not control the page.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' rather than 'autoUpdate': a game in progress must never be
      // reloaded out from under the table. The new version waits until someone
      // taps the toast.
      registerType: 'prompt',
      injectRegister: null, // registration is owned by <UpdatePrompt />

      // No includeAssets: the globPatterns below already sweep everything
      // public/ copies into dist, and listing a file in both precaches it twice.

      manifest: {
        name: 'Secret Hitler XL',
        short_name: 'Secret Hitler',
        description:
          'Local pass-and-play Secret Hitler with the Communist (XL) expansion. Works offline.',
        // Hides the URL bar and the browser chrome, so passing the phone around
        // cannot accidentally navigate away from the game.
        display: 'standalone',
        // The layout is built for a phone held upright; a rotation mid-handoff
        // would reflow every fixed overlay.
        orientation: 'portrait',
        theme_color: '#7f1d1d',
        background_color: '#1c1917',
        start_url: '/',
        scope: '/',
        categories: ['games'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Everything the app needs is precached at install time and then served
        // from the cache first — which is what precaching *is* in Workbox. The
        // app makes no network requests of its own, so once this list is in the
        // cache the game is fully playable with the radio off.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        // The plugin injects the manifest and its icons into the precache
        // itself; matching them here as well would list each one twice.
        globIgnores: ['**/manifest.webmanifest', '**/pwa-*.png'],
        // A cold navigation offline still has to resolve to the app shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Fonts are the only large assets; keep the default 2 MiB cap honest.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
