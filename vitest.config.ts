import { defineConfig } from 'vitest/config';
import path from 'node:path';

const alias = { '@': path.resolve(__dirname, './src') };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/a11y/**'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        resolve: { alias },
        // tsconfig sets `jsx: preserve` because Next owns the JSX transform in
        // the app build; the test runner has no Next pipeline, so it is told to
        // use the automatic runtime here rather than changing the app's config.
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'dom',
          globals: true,
          environment: 'jsdom',
          include: ['tests/a11y/**/*.test.{ts,tsx}'],
          setupFiles: ['./tests/setup.dom.ts'],
        },
      },
    ],
  },
});
