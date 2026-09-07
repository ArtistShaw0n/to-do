/** Bundles the integration tests so they run under plain Node. */
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'test/sync.ts', formats: ['es'], fileName: () => 'sync.mjs' },
    outDir: '.test-out',
    target: 'node22',
    minify: false,
    rollupOptions: { external: [/^node:/] },
  },
  logLevel: 'error',
});
