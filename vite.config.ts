import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        options: path.resolve(__dirname, 'options.html'),
        popup: path.resolve(__dirname, 'popup.html'),
      },
    },
  },
});
