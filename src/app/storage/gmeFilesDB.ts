import { Catalog, ProductImageI } from '@app/catalog/types.ts';
import { IDB_STORE_CATALOG, IDB_STORE_FILES } from '@app/storage/constants.ts';

import { base64Content, mimeType } from '@utils/functions.ts';

import { dbPromise } from './db.ts';

export interface SavedProduct {
  name: string;
  images: Array<ProductImageI>;
  audioFile: {
    fileName: string;
    fileContent: [base64Content, mimeType];
    url: string;
    version: string;
  };
}

type ValueType = SavedProduct;

export const get = async (key: string): Promise<ValueType | undefined> =>
  (await dbPromise).get(IDB_STORE_FILES, key);

export const set = async (key: string, val: ValueType) =>
  (await dbPromise).put(IDB_STORE_FILES, val, key);

export const del = async (key: string): Promise<void> =>
  (await dbPromise).delete(IDB_STORE_FILES, key);

export const clear = async (): Promise<void> =>
  (await dbPromise).clear(IDB_STORE_FILES);

export const getKeys = async (): Promise<Array<string>> =>
  (await dbPromise).getAllKeys(IDB_STORE_FILES);

export const getCatalog = async (key: string): Promise<Catalog | undefined> =>
  (await dbPromise).get(IDB_STORE_CATALOG, key);

export const setCatalog = async (key: string, val: Catalog) =>
  (await dbPromise).put(IDB_STORE_CATALOG, val, key);

export const delCatalog = async (key: string): Promise<void> =>
  (await dbPromise).delete(IDB_STORE_CATALOG, key);

export const clearCatalog = async (): Promise<void> =>
  (await dbPromise).clear(IDB_STORE_CATALOG);
