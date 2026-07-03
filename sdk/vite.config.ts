/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
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
  },
});
