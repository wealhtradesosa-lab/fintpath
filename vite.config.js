import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

// Multi-page mode: cada HTML listado en rollupOptions.input genera su propio
// bundle inyectado. Comparten chunks via code splitting, costo extra mínimo.
//
// /pioneros.html — meta tags Open Graph específicas para la campaña Pioneros
//   2026 (preview correcto en WhatsApp / Twitter / Facebook). Carga el mismo
//   bundle de React que index.html; la SPA maneja la ruta /pioneros como siempre.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pioneros: resolve(__dirname, 'pioneros.html'),
      },
    },
  },
})
