/** Bundles an integration test so it runs under plain Node. */
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: `test/${mode === 'store' || mode === 'bugs' ? mode : 'sync'}.ts`,
      formats: ['es'],
      fileName: () => `${mode === 'store' || mode === 'bugs' ? mode : 'sync'}.mjs`,
    },
    outDir: '.test-out',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { external: [/^node:/] },
  },
  logLevel: 'error',
}));
