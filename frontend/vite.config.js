import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // We explicitly set the base path to '/' to ensure assets are requested from the root,
  // which prevents issues when the dev server is accessed via IP.
  base: '/',
  server: {
    host: '0.0.0.0', // Ensures it binds to all network interfaces
    port: 5173,
    // Removed strictHostCheck: true because it can sometimes block access when using an IP directly.
  }
});
