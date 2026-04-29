import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporter: 'verbose',
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['packages/terrace-core/src/**/*.cjs'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  }
});
