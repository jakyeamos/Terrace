import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporter: 'verbose',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.cjs', 'src/**/*.ts'],
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
