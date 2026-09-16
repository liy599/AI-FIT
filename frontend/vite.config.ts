import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration file
export default defineConfig({
  // Enable React support (JSX, Fast Refresh, etc.)
  plugins: [react()],

  build: {
    rollupOptions: {
      external: ['@mediapipe/pose', '@tensorflow/tfjs-backend-webgpu'],
      output: {
        /**
         * Manual chunk splitting for better performance.
         * Splits large dependencies (especially TensorFlow) into separate bundles.
         */
        manualChunks(id: string) {
          const normalizedId = id.replace(/\\/g, '/')

          // Only process third-party dependencies
          if (normalizedId.includes('node_modules')) {

            // TensorFlow core (math engine)
            if (normalizedId.includes('@tensorflow/tfjs-core')) {
              return 'vendor-tf-core'
            }

            // TensorFlow model converter (load/convert models)
            if (normalizedId.includes('@tensorflow/tfjs-converter')) {
              return 'vendor-tf-converter'
            }

            // TensorFlow backends are loaded only by the pose tool and split by runtime.
            if (normalizedId.includes('@tensorflow/tfjs-backend-webgl')) {
              return 'vendor-tf-backend-webgl'
            }
            if (normalizedId.includes('@tensorflow/tfjs-backend-cpu')) {
              return 'vendor-tf-backend-cpu'
            }
            if (normalizedId.includes('@tensorflow/tfjs-backend')) {
              return 'vendor-tf-backend-shared'
            }

            // Pose detection library (AI body tracking)
            if (normalizedId.includes('pose-detection')) {
              return 'vendor-pose-detection'
            }

            // Other TensorFlow-related packages
            if (normalizedId.includes('@tensorflow')) {
              return 'vendor-tfjs'
            }
          }

          // Let Vite handle other modules automatically
          return undefined
        }
      }
    },
    chunkSizeWarningLimit: 600
  },

  // Exclude CDN-loaded packages from dev pre-bundling
  optimizeDeps: {
    exclude: ['@mediapipe/pose', '@tensorflow/tfjs-backend-webgpu'],
  },

  // Development server configuration
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true,
      }
    }
  }
})
