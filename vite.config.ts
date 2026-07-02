import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  envDir: __dirname,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
