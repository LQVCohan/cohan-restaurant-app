import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/env.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'graphql/resolvers/user/query.js',
        'graphql/resolvers/user/mutation.js',
        'graphql/resolvers/permission/query.js',
        'graphql/resolvers/order/mutation.js',
        'graphql/resolvers/reservation/query.js',
      ],
      thresholds: {
        lines: 65,
        functions: 65,
        statements: 65,
        branches: 55,
      },
    },
  },
});
