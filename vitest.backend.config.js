import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'cohan-restaurant-backend',
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
  },
});
