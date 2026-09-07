/** Bundles an integration test so it runs under plain Node. */
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: mode === 'store' ? 'test/store.ts' : 'test/sync.ts',
      formats: ['es'],
      fileName: () => (mode === 'store' ? 'store.mjs' : 'sync.mjs'),
    },
    outDir: '.test-out',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { external: [/^node:/] },
  },
  logLevel: 'error',
}));
