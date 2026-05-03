import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration file
export default defineConfig({
  // Enable React support (JSX, Fast Refresh, etc.)
  plugins: [react()],
  // Keep stable root URL assets while storing them under src/
  publicDir: 'src/static',

  build: {
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting for better performance.
         * Splits large dependencies (especially TensorFlow) into separate bundles.
         */
        manualChunks(id: string) {

          // Only process third-party dependencies
          if (id.includes('node_modules')) {

            // TensorFlow core (math engine)
            if (id.includes('@tensorflow/tfjs-core')) {
              return 'vendor-tf-core'
            }

            // TensorFlow model converter (load/convert models)
            if (id.includes('@tensorflow/tfjs-converter')) {
              return 'vendor-tf-converter'
            }

            // TensorFlow backend (CPU / WebGL execution)
            if (id.includes('@tensorflow/tfjs-backend')) {
              return 'vendor-tf-backend'
            }

            // Pose detection library (AI body tracking)
            if (id.includes('pose-detection')) {
              return 'vendor-pose-detection'
            }

            // Other TensorFlow-related packages
            if (id.includes('@tensorflow')) {
              return 'vendor-tfjs'
            }
          }

          // Let Vite handle other modules automatically
          return undefined
        }
      }
    }
  },

  // Development server configuration
  server: {
    port: 5173 // Local dev server port
  }
})
