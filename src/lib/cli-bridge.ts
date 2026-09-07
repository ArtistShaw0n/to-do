/**
 * What the CLI needs from the app's libraries, in one place.
 *
 * `bin/todo.mjs` is plain JavaScript with no build step — deliberately, since
 * Claude runs it constantly and a stale build would be a confusing way to fail.
 * But the vault-to-store mapping must not be written twice: CLAUDE.md already
 * warns that the schema is a contract shared by several implementations, and a
 * fourth copy of the mapping is a fourth place for it to drift.
 *
 * So this module is bundled to `bin/lib/store.mjs` and committed. `pnpm
 * check:generated` fails if the committed copy no longer matches the source.
 */

export { applyVaultToStore, storeToVault, writeVaultToStore, TABLES } from './store';
export { createMergeableStore } from 'tinybase';
export { createWsSynchronizer } from 'tinybase/synchronizers/synchronizer-ws-client';
