import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base so the build works from any host path.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sight Reading Genius',
        short_name: 'Sight Reading',
        description: 'Piano sight reading flash cards that listen to your piano.',
        display: 'standalone',
        background_color: '#11131a',
        theme_color: '#11131a',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})
