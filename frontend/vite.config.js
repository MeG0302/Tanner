import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // We explicitly set the base path to '/'
  base: '/',
  server: {
    host: '0.0.0.0', // Binds to all network interfaces
    port: 5173,
    
    // --- ADD THIS PROXY BLOCK ---
    proxy: {
      // Any request starting with /api will be forwarded
      '/api': {
        target: 'http://92.246.141.205:3001', // Your backend server
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false,      // Don't validate SSL certs
      }
    }
    // --- END PROXY BLOCK ---
  }
});
