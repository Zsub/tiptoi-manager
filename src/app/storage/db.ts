import { DBSchema, openDB } from 'idb';

import type { Catalog } from '@app/catalog/types.ts';

import { IDB_NAME, IDB_STORE_CATALOG, IDB_STORE_FILES } from './constants.ts';
import { SavedProduct } from './gmeFilesDB.ts';

interface TipToiDB extends DBSchema {
  [IDB_STORE_FILES]: {
    key: string;
    value: SavedProduct;
  };
  [IDB_STORE_CATALOG]: {
    key: string;
    value: Catalog;
  };
}

export const dbPromise = openDB<TipToiDB>(IDB_NAME, 2, {
  /**
   * `upgrade` also runs for users coming from version 1, where
   * `IDB_STORE_FILES` already exists. Creating an existing store throws and
   * would leave the database unusable, so every store creation is guarded.
   */
  upgrade(db) {
    if (!db.objectStoreNames.contains(IDB_STORE_FILES)) {
      db.createObjectStore(IDB_STORE_FILES);
    }
    if (!db.objectStoreNames.contains(IDB_STORE_CATALOG)) {
      db.createObjectStore(IDB_STORE_CATALOG);
    }
  },
  /**
   * A second tab still holding the database open at version 1 blocks this
   * upgrade. Without these handlers `openDB` never settles, so `dbPromise`
   * hangs forever and every catalog/gme-file read silently stalls.
   */
  blocked() {
    console.warn(
      `[${IDB_NAME}] upgrade blocked by another open tab - close it to continue.`
    );
  },
  blocking() {
    // This tab is holding an older version open while another tab upgrades.
    // Close our connection so the other tab can proceed.
    dbPromise.then((db) => db.close()).catch(() => undefined);
  },
});
