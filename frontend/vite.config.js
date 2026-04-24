import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return

          if (id.includes("recharts")) return "charts"
          if (id.includes("pdfjs-dist")) return "pdf"
          if (id.includes("react-router")) return "router"
          if (id.includes("/react/") || id.includes("/react-dom/")) return "react-vendor"
        },
      },
    },
  },
})
