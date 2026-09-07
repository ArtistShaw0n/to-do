/** Bundles the CLI's copy of the store mapping. See src/lib/cli-bridge.ts. */
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/lib/cli-bridge.ts', formats: ['es'], fileName: () => 'store.mjs' },
    outDir: 'bin/lib',
    emptyOutDir: false,
    target: 'node22',
    minify: false,
    rollupOptions: { external: [/^node:/] },
  },
  logLevel: 'error',
});
