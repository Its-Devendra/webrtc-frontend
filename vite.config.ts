import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0', // Allow network access
    port: 5173, // Set a fixed port
    strictPort: true, // Avoid auto-changing ports
    allowedHosts: ['.ngrok-free.app'], // Allow any Ngrok subdomain

  },
});

