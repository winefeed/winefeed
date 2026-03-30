import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      '.next',
      // Integration and attack tests require a running local server (localhost:3000).
      // Run them explicitly with: npx vitest run tests/integration
      // or: npx vitest run tests/attack
      'tests/integration/**',
      'tests/attack/**',
    ],
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
