import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo-name>/
export default defineConfig({
  base: '/vela/',
  optimizeDeps: { exclude: ['@mujoco/mujoco'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
});
