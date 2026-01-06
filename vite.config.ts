import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    tailwindcss(),
    {
      name: 'docs-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/logic-easy/docs' || req.url === '/logic-easy/docs/') {
            req.url = '/logic-easy/docs/.vitepress/dist/index.html'
          }
          else if (req.url?.startsWith('/logic-easy/docs')) {
            // Rewrite the URL to point to the correct location
            const newPath = req.url.replace('/logic-easy/docs', '/logic-easy/docs/.vitepress/dist')
            req.url = newPath
          }
          next()
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
      // Ensure the browser-friendly buffer package is used and bundled
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer']
  },
  base: '/logic-easy/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Split by package: lodash -> lodash chunk
            return id.toString().split('node_modules/')[1].split('/')[0].toString()
          }
        }
      }
    }
  }
})
