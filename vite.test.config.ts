/** Bundles an integration test so it runs under plain Node. */
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: `test/${['store','bugs','lock'].includes(mode) ? mode : 'sync'}.ts`,
      formats: ['es'],
      fileName: () => `${['store','bugs','lock'].includes(mode) ? mode : 'sync'}.mjs`,
    },
    outDir: '.test-out',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { external: [/^node:/] },
  },
  logLevel: 'error',
}));
