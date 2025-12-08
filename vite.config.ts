import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools(), tailwindcss(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
      // Ensure the browser-friendly buffer package is used and bundled
      buffer: 'buffer/',
      'fsm-submodule': fileURLToPath(new URL('./fsm-submodule/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['buffer', 'jotai', 'react', 'react-dom'],
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
        },
      },
    },
  },
})
