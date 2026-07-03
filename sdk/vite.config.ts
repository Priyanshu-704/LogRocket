/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Analyzer',
      fileName: (format) => {
        if (format === 'umd') return 'analyzer.min.js';
        return `analyzer.${format}.js`;
      },
      formats: ['umd', 'es'],
    },
    sourcemap: true,
    minify: 'esbuild',
    emptyOutDir: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
  },
});
