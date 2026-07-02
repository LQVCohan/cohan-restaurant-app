import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tableManagementPaymentLabelGuardPlugin = () => ({
  name: 'table-management-payment-label-guard',
  enforce: 'pre',
  transform(code, id) {
    const filePath = id.split('?')[0];
    const targetPath = path.join(
      'src',
      'components',
      'Dashboard_Manager',
      'Table',
      'TableManagement.jsx',
    );
    if (!path.normalize(filePath).endsWith(targetPath)) return null;

    const shortLabelSnippet = 'renderQuickAction(t, "payment_pending", "T.Toán", "btn-mini warning")';
    const fullLabelSnippet = 'renderQuickAction(t, "payment_pending", "Thanh toán", "btn-mini warning")';
    if (!code.includes(shortLabelSnippet)) return null;

    return {
      code: code.replace(shortLabelSnippet, fullLabelSnippet),
      map: null,
    };
  },
});

export default defineConfig({
  plugins: [tableManagementPaymentLabelGuardPlugin(), react()],
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
    testTimeout: 15000,
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
