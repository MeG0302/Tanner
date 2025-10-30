import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // We explicitly set the base path to '/' to ensure assets are requested from the root,
  // which is critical for resolving the 404 error on your VPS when accessed by IP.
  base: '/',
  server: {
    host: '0.0.0.0', // Binds to all network interfaces, essential for external access via VPS IP
    port: 5173,
  }
});
