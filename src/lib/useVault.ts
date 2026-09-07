import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vault } from './types';
import { computeStats, loadVault, setTrayBadge } from './vault';
import {
  applyVault, currentVault, migrateFromFile, onStoreChanged, readSyncConfig,
  seedSyncConfigFromHost, startLocalPersistence, startSync, type SyncState,
} from './sync';
import { startNormaliseWorker } from './normaliseWorker';

interface UseVault {
  vault: Vault | null;
  path: string;
  error: string | null;
  sync: SyncState;
  /** Apply a pure mutation. The store is the source of truth for the result. */
  mutate: (fn: (v: Vault) => Vault) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * The vault, backed by a TinyBase store rather than a JSON file.
 *
 * The interface is unchanged from the file-backed version — the UI hands over a
 * function from vault to vault and never learns where any of it is kept. What
 * changed underneath is that a mutation now writes only the rows it touched,
 * and that every other device sees it.
 *
 * There is no conflict path here any more. The old version had to re-apply its
 * mutation when the CLI wrote between a read and a save; two writers to one
 * document leave no other option. Rows merge on their own, so the case has
 * stopped existing rather than being handled better.
 */
export function useVault(): UseVault {
  const [vault, setVault] = useState<Vault | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSyncState] = useState<SyncState>('off');
  const ready = useRef(false);

  const refresh = useCallback(() => setVault(currentVault()), []);

  useEffect(() => {
    let stopPersisting: (() => void) | undefined;
    let stopSyncing: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        // Seed the hub first: which local copy to use depends on whether one
        // is configured, so asking afterwards would be too late.
        await seedSyncConfigFromHost();
        stopPersisting = await startLocalPersistence();

        // An existing JSON vault moves across once, before anything is shown,
        // so the first render is never of an empty list the user then watches
        // fill in.
        //
        // Only worth reading when there is something to bring over. With a hub
        // configured the vault already lives there, and the file is one that
        // nothing writes any more — but it sits in a MEGA folder, which macOS
        // treats as a removable volume, so opening it raises a permission
        // prompt on every single launch.
        if (!readSyncConfig()) {
          try {
            const { vault: fromFile } = await loadVault();
            migrateFromFile(fromFile);
          } catch {
            // No file, or no Tauri to read one — nothing to bring over.
          }
        }

        if (cancelled) return;
        ready.current = true;
        refresh();

        const config = readSyncConfig();
        if (config) {
          stopSyncing = await startSync(config, (s) => { if (!cancelled) setSyncState(s); });
        }
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();

    return () => {
      cancelled = true;
      stopSyncing?.();
      stopPersisting?.();
    };
  }, [refresh]);

  // One listener covers every source: this window, another device, the CLI.
  useEffect(() => onStoreChanged(() => { if (ready.current) refresh(); }), [refresh]);


  useEffect(() => {
    if (!vault) return;
    const stats = computeStats(vault);
    void setTrayBadge(stats.open, stats.overdue > 0 || stats.urgent > 0);
  }, [vault]);

  const mutate = useCallback(async (fn: (v: Vault) => Vault) => {
    if (!ready.current) return;
    try {
      // Read straight from the store rather than from React state: two
      // mutations in the same tick would otherwise both build on the first's
      // input and the second would discard the first.
      applyVault(fn(currentVault()));
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const reload = useCallback(async () => {
    refresh();
  }, [refresh]);

  /**
   * Finish what the phones could not.
   *
   * Only on a Mac, and only once the hub is connected — there is nothing to
   * pick up otherwise, and the CLI this leans on lives here.
   */
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window) || sync !== 'online') return;
    return startNormaliseWorker(mutate);
  }, [sync, mutate]);


  return { vault, path: 'local store', error, sync, mutate, reload };
}
