/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** "/" on Vercel/Netlify, "/Gym/" on GitHub Pages (set BASE_PATH in the workflow). */
function normalizeBase(value: string | undefined): string {
  const v = (value ?? '/').trim() || '/';
  return `/${v.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
}

/**
 * Content-Security-Policy as a <meta> tag in production builds, for hosts that
 * can't send headers (GitHub Pages). Only this site and my Supabase project.
 * (frame-ancestors only works as a header: vercel.json/netlify.toml send it.)
 */
function cspMeta(supabaseUrl: string | undefined): Plugin {
  let connect = "'self'";
  try {
    if (supabaseUrl) {
      const origin = new URL(supabaseUrl).origin;
      connect += ` ${origin} ${origin.replace(/^https:/, 'wss:')}`;
    }
  } catch {
    /* invalid URL: the app stays local-only anyway */
  }
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'scheda-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBase(process.env.BASE_PATH ?? env.BASE_PATH);
  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      cspMeta(env.VITE_SUPABASE_URL),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: base,
          name: 'Scheda',
          short_name: 'Scheda',
          description: 'La mia scheda di allenamento: programma, serie e carichi.',
          lang: 'it',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0B0F14',
          theme_color: '#0B0F14',
          categories: ['health', 'fitness', 'sports'],
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/\/api\//],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
