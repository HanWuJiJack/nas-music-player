import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
        preload: './preload.js'
      },
      external: [],
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'preload' ? 'preload.js' : '[name]-[hash].js'
        }
      }
    }
  },
  base: './',
  server: {
    port: 51731,
    strictPort: true,
    host: true
  }
})