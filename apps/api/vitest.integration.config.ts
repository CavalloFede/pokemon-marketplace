import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.integration.test.ts',
        'src/types/**'
      ]
    },
    // Integration tests need longer timeouts and real DB
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run integration tests sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    // Different setup file for integration tests
    setupFiles: ['./src/test/integration-setup.ts']
  }
});
