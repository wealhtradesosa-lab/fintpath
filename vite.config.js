import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Prevent scope hoisting conflicts with duplicate const names
        preserveModules: false,
      }
    },
    // Use terser instead of esbuild for more reliable minification
    minify: 'esbuild',
    target: 'es2020',
  }
})
