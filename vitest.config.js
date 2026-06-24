import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'lucide-react': path.resolve(__dirname, './src/lib/lucideReactShim.jsx'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    include: [
      'src/**/*.test.js',
      'src/**/*.test.jsx',
      'src/**/*.spec.js',
      'src/**/*.spec.jsx',
    ],
    exclude: [
      'cohan-restaurant-backend/**',
      'node_modules/**',
      'dist/**',
      'src/routes/__tests__/AppRouter.test.jsx',
      'src/routes/__tests__/routeGuard.test.js',
      'src/hooks/staffAvatarQueryContract.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/routes/AppRouter.jsx',
        'src/context/AuthProvider.jsx',
        'src/context/CartProvider.jsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
});
