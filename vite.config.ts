import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'assets/header-banner.png',
        'assets/logo.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Control de Ventas | Madera para Minería',
        short_name: 'Ventas Madera',
        description:
          'Control de facturas, pagos y saldos para la venta de todo tipo de madera para minería.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F7FB',
        theme_color: '#0B2340',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
  },
});
