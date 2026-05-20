import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['cohan-restaurant-backend/tests/**/*.{test,spec}.{js,ts}'],
  },
});
