import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: 'globalThis', // Fix for simple-peer and other Node.js libraries
    'process.env': {}, // Polyfill process.env
  },
  optimizeDeps: {
    include: ['simple-peer'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    host: "0.0.0.0", // allow access from Docker container
    port: 5173,
    watch: {
      usePolling: true, // enables hot reload inside Docker
    },
  },
})
