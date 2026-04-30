import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@tensorflow/tfjs-core')) return 'vendor-tf-core'
            if (id.includes('@tensorflow/tfjs-converter')) return 'vendor-tf-converter'
            if (id.includes('@tensorflow/tfjs-backend')) return 'vendor-tf-backend'
            if (id.includes('pose-detection')) return 'vendor-pose-detection'
            if (id.includes('@tensorflow')) return 'vendor-tfjs'
          }
          return undefined
        }
      }
    }
  },
  server: {
    port: 5173
  }
})

