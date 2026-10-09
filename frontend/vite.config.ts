import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Sin esto, Vite solo escucha en IPv6 (::1) en esta máquina — cloudflared
    // (el túnel para exponer el frontend) intenta conectarse por IPv4
    // (127.0.0.1) y falla con "connection refused" porque ahí no hay nada
    // escuchando. host:true hace que escuche en todas las interfaces,
    // incluyendo IPv4, así cloudflared sí encuentra el servidor.
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
